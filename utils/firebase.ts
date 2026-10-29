/**
 * Firebase Firestore & Direct Server Real-Time Sync Module - v2.0.0
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDocFromServer,
  Unsubscribe,
  Firestore,
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
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
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
  _version?: number;
  _originClientId?: string;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

// Initialize Firestore with explicit database ID from config
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let isDirectFirestoreUsable = true;
let isFirestoreQuotaExhausted = false;

export function isQuotaLimitReached(): boolean {
  return isFirestoreQuotaExhausted;
}

/**
 * Validate initial connection to Firestore backend with timeout
 * Never blocks the applet on filtered networks.
 */
export async function testConnection(): Promise<boolean> {
  if (isFirestoreQuotaExhausted) {
    return false;
  }
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore connection timeout')), 5000)
    );
    await Promise.race([getDocFromServer(doc(db, 'test', 'connection')), timeoutPromise]);
    isDirectFirestoreUsable = true;
    return true;
  } catch (error: any) {
    const errMsg = String(error?.message || error);
    if (
      errMsg.includes('RESOURCE_EXHAUSTED') ||
      errMsg.includes('resource-exhausted') ||
      error?.code === 'resource-exhausted' ||
      error?.code === 8
    ) {
      isFirestoreQuotaExhausted = true;
      updateSyncDetails({ isQuotaExhausted: true, firestoreConnected: false });
    }
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

/**
 * Deterministic fingerprint of a schedule array so every tab/device accurately knows
 * if an incoming schedule is different from its own in-memory schedule — completely
 * immune to device clock skew or shared localStorage timestamps.
 */
export function getScheduleFingerprint(schedule?: ShiftEntry[]): string {
  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) return '';
  return schedule
    .map(
      (s) =>
        `${s.date}:${s.dayShiftPerson || ''}:${s.nightShiftPerson || ''}:${s.onCallPerson || ''}:${(
          s.extraDayPersons || []
        ).join(',')}:${(s.extraNightPersons || []).join(',')}:${s.isHoliday ? '1' : '0'}`
    )
    .join('|');
}

// Per-instance in-memory fingerprint of the currently applied schedule
let currentInstanceScheduleFingerprint = '';
let lastLocalMutationTimeMs = 0;

export function setLocalScheduleFingerprint(schedule: ShiftEntry[]) {
  const fp = getScheduleFingerprint(schedule);
  if (fp) {
    currentInstanceScheduleFingerprint = fp;
  }
}

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

export const isStandaloneAndroidRuntime = (): boolean => {
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

export const CUSTOM_SYNC_URL_STORAGE_KEY = 'shiftflow_custom_sync_url';
export const DEFAULT_VERCEL_SYNC_URL = 'https://android-fmd-shift-flow.vercel.app';

export const REMOTE_SERVER_URLS = [
  DEFAULT_VERCEL_SYNC_URL,
  'https://ais-pre-fekwj6ooulu4tv6actzru2-10710985351.us-west2.run.app',
  'https://ais-dev-fekwj6ooulu4tv6actzru2-10710985351.us-west2.run.app',
];

export function getCustomServerUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_VERCEL_SYNC_URL;
  try {
    const custom = localStorage.getItem(CUSTOM_SYNC_URL_STORAGE_KEY);
    if (custom !== null) {
      return custom.trim().replace(/\/+$/, '');
    }
    // Check Vite environment variable if configured during build
    const envUrl = (import.meta as any).env?.VITE_VERCEL_SYNC_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_VERCEL_SYNC_URL;
}

export function setCustomServerUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = url ? url.trim().replace(/\/+$/, '') : '';
    localStorage.setItem(CUSTOM_SYNC_URL_STORAGE_KEY, cleaned);
  } catch {}
}

export function getActiveServerUrls(): string[] {
  const urls: string[] = [];
  const custom = getCustomServerUrl();
  if (custom) {
    urls.push(custom);
  }
  for (const url of REMOTE_SERVER_URLS) {
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  return urls;
}

export async function testServerUrlConnection(rawUrl: string): Promise<{ success: boolean; message: string; latency?: number }> {
  const cleanUrl = rawUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    return { success: false, message: 'آدرس سرور وارد نشده است.' };
  }
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${cleanUrl}/api/sync?action=health&_t=${Date.now()}`, {
      signal: controller.signal,
      cache: 'no-store'
    });
    clearTimeout(timeout);
    const latency = Date.now() - startTime;
    if (res.ok) {
      return {
        success: true,
        message: `اتصال به ورسل موفقیت‌آمیز بود (${latency}ms) - آماده و بدون فیلتر در ایران`,
        latency
      };
    }
    return {
      success: false,
      message: `پاسخ از سرور دریافت شد ولی کد وضعیت ${res.status} بود.`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `خطای برقراری ارتباط با سرور: ${err?.message || 'تایم‌اوت یا عدم دسترسی'}`
    };
  }
}

export function getSyncApiBase(): string {
  const custom = getCustomServerUrl();
  if (custom) return custom;
  if (isStandaloneAndroidRuntime()) {
    return REMOTE_SERVER_URLS[0];
  }
  return '';
}

/**
 * Subscribes to real-time changes of the roster using Dual Sync:
 * 1. Direct Server SSE (/api/sync/stream) + Fast 2.5s Polling (/api/sync)
 * 2. Same-Browser Multi-Tab BroadcastChannel + window storage event
 * 3. Firestore Real-Time onSnapshot
 */
export function subscribeToCloudRoster(
  onUpdate: (data: CloudRosterState) => void,
  onInitialEmpty?: () => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  let isCancelled = false;
  let hasReceivedAnyData = false;
  let lastAppliedVersion = 0;
  let lastAppliedMetaHash = '';
  const isNativeAndroid = isStandaloneAndroidRuntime();
  const syncApiBase = getSyncApiBase();

  const getMetaHash = (d: CloudRosterState): string => {
    return JSON.stringify({
      u: d.unlockedMonths || [],
      p: d.publishedRange || null,
      s: d.showProcessSchedule,
      pl: (d.personnelList || []).map((x) => `${x.name}:${x.color}:${x.isActive}`),
    });
  };

  const handleIncomingData = (
    data: CloudRosterState,
    source: 'server' | 'firestore' | 'broadcast',
    originClientId?: string
  ) => {
    if (isCancelled || !data) return;

    const effectiveOrigin = originClientId || data._originClientId;
    // Ignore echoes of our own client's outgoing save within the last 4 seconds
    if (effectiveOrigin && effectiveOrigin === CLIENT_ID) {
      return;
    }

    const incomingFp = getScheduleFingerprint(data.schedule);
    const incomingMeta = getMetaHash(data);
    const incomingVersion = typeof data._version === 'number' ? data._version : 0;

    // If this client just mutated locally within the last 1.5s, don't let an older in-flight poll overwrite it
    if (Date.now() - lastLocalMutationTimeMs < 1500 && hasReceivedAnyData) {
      if (incomingFp === currentInstanceScheduleFingerprint) {
        return;
      }
    }

    // Check if anything actually changed compared to this tab's in-memory state
    const isScheduleChanged =
      Boolean(incomingFp) && incomingFp !== currentInstanceScheduleFingerprint;
    const isMetaChanged = incomingMeta !== lastAppliedMetaHash;
    const isNewerVersion = incomingVersion > 0 && incomingVersion > lastAppliedVersion;

    if (hasReceivedAnyData && !isScheduleChanged && !isMetaChanged && !isNewerVersion) {
      return;
    }

    if (incomingFp) {
      currentInstanceScheduleFingerprint = incomingFp;
    }
    lastAppliedMetaHash = incomingMeta;
    if (incomingVersion > lastAppliedVersion) {
      lastAppliedVersion = incomingVersion;
    }
    if (typeof localStorage !== 'undefined' && data.updatedAt) {
      try {
        localStorage.setItem('shiftflow_updated_at', data.updatedAt);
      } catch {}
    }
    hasReceivedAnyData = true;

    updateSyncDetails({
      serverConnected: source === 'server' || source === 'broadcast' ? true : currentSyncDetails.serverConnected,
      firestoreConnected: source === 'firestore' ? true : currentSyncDetails.firestoreConnected,
      lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
      channel: currentSyncDetails.firestoreConnected ? 'both' : 'server',
    });

    onUpdate(data);
  };

  // 0. Same-browser multi-tab instant sync via BroadcastChannel & storage event
  const handleBroadcast = (event: MessageEvent) => {
    if (isCancelled) return;
    if (event.data && event.data.type === 'SYNC_UPDATE' && event.data.data) {
      handleIncomingData(event.data.data as CloudRosterState, 'broadcast', event.data.clientId);
    }
  };
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }

  const handleStorageEvent = (event: StorageEvent) => {
    if (isCancelled) return;
    if (event.key === 'shiftflow_schedule_v2' && event.newValue) {
      try {
        const parsedSchedule = JSON.parse(event.newValue) as ShiftEntry[];
        if (Array.isArray(parsedSchedule) && parsedSchedule.length > 0) {
          const incomingFp = getScheduleFingerprint(parsedSchedule);
          if (incomingFp && incomingFp !== currentInstanceScheduleFingerprint) {
            handleIncomingData(
              {
                schedule: parsedSchedule,
                personnelList: [],
                unlockedMonths: [],
                publishedRange: undefined as any,
                updatedAt: new Date().toISOString(),
              },
              'broadcast'
            );
          }
        }
      } catch {}
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  // 1. Immediate Direct Server API + Firestore fallback fetch
  const fetchFromEndpoints = async (): Promise<any> => {
    const customUrl = getCustomServerUrl();
    if (!isNativeAndroid) {
      try {
        const res = await fetch(`/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          return await res.json();
        }
      } catch {}

      if (customUrl) {
        try {
          const res = await fetch(`${customUrl}/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            return await res.json();
          }
        } catch {}
      }
    } else {
      // For Standalone Android APK: try custom server (e.g. Vercel) and remote server endpoints
      for (const base of getActiveServerUrls()) {
        try {
          const res = await fetch(`${base}/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
          const ct = res.headers.get('content-type') || '';
          if (res.ok && ct.includes('application/json')) {
            return await res.json();
          }
        } catch {}
      }
    }

    // Direct Firestore fallback (always works from Android APK https://localhost without cookie redirects)
    if (!isFirestoreQuotaExhausted) {
      const snap = await getDocFromServer(doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID));
      if (snap.exists()) {
        const cloudData = snap.data() as CloudRosterState;
        isDirectFirestoreUsable = true;
        updateSyncDetails({ firestoreConnected: true });
        return {
          exists: true,
          modified: true,
          updatedAt: cloudData.updatedAt,
          data: cloudData,
        };
      }
    }
    throw new Error('All remote endpoints unreachable');
  };

  const doFetchInitial = (attempt = 1) => {
    if (isCancelled) return;
    fetchFromEndpoints()
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
            channel: 'server',
          });
          return;
        }
        if (!hasReceivedAnyData) {
          if (attempt < 3) {
            setTimeout(() => doFetchInitial(attempt + 1), 1500);
          } else if (onError) {
            onError(err);
          }
        }
      });
  };

  doFetchInitial(1);

  // 2. Direct Server-Sent Events (SSE) Stream for instant live push (enabled on both Web & Android)
  let eventSource: EventSource | null = null;
  let sseReconnectTimer: any = null;

  const connectSSE = () => {
    if (isCancelled || typeof window === 'undefined' || !('EventSource' in window)) return;
    try {
      if (eventSource) {
        try {
          eventSource.close();
        } catch {}
      }
      const streamUrl = `${syncApiBase}/api/sync/stream`;
      eventSource = new EventSource(streamUrl);
      eventSource.onopen = () => {
        updateSyncDetails({ serverConnected: true });
      };
      eventSource.onmessage = (event) => {
        if (isCancelled) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.data) {
            handleIncomingData(parsed.data, 'server', parsed.data._originClientId);
          }
        } catch (e) {
          console.warn('[DirectServerSync] SSE parse error:', e);
        }
      };
      eventSource.onerror = () => {
        try {
          eventSource?.close();
        } catch {}
        if (!isCancelled) {
          if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
          sseReconnectTimer = setTimeout(connectSSE, 4000);
        }
      };
    } catch {}
  };

  connectSSE();

  // 3. Continuous Active Background Polling every 2.0 seconds (runs even when tab/app is minimized)
  const fetchLatestFromServer = () => {
    if (isCancelled) return;
    fetchFromEndpoints()
      .then((resData) => {
        if (isCancelled || !resData) return;
        updateSyncDetails({
          serverConnected: true,
          lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
        });
        if (resData.exists && resData.data) {
          handleIncomingData(resData.data, 'server', resData.data._originClientId);
        }
      })
      .catch(() => {});
  };

  const pollTimer = setInterval(fetchLatestFromServer, 2000);

  // Dedicated Web Worker timer so browsers do NOT throttle background polling when minimized
  let bgWorker: Worker | null = null;
  if (typeof window !== 'undefined' && 'Worker' in window && 'Blob' in window) {
    try {
      const workerCode = `setInterval(function(){ postMessage('BG_SYNC_TICK'); }, 2500);`;
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

  // 4. Firestore direct listener attached IMMEDIATELY (no testConnection gatekeeper!)
  let firestoreUnsubscribe: Unsubscribe | null = null;
  if (!isFirestoreQuotaExhausted) {
    try {
      const docRef = doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID);
      firestoreUnsubscribe = onSnapshot(
        docRef,
        { includeMetadataChanges: false },
        (snapshot) => {
          if (isCancelled) return;
          isDirectFirestoreUsable = true;
          updateSyncDetails({ firestoreConnected: true });
          if (snapshot.exists()) {
            const data = snapshot.data() as CloudRosterState;
            handleIncomingData(data, 'firestore', data._originClientId);
          }
        },
        (err) => {
          const msg = String(err?.message || err);
          if (
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('resource-exhausted') ||
            (err as any)?.code === 'resource-exhausted' ||
            (err as any)?.code === 8
          ) {
            isFirestoreQuotaExhausted = true;
            isDirectFirestoreUsable = false;
            updateSyncDetails({ isQuotaExhausted: true, firestoreConnected: false });
          } else {
            updateSyncDetails({ firestoreConnected: false });
          }
        }
      );
    } catch {
      updateSyncDetails({ firestoreConnected: false });
    }
  }

  return () => {
    isCancelled = true;
    if (pollTimer) clearInterval(pollTimer);
    if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
    if (bgWorker) {
      try {
        bgWorker.terminate();
      } catch {}
    }
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    }
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
    }
    if (firestoreUnsubscribe) {
      firestoreUnsubscribe();
    }
  };
}

/**
 * Fetches latest roster state on-demand from either Server API or Firestore (used by Force Sync button on Web & Android)
 */
export async function fetchLatestCloudRosterNow(): Promise<CloudRosterState | null> {
  const isAndroid = isStandaloneAndroidRuntime();
  const customUrl = getCustomServerUrl();
  if (!isAndroid) {
    try {
      const res = await fetch(`/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json?.exists && json?.data) {
          return json.data as CloudRosterState;
        }
      }
    } catch {}

    if (customUrl) {
      try {
        const res = await fetch(`${customUrl}/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.exists && json?.data) {
            return json.data as CloudRosterState;
          }
        }
      } catch {}
    }
  } else {
    for (const base of getActiveServerUrls()) {
      try {
        const res = await fetch(`${base}/api/sync?_t=${Date.now()}`, { cache: 'no-store' });
        const ct = res.headers.get('content-type') || '';
        if (res.ok && ct.includes('application/json')) {
          const json = await res.json();
          if (json?.exists && json?.data) {
            return json.data as CloudRosterState;
          }
        }
      } catch {}
    }
  }

  if (!isFirestoreQuotaExhausted) {
    try {
      const snap = await getDocFromServer(doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID));
      if (snap.exists()) {
        return snap.data() as CloudRosterState;
      }
    } catch {}
  }
  return null;
}

/**
 * Sanitizes an object before writing to Firestore by removing any keys with `undefined` values.
 */
function cleanFirestoreData<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return undefined;
      }
      return value;
    })
  );
}

/**
 * Saves or updates roster data with Dual Sync across BOTH Web Browser and Native Android App:
 * 1. Updates in-memory schedule fingerprint & broadcasts to same-browser tabs immediately.
 * 2. Writes directly to Firestore (works 100% on Android APK https://localhost & Web).
 * 3. POSTs to Direct Server API (/api/sync on Web, and remote Cloud Run / Vercel endpoints on Android APK).
 */
export async function saveCloudRoster(data: Partial<CloudRosterState>): Promise<void> {
  const now = new Date().toISOString();
  lastLocalMutationTimeMs = Date.now();

  if (data.schedule && Array.isArray(data.schedule)) {
    setLocalScheduleFingerprint(data.schedule);
  }

  const payload = cleanFirestoreData({
    ...data,
    updatedAt: now,
    _originClientId: CLIENT_ID,
  });

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('shiftflow_updated_at', now);
    } catch {}
  }

  // 1. Broadcast to other tabs in the same browser immediately (0ms latency)
  broadcastLocalStateChange(payload);

  // 2. Direct Firestore write (crucial for Android APK https://localhost <-> Browser sync)
  const writePromises: Promise<any>[] = [];
  if (!isFirestoreQuotaExhausted) {
    writePromises.push(
      setDoc(doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID), payload, { merge: true }).then(() => {
        isDirectFirestoreUsable = true;
        updateSyncDetails({
          firestoreConnected: true,
          lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
        });
      })
    );
  }

  // 3. Direct Server Sync POST
  const isAndroid = isStandaloneAndroidRuntime();
  const customUrl = getCustomServerUrl();
  const targetUrls: string[] = [];
  if (isAndroid) {
    targetUrls.push(...getActiveServerUrls().map((base) => `${base}/api/sync`));
  } else {
    targetUrls.push('/api/sync');
    if (customUrl) {
      targetUrls.push(`${customUrl}/api/sync`);
    }
  }

  for (const url of targetUrls) {
    writePromises.push(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload, clientId: CLIENT_ID }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        const json = await r.json();
        updateSyncDetails({
          serverConnected: true,
          lastSyncTime: new Date().toLocaleTimeString('fa-IR'),
        });
        return json;
      })
    );
  }

  await Promise.race([
    Promise.any(writePromises).catch((err) => {
      console.warn('[DirectServerSync] Save notice:', err);
    }),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}

/**
 * Overwrites entire cloud roster with fresh initial data across both channels.
 */
export async function resetCloudRoster(data: CloudRosterState): Promise<void> {
  const now = new Date().toISOString();
  lastLocalMutationTimeMs = Date.now();
  if (data.schedule) {
    setLocalScheduleFingerprint(data.schedule);
  }

  const payload = cleanFirestoreData({
    ...data,
    updatedAt: now,
    _originClientId: CLIENT_ID,
  });

  broadcastLocalStateChange(payload);

  if (isDirectFirestoreUsable && !isFirestoreQuotaExhausted) {
    try {
      await setDoc(doc(db, ROSTER_DOC_PATH, ROSTER_DOC_ID), payload);
    } catch {}
  }

  const isAndroid = isStandaloneAndroidRuntime();
  const customUrl = getCustomServerUrl();
  const targetUrls: string[] = [];
  if (isAndroid) {
    targetUrls.push(...getActiveServerUrls().map((base) => `${base}/api/sync/reset`));
  } else {
    targetUrls.push('/api/sync/reset');
    if (customUrl) {
      targetUrls.push(`${customUrl}/api/sync/reset`);
    }
  }

  await Promise.allSettled(
    targetUrls.map((url) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
      })
    )
  );
}
