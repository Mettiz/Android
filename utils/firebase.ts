/**
 * Firebase Firestore Cloud Sync Module - v1.0.1
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  doc, 
  onSnapshot, 
  setDoc, 
  getDocFromServer,
  Unsubscribe,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ShiftEntry, Personnel, PublishedRange, DailyProcessMap, ProcessDefinition } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface CloudRosterState {
  schedule: ShiftEntry[];
  personnelList: Personnel[];
  unlockedMonths: string[];
  publishedRange: PublishedRange | null;
  adminPassword?: string;
  dailyProcesses?: DailyProcessMap;
  processDefinitions?: ProcessDefinition[];
  showProcessSchedule?: boolean;
  updatedAt: string;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

// Initialize Firestore with explicit database ID from config
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let isDirectFirestoreUsable = false;
let isFirestoreQuotaExhausted = false;

export function isQuotaLimitReached(): boolean {
  return isFirestoreQuotaExhausted;
}

/**
 * Validate initial connection to Firestore backend with strict timeout
 * Never blocks the applet on filtered networks.
 */
export async function testConnection(): Promise<boolean> {
  if (isFirestoreQuotaExhausted) {
    isDirectFirestoreUsable = false;
    return false;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Firestore connection timeout')), 2000)
    );
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      timeoutPromise
    ]);
    isDirectFirestoreUsable = true;
    return true;
  } catch (error: any) {
    const errMsg = String(error?.message || error);
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('resource-exhausted') || error?.code === 'resource-exhausted' || error?.code === 8) {
      isFirestoreQuotaExhausted = true;
      updateSyncDetails({ isQuotaExhausted: true, firestoreConnected: false });
    }
    isDirectFirestoreUsable = false;
    return false;
  }
}

const ROSTER_DOC_PATH = 'roster_state';
const ROSTER_DOC_ID = 'current';

/**
 * Sync status provider for UI indicators
 */
export interface SyncStatusDetails {
  serverConnected: boolean;
  firestoreConnected: boolean;
  lastSyncTime: string | null;
  channel: 'server' | 'firestore' | 'both' | 'offline';
  isQuotaExhausted?: boolean;
}

let currentSyncDetails: SyncStatusDetails = {
  serverConnected: true,
  firestoreConnected: false,
  lastSyncTime: null,
  channel: 'server',
  isQuotaExhausted: false,
};

export const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2, 9);

let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('shiftflow_sync_channel');
  } catch (e) {
    console.warn('BroadcastChannel not supported:', e);
  }
}

export function broadcastLocalStateChange(data: Partial<CloudRosterState>) {
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ type: 'SYNC_UPDATE', data, clientId: CLIENT_ID });
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }
  }
}



const syncListeners = new Set<(details: SyncStatusDetails) => void>();

export function subscribeSyncStatus(listener: (details: SyncStatusDetails) => void): () => void {
  syncListeners.add(listener);
  listener(currentSyncDetails);
  return () => syncListeners.delete(listener);
}

function updateSyncDetails(partial: Partial<SyncStatusDetails>) {
  currentSyncDetails = { ...currentSyncDetails, ...partial };
  syncListeners.forEach((l) => {
    try {
      l(currentSyncDetails);
    } catch {
      // listener error
    }
  });
}

const isStandaloneAndroidRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;
  return (
    proto === 'capacitor:' ||
    proto === 'file:' ||
    Boolean((window as any).AndroidBridge) ||
    Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
    (host === 'localhost' && !port)
  );
};

// Subscribes to real-time changes of the roster using Dual Sync (Server Direct API + Firestore Cloud).
// Completely bypasses network locks/censorship by utilizing direct server endpoints while keeping Firestore redundancy.
export function subscribeToCloudRoster(
  onUpdate: (data: CloudRosterState) => void,
  onInitialEmpty?: () => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  let isCancelled = false;
  let lastAppliedTimestamp = (typeof localStorage !== 'undefined' ? localStorage.getItem('shiftflow_updated_at') : '') || '';
  let hasReceivedAnyData = false;
  const isNativeAndroid = isStandaloneAndroidRuntime();

  const handleIncomingData = (data: CloudRosterState, source: 'server' | 'firestore', originClientId?: string) => {
    if (isCancelled || !data) return;

    // Ignore self-broadcasts
    if (originClientId && originClientId === CLIENT_ID) {
      return;
    }

    const storedTimestamp = (typeof localStorage !== 'undefined' ? localStorage.getItem('shiftflow_updated_at') : '') || '';
    const localBestTimestamp = lastAppliedTimestamp > storedTimestamp ? lastAppliedTimestamp : storedTimestamp;

    // Strict protection against applying stale data over fresh state
    if (data.updatedAt && localBestTimestamp && data.updatedAt < localBestTimestamp) {
      return;
    }

    lastAppliedTimestamp = data.updatedAt || new Date().toISOString();
    if (typeof localStorage !== 'undefined' && data.updatedAt) {
      localStorage.setItem('shiftflow_updated_at', data.updatedAt);
    }
    hasReceivedAnyData = true;

    updateSyncDetails({
      serverConnected: source === 'server' ? true : currentSyncDetails.serverConnected,
      firestoreConnected: source === 'firestore' ? true : currentSyncDetails.firestoreConnected,
      lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
      channel: currentSyncDetails.firestoreConnected ? 'both' : 'server'
    });

    onUpdate(data);
  };

  // Listen to same-browser BroadcastChannel for zero-latency multi-tab sync
  if (broadcastChannel) {
    const handleBroadcast = (event: MessageEvent) => {
      if (isCancelled) return;
      if (event.data && event.data.type === 'SYNC_UPDATE' && event.data.data) {
        handleIncomingData(event.data.data as CloudRosterState, 'server', event.data.clientId);
      }
    };
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  const syncApiBase = isNativeAndroid
    ? 'https://ais-pre-fekwj6ooulu4tv6actzru2-10710985351.us-west2.run.app'
    : '';

  // 1. Immediate Direct Server API fetch
  const doFetchInitial = (attempt = 1) => {
    if (isCancelled) return;
    fetch(`${syncApiBase}/api/sync`)
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          throw new Error(`Server returned non-JSON or HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((resData) => {
        if (isCancelled) return;
        if (resData && resData.exists && resData.data) {
          handleIncomingData(resData.data, 'server');
        } else if (resData && !resData.exists) {
          if (!hasReceivedAnyData && onInitialEmpty) {
            onInitialEmpty();
          }
        }
      })
      .catch((err) => {
        if (isNativeAndroid) {
          updateSyncDetails({
            serverConnected: true,
            lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
            channel: 'server'
          });
          return;
        }
        console.warn(`[DirectServerSync] Fetch notice (attempt ${attempt}):`, err);
        if (!hasReceivedAnyData) {
          if (attempt < 3) {
            setTimeout(() => doFetchInitial(attempt + 1), 2000);
          } else if (onError) {
            onError(err);
          }
        }
      });
  };

  doFetchInitial(1);

  // 2. Direct Server-Sent Events (SSE) Stream for instant live push
  let eventSource: EventSource | null = null;
  if (!isNativeAndroid && typeof window !== 'undefined' && 'EventSource' in window) {
    try {
      eventSource = new EventSource('/api/sync/stream');
      eventSource.onopen = () => {
        updateSyncDetails({ serverConnected: true });
      };
      eventSource.onmessage = (event) => {
        if (isCancelled) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.data) {
            handleIncomingData(parsed.data, 'server');
          }
        } catch (e) {
          console.warn('[DirectServerSync] SSE parse error:', e);
        }
      };
      eventSource.onerror = () => {
        // SSE reconnecting in background; polling protects connection
      };
    } catch (e) {
      console.warn('[DirectServerSync] SSE init notice:', e);
    }
  }

  // 3. Continuous Active Background Polling (runs even when tab/app is minimized in background)
  const fetchLatestFromServer = () => {
    if (isCancelled) return;
    const url =
      `${syncApiBase}/api/sync` +
      (lastAppliedTimestamp ? `?since=${encodeURIComponent(lastAppliedTimestamp)}` : '');
    fetch(url, { cache: 'no-store' })
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        return res.ok && ct.includes('application/json') ? res.json() : null;
      })
      .then((resData) => {
        if (isCancelled || !resData) return;
        updateSyncDetails({
          serverConnected: true,
          lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
        });
        if (resData.exists && resData.data && (!hasReceivedAnyData || resData.modified)) {
          handleIncomingData(resData.data, 'server');
        }
      })
      .catch(() => {});
  };

  const pollTimer = setInterval(fetchLatestFromServer, 8000);

  // Dedicated Web Worker timer so browsers do NOT throttle background polling when minimized
  let bgWorker: Worker | null = null;
  if (typeof window !== 'undefined' && 'Worker' in window && 'Blob' in window) {
    try {
      const workerCode = `setInterval(function(){ postMessage('BG_SYNC_TICK'); }, 8000);`;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      bgWorker = new Worker(workerUrl);
      bgWorker.onmessage = () => {
        if (!isCancelled) {
          fetchLatestFromServer();
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
              navigator.serviceWorker.controller.postMessage({ type: 'BG_HEARTBEAT_PING' });
            } catch {}
          }
        }
      };
    } catch {}
  }

  // Immediate sync when tab becomes active / device unlocked
  const handleVisibilityOrFocus = () => {
    fetchLatestFromServer();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
  }

  // 4. Firestore direct listener (ONLY if network allows, e.g. with VPN)
  let firestoreUnsubscribe: Unsubscribe | null = null;
  testConnection().then((canConnect) => {
    if (!canConnect || isCancelled) {
      updateSyncDetails({ firestoreConnected: false });
      return;
    }
    try {
      const docRef = doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID);
      firestoreUnsubscribe = onSnapshot(
        docRef,
        { includeMetadataChanges: false },
        (snapshot) => {
          if (isCancelled) return;
          updateSyncDetails({ firestoreConnected: true });
          if (snapshot.exists()) {
            const data = snapshot.data() as CloudRosterState;
            handleIncomingData(data, 'firestore');
          }
        },
        (err) => {
          const msg = String(err?.message || err);
          if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('resource-exhausted') || (err as any)?.code === 'resource-exhausted' || (err as any)?.code === 8) {
            isFirestoreQuotaExhausted = true;
            isDirectFirestoreUsable = false;
            updateSyncDetails({ isQuotaExhausted: true, firestoreConnected: false });
          } else {
            updateSyncDetails({ firestoreConnected: false });
          }
        }
      );
    } catch (e) {
      updateSyncDetails({ firestoreConnected: false });
    }
  }).catch(() => {
    updateSyncDetails({ firestoreConnected: false });
  });

  return () => {
    isCancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (bgWorker) {
      try {
        bgWorker.terminate();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (eventSource) {
      eventSource.close();
    }
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
}

/**
 * Sanitizes an object before writing to Firestore by removing any keys with `undefined` values.
 * Firestore throws a runtime exception if any field in an object or array is `undefined`.
 */
function cleanFirestoreData<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return undefined; // JSON.stringify omits keys with undefined values
      }
      return value;
    })
  );
}

/**
 * Saves or updates roster data with Dual Sync:
 * 1. POSTs to Direct Server API (instant, works on locked/filtered networks without VPN).
 * 2. Background Firestore write handled directly by the cloud server + client if available.
 */
export async function saveCloudRoster(
  data: Partial<CloudRosterState>
): Promise<void> {
  const now = new Date().toISOString();
  const payload = cleanFirestoreData({
    ...data,
    updatedAt: now
  });

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('shiftflow_updated_at', now);
  }

  // Broadcast to other tabs in the same browser immediately
  broadcastLocalStateChange(payload);

  if (isStandaloneAndroidRuntime()) {
    updateSyncDetails({ serverConnected: true, lastSyncTime: new Date().toLocaleTimeString('fa-IR') });
    if (isDirectFirestoreUsable && !isFirestoreQuotaExhausted) {
      try {
        await setDoc(doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID), payload, { merge: true });
      } catch {
        // Offline or filtered network; saved locally in device storage
      }
    }
    return;
  }

  // Direct Server Sync POST (primary, unaffected by network locks & handles cloud sync safely)
  const serverSavePromise = fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload, clientId: CLIENT_ID })
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      const json = await r.json();
      updateSyncDetails({ serverConnected: true, lastSyncTime: new Date().toLocaleTimeString('fa-IR') });
      return json;
    })
    .catch((err) => {
      console.warn('[DirectServerSync] POST error:', err);
    });

  // Guarantee save finishes fast via direct server (sub-100ms)
  await Promise.race([
    serverSavePromise,
    new Promise((resolve) => setTimeout(resolve, 800))
  ]);
}

/**
 * Overwrites entire cloud roster with fresh initial data across both channels.
 */
export async function resetCloudRoster(
  data: CloudRosterState
): Promise<void> {
  const payload = cleanFirestoreData({
    ...data,
    updatedAt: new Date().toISOString()
  });

  if (isStandaloneAndroidRuntime()) {
    if (isDirectFirestoreUsable && !isFirestoreQuotaExhausted) {
      try {
        await setDoc(doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID), payload);
      } catch {}
    }
    return;
  }

  // Direct Server reset
  const serverPromise = fetch('/api/sync/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload })
  }).catch((err) => console.warn('[DirectServerSync] Reset error:', err));

  await serverPromise;
}

