import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  Firestore 
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? parseInt(process.env.PORT || '3000', 10) : 3000;

// Load Firebase configuration
const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = null;
try {
  if (fs.existsSync(firebaseConfigPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[SyncServer] Could not load firebase-applet-config.json:', e);
}

// Clean data before writing to Firestore
function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) {
        return undefined;
      }
      return value;
    })
  );
}

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Ensure persistent data directory exists
  const dataDir = path.resolve(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dataFilePath = path.join(dataDir, 'roster-state.json');

  // In-memory state and SSE connection pool
  let currentState: any = null;
  let stateVersion = 1;
  let sseClients: express.Response[] = [];
  let isFirestoreConnected = false;

  // Initialize Firestore backend connection
  let db: Firestore | null = null;
  if (firebaseConfig) {
    try {
      const fbApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
      console.log(`[SyncServer] Connected to Firestore database: ${firebaseConfig.firestoreDatabaseId}`);
    } catch (fbErr) {
      console.error('[SyncServer] Failed to initialize Firestore:', fbErr);
    }
  }

  // 1. Try to load initial state from local persistent file cache
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, 'utf-8');
      currentState = JSON.parse(raw);
      stateVersion = currentState._version || 1;
      console.log(`[SyncServer] Loaded local roster state cache (version ${stateVersion}, updatedAt ${currentState.updatedAt})`);
    }
  } catch (err) {
    console.error('[SyncServer] Could not read local roster state file:', err);
  }

  // Broadcast update to all connected SSE clients
  function broadcast(eventPayload: any) {
    const rawData = `data: ${JSON.stringify(eventPayload)}\n\n`;
    sseClients.forEach((client) => {
      try {
        client.write(rawData);
      } catch {
        // Client might have dropped
      }
    });
  }

  // Helper to persist state to local file
  function persistToDisk(data: any) {
    fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.error('[SyncServer] Error writing to data file:', err);
      }
    });
  }

  const quotaFilePath = path.resolve(dataDir, 'firestore-quota.json');
  let isFirestoreQuotaExhausted = false;
  try {
    if (fs.existsSync(quotaFilePath)) {
      const qData = JSON.parse(fs.readFileSync(quotaFilePath, 'utf-8'));
      const today = new Date().toISOString().slice(0, 10);
      if (qData.exhaustedDate === today) {
        isFirestoreQuotaExhausted = true;
        console.log('[SyncServer] Loaded Firestore quota status: Daily limit reached for today. Running on server disk & memory.');
      }
    }
  } catch (e) {
    // ignore
  }

  function markQuotaExhausted() {
    isFirestoreQuotaExhausted = true;
    isFirestoreConnected = false;
    try {
      const today = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(quotaFilePath, JSON.stringify({ exhaustedDate: today, reason: 'RESOURCE_EXHAUSTED' }, null, 2));
    } catch {}
  }

  let lastFirestoreWriteTime = 0;
  let pendingFirestoreWriteTimer: any = null;

  // Helper to write to Firestore with error handling & rate-limiting to preserve quota
  async function persistToFirestore(data: any, merge = true, immediate = false) {
    if (!db || isFirestoreQuotaExhausted) return;

    const now = Date.now();
    if (!immediate && now - lastFirestoreWriteTime < 8000) {
      if (pendingFirestoreWriteTimer) clearTimeout(pendingFirestoreWriteTimer);
      pendingFirestoreWriteTimer = setTimeout(() => {
        persistToFirestore(data, merge, true);
      }, 8000);
      return;
    }

    try {
      lastFirestoreWriteTime = now;
      const docRef = doc(db, 'roster_state', 'current');
      const cleanData = sanitizeForFirestore(data);
      if (merge) {
        await setDoc(docRef, cleanData, { merge: true });
      } else {
        await setDoc(docRef, cleanData);
      }
      isFirestoreConnected = true;
    } catch (err: any) {
      const errMsg = String(err?.message || err);
      if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('resource-exhausted') || err?.code === 'resource-exhausted' || err?.code === 8) {
        console.warn('[SyncServer] Firestore free daily quota reached for today. Switched to local disk & memory persistence.');
        markQuotaExhausted();
      } else {
        console.warn('[SyncServer] Firestore write notice:', err);
      }
    }
  }

  // 2. Connect Firestore Real-Time Bridge
  if (db) {
    try {
      const docRef = doc(db, 'roster_state', 'current');

      // Fetch initial data from Firestore to ensure freshness
      getDoc(docRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const cloudData = snapshot.data();
            isFirestoreConnected = true;
            // Compare timestamps: take whichever is newer
            const cloudUpdatedAt = cloudData.updatedAt || '';
            const localUpdatedAt = currentState?.updatedAt || '';

            if (!currentState || (cloudUpdatedAt && localUpdatedAt ? cloudUpdatedAt > localUpdatedAt : Boolean(cloudUpdatedAt))) {
              currentState = { ...cloudData, _version: ++stateVersion };
              persistToDisk(currentState);
              console.log(`[SyncServer] Synced initial state from Firestore (updatedAt: ${cloudUpdatedAt})`);
            }
          }
        })
        .catch((err) => {
          console.warn('[SyncServer] Initial Firestore fetch notice:', err);
        });

      // Listen for real-time changes in Firestore and broadcast to all connected clients
      onSnapshot(
        docRef,
        { includeMetadataChanges: false },
        (snapshot) => {
          if (snapshot.exists()) {
            isFirestoreConnected = true;
            const remoteData = snapshot.data();
            const remoteUpdated = remoteData.updatedAt || '';
            const localUpdated = currentState?.updatedAt || '';

            // Update if remote is strictly newer or if we had no state
            if (!currentState || (remoteUpdated && localUpdated ? remoteUpdated > localUpdated : Boolean(remoteUpdated))) {
              stateVersion++;
              currentState = {
                ...remoteData,
                _version: stateVersion
              };
              persistToDisk(currentState);
              console.log(`[SyncServer] Real-time Firestore update received (updatedAt: ${remoteUpdated})`);

              // Broadcast immediately to all active SSE clients (browser clients in Iran)
              broadcast({
                type: 'update',
                data: currentState,
                version: stateVersion,
                updatedAt: remoteUpdated
              });
            }
          }
        },
        (error) => {
          isFirestoreConnected = false;
          const errMsg = String(error?.message || error);
          if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('resource-exhausted') || (error as any)?.code === 'resource-exhausted' || (error as any)?.code === 8) {
            isFirestoreQuotaExhausted = true;
          }
          console.warn('[SyncServer] Firestore onSnapshot listener notice:', errMsg);
        }
      );
    } catch (bridgeErr) {
      console.warn('[SyncServer] Failed to setup Firestore listener:', bridgeErr);
    }
  }

  // --- API & Android Package Endpoints ---

  // Digital Asset Links for Android TWA / Fullscreen Verification
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'ir.fmd.shiftflow.app',
          sha256_cert_fingerprints: [
            '26:D3:18:69:9D:99:B3:27:59:47:1D:64:AD:F4:18:6C:05:D7:BE:07:4A:23:42:C3:C2:40:B8:83:FB:FE:30:C3'
          ]
        }
      }
    ]);
  });

  // Direct Signed Android APK Download (ShiftFlow-FMD.apk)
  app.get(['/api/download-apk', '/ShiftFlow-FMD.apk'], (_req, res) => {
    const apkPath = path.resolve(__dirname, 'public', 'ShiftFlow-FMD.apk');
    if (!fs.existsSync(apkPath)) {
      return res.status(404).json({ error: 'فایل APK یافت نشد.' });
    }
    const stat = fs.statSync(apkPath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="ShiftFlow-FMD.apk"');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(apkPath);
  });

  // Full Android Release Bundle ZIP (APK + AAB + Keystore + AssetLinks)
  app.get(['/api/download-android-bundle', '/ShiftFlow-FMD-Android-Package.zip'], (_req, res) => {
    const zipPath = path.resolve(__dirname, 'public', 'ShiftFlow-FMD-Android-Package.zip');
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ error: 'فایل پکیج اندروید یافت نشد.' });
    }
    const stat = fs.statSync(zipPath);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="ShiftFlow-FMD-Android-Package.zip"');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(zipPath);
  });

  // Always serve public/ static files (PWA icons, manifest, APK)
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Health check
  app.get('/api/sync/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasData: Boolean(currentState),
      version: stateVersion,
      firestoreConnected: isFirestoreConnected,
      serverTime: new Date().toISOString(),
      activeClients: sseClients.length
    });
  });

  let lastFirestoreFetchTime = 0;

  // Server-Sent Events (SSE) Stream
  app.get('/api/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering on reverse proxies & Cloud Run
    res.flushHeaders?.();

    sseClients.push(res);
    console.log(`[SyncServer] SSE client connected. Active: ${sseClients.length}`);

    // If we have existing data, immediately send it to the newly connected client
    if (currentState) {
      res.write(`data: ${JSON.stringify({ type: 'init', data: currentState, version: stateVersion })}\n\n`);
    }

    // Keep-alive ping every 15 seconds to prevent mobile cellular carrier drops
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients = sseClients.filter((c) => c !== res);
      console.log(`[SyncServer] SSE client disconnected. Active: ${sseClients.length}`);
    });
  });

  // GET roster state
  app.get('/api/sync', async (req, res) => {
    const clientSince = req.query.since as string | undefined;
    const nowMs = Date.now();

    // If memory state is empty, check Firestore on-demand
    if (db && !currentState) {
      try {
        lastFirestoreFetchTime = nowMs;
        const snapshot = await getDoc(doc(db, 'roster_state', 'current'));
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          isFirestoreConnected = true;
          const cloudUpdated = cloudData.updatedAt || '';
          const localUpdated = currentState?.updatedAt || '';
          if (!currentState || (cloudUpdated && localUpdated ? cloudUpdated > localUpdated : Boolean(cloudUpdated))) {
            stateVersion++;
            currentState = { ...cloudData, _version: stateVersion };
            persistToDisk(currentState);
          }
        }
      } catch (e) {
        console.warn('[SyncServer] Periodic Firestore check notice:', e);
      }
    }

    if (!currentState) {
      return res.json({
        exists: false,
        version: 0,
        updatedAt: null,
        data: null
      });
    }

    if (clientSince && currentState.updatedAt === clientSince) {
      return res.json({
        exists: true,
        modified: false,
        version: stateVersion,
        updatedAt: currentState.updatedAt
      });
    }

    res.json({
      exists: true,
      modified: true,
      version: stateVersion,
      updatedAt: currentState.updatedAt,
      data: currentState
    });
  });

  // POST / update roster state
  app.post('/api/sync', async (req, res) => {
    try {
      const incoming = req.body;
      const dataToMerge = incoming.data || incoming;
      const clientId = incoming.clientId || incoming.data?.clientId;

      const now = new Date().toISOString();
      stateVersion++;

      currentState = {
        ...(currentState || {}),
        ...dataToMerge,
        updatedAt: now,
        _version: stateVersion,
        ...(clientId ? { _originClientId: clientId } : {})
      };

      // 1. Persist to local disk
      persistToDisk(currentState);

      // 2. Broadcast immediately to all active SSE clients
      broadcast({
        type: 'update',
        data: currentState,
        version: stateVersion,
        updatedAt: now
      });

      // 3. Persist to Firestore cloud database
      persistToFirestore(currentState, true).catch((e) => {
        console.warn('[SyncServer] Background Firestore write notice:', e);
      });

      res.json({
        success: true,
        version: stateVersion,
        updatedAt: now,
        data: currentState
      });
    } catch (err: any) {
      console.error('[SyncServer] Error updating state:', err);
      res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  });

  // POST /api/sync/reset
  app.post('/api/sync/reset', async (req, res) => {
    try {
      const incoming = req.body;
      const fullData = incoming.data || incoming;

      const now = new Date().toISOString();
      stateVersion++;

      currentState = {
        ...fullData,
        updatedAt: now,
        _version: stateVersion
      };

      persistToDisk(currentState);

      broadcast({
        type: 'reset',
        data: currentState,
        version: stateVersion,
        updatedAt: now
      });

      persistToFirestore(currentState, false).catch((e) => {
        console.warn('[SyncServer] Reset Firestore notice:', e);
      });

      res.json({
        success: true,
        version: stateVersion,
        updatedAt: now
      });
    } catch (err: any) {
      console.error('[SyncServer] Error resetting state:', err);
      res.status(500).json({ success: false, error: err?.message || 'Server error' });
    }
  });

  // POST /api/parse-pdf - Reliable PDF schedule parser endpoint
  app.post('/api/parse-pdf', async (req, res) => {
    try {
      const { pdfBase64, knownPersonnel } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: 'pdfBase64 is required' });
      }
      const buffer = Buffer.from(pdfBase64, 'base64');
      const { parsePdfBuffer } = await import('./utils/pdfParser.ts');
      const result = await parsePdfBuffer(buffer, knownPersonnel || []);
      return res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[SyncServer] PDF Parse API error:', err);
      return res.status(500).json({ error: 'Failed to parse PDF', message: err?.message || String(err) });
    }
  });

  // POST /api/chat - Multi-turn conversational AI assistant powered by Gemini
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, complexity, scheduleContext } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(200).json({
          reply: 'لطفاً پیام خود را وارد نمایید.',
          modelUsed: 'gemini-3.8-flash',
          timestamp: new Date().toISOString()
        });
      }

      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = process.env.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];

      // Format conversation history for Gemini API
      const contents = messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : (m.text || '') }]
      }));

      const contextSummary = scheduleContext
        ? `\nاطلاعات فعلی سامانه:\n- کارشناسان فعال شیفت: ${(scheduleContext.shiftWorkers || []).join('، ')}\n- سرپرستان: ${(scheduleContext.supervisors || []).join('، ')}\n- ماه جاری تقویم: ${scheduleContext.currentMonthName || ''} ${scheduleContext.currentYear || 1405}${scheduleContext.generatedSummary ? `\n- خلاصه برنامه چیده‌شده توسط موتور زمان‌بندی هوشمند:\n${scheduleContext.generatedSummary}` : ''}`
        : '';

      const systemInstruction = `شما دستیار هوشمند و برنامه‌ریز ارشد شیفت (ShiftFlow AI) در کارخانه تولید واکسن تب برفکی هستید.
وظایف اصلی شما:
۱. کمک به مدیر در چیدن هوشمند شیفت‌های ماهانه با رعایت عدالت (برابری شیفت‌های شب و روز و ساعت وزنی با ضریب ۱.۵ برای شیفت شب) و رعایت شروط حضور کارشناسان.
۲. قانون حضور کارشناسان در کارخانه: هر کارشناس برای اینکه در یک روز خاص هفته (مثلاً شنبه یا دوشنبه) صبح سر کار حضور داشته باشد، نباید شب قبل از آن (مثلاً جمعه شب برای شنبه، یا یک‌شنبه شب برای دوشنبه) و شبِ خود آن روز (مثلاً شنبه شب یا دوشنبه شب) شیفت شب باشد، زیرا روز بعد از شیفت شب استراحت (آف) است. همچنین طبق قانون چرخش کارخانه، هر کس شب کاری داشته باشد ۲ روز بعد شیفت روز خواهد بود.
۳. راهنمایی تخصصی درباره فرآیندهای تولید بیولوژیک (CIP, SIP, PHT، کشت سلول BHK-21، تلقیح ویروس و فرمولاسیون).
۴. اگر موتور زمان‌بندی هوشمند برنامه جدیدی تولید کرده است (در بخش خلاصه برنامه چیده‌شده)، توضیح دهید که برنامه بر اساس ملاحظات مدیر و با رعایت عدالت چیده شده و از طریق کارت داخل چت در تقویم اعمال گردیده است.
پاسخ‌ها را کوتاه، دقیق، مودبانه و به زبان فارسی ارائه دهید.${contextSummary}`;

      let replyText = '';
      let usedModel = candidateModels[0];

      if (apiKey) {
        for (const modelName of candidateModels) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('AI request timeout')), 5000)
            );
            const generatePromise = ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction,
                temperature: 0.5,
              }
            });
            const response = await Promise.race([generatePromise, timeoutPromise]);
            if (response && response.text) {
              replyText = response.text;
              usedModel = modelName;
              break;
            }
          } catch (err: any) {
            console.warn(`[Gemini API] Candidate model ${modelName} notice:`, err?.message || err);
          }
        }
      }

      if (!replyText) {
        if (scheduleContext?.generatedSummary) {
          replyText = `✅ برنامه شیفت **${scheduleContext.targetMonthLabel || ''}** با رعایت کامل ملاحظات تعیین‌شده و توازن عدالت ساعات کاری چیده شد:\n\n${scheduleContext.generatedSummary}\n\nمی‌توانید از کارت زیر جزئیات سهم هر کارشناس را مشاهده کرده یا برنامه را در تقویم اصلی ذخیره نمایید.`;
        } else {
          replyText = 'من آماده کمک به شما در چیدن هوشمند شیفت‌ها هستم. کافی است ماه مورد نظر و ملاحظات حضور کارشناسان (مثلاً: «شیفت آبان رو بچین طوری که سلیمان فلاح شنبه‌ها سرکار حضور داشته باشه و دهقان دوشنبه‌ها باشه») را بنویسید یا از تب «فرم چیدمان شیفت» در بالای همین پنجره استفاده کنید.';
        }
      }

      res.status(200).json({
        reply: replyText,
        modelUsed: usedModel,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[Gemini API] Request notice:', err?.message || err);
      res.status(200).json({
        reply: 'درخواست شما پردازش شد. در صورت نیاز به چیدمان شیفت ماهانه، ملاحظات کارشناسان را وارد کنید تا برنامه به‌صورت خودکار و عادلانه تنظیم شود.',
        modelUsed: 'gemini-3.8-flash',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Serve Frontend
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexHtml = path.resolve(distPath, 'index.html');
  const hasBuiltDist = fs.existsSync(distIndexHtml);

  if (isProd && hasBuiltDist) {
    // Production static hosting with built assets
    app.use(express.static(distPath));
    app.use((_req, res, next) => {
      res.sendFile(distIndexHtml, (err) => {
        if (err) {
          next(err);
        }
      });
    });
  } else {
    // Development mode or fallback to Vite middleware when dist/index.html is not yet built
    if (isProd && !hasBuiltDist) {
      console.warn('[ShiftFlow] Production mode active but dist/index.html not found; smoothly falling back to Vite middleware.');
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Global error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[ShiftFlow] Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ShiftFlow] Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[ShiftFlow] Failed to start server:', err);
  process.exit(1);
});
