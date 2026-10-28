/**
 * Universal Vercel Sync Handler (Dual Edge + Node.js Support, Pure REST)
 * Bypasses network filtering & censorship in Iran by proxying through Vercel.
 * Works seamlessly in both Vercel Edge Runtime and Vercel Node.js Serverless Functions.
 */

const FIRESTORE_PROJECT_ID = 'beaming-source-hcbh2';
const FIRESTORE_DATABASE_ID = 'ai-studio-fmdproductionshi-3f0608ec-b995-44d1-a9c8-f98c589f0e16';
const FIRESTORE_DOC_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/roster_state/current`;

function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    const list = val.arrayValue?.values || [];
    return list.map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: any = {};
    const fields = val.mapValue?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = decodeFirestoreValue(v);
    }
    return res;
  }
  return val;
}

function decodeFirestoreDoc(doc: any): any {
  if (!doc || !doc.fields) return null;
  const res: any = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    res[k] = decodeFirestoreValue(v);
  }
  return res;
}

function encodeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: any = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function encodeFirestoreDoc(data: any): any {
  const fields: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return { fields };
}

// In-memory cache across warm invocations
let memoryCache: any = null;
let lastFirestoreReadTime = 0;
const CACHE_TTL_MS = 8000;

async function fetchFromFirestore(): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(FIRESTORE_DOC_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`Firestore REST returned ${res.status}: ${res.statusText}`);
    }
    const doc = await res.json();
    return decodeFirestoreDoc(doc);
  } finally {
    clearTimeout(timeoutId);
  }
}

let isVercelFirestoreQuotaExhausted = false;
let lastVercelQuotaCheckTime = 0;

async function writeToFirestore(data: any, merge = true): Promise<void> {
  const now = Date.now();
  if (isVercelFirestoreQuotaExhausted) {
    // Retry only once every hour
    if (now - lastVercelQuotaCheckTime < 3600000) return;
    isVercelFirestoreQuotaExhausted = false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  try {
    const encoded = encodeFirestoreDoc(data);
    let url = FIRESTORE_DOC_URL;
    if (merge) {
      const fieldPaths = Object.keys(data)
        .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
        .join('&');
      url += `?${fieldPaths}`;
    }
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encoded),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 429 || errText.includes('RESOURCE_EXHAUSTED') || errText.includes('Quota limit exceeded')) {
        isVercelFirestoreQuotaExhausted = true;
        lastVercelQuotaCheckTime = now;
        console.warn('[VercelSync] Firestore daily write quota reached. Maintained in-memory cache.');
        return;
      }
      console.warn(`[VercelSync] Firestore write notice (${res.status}): ${errText}`);
    }
  } catch (err: any) {
    console.warn('[VercelSync] Firestore write notice:', err?.message || err);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Handler for Vercel Edge Runtime (standard web Request -> Response)
async function handleEdge(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Accept',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const isReset = url.pathname.includes('/reset') || url.searchParams.get('action') === 'reset';
  const isHealth = url.pathname.includes('/health') || url.searchParams.get('action') === 'health';
  const isStream = url.pathname.includes('/stream') || req.headers.get('accept') === 'text/event-stream';

  if (isHealth) {
    return new Response(
      JSON.stringify({
        status: 'ok',
        platform: 'vercel-edge',
        directRest: true,
        cachedItems: memoryCache?.schedule?.length || 0,
        serverTime: new Date().toISOString()
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  if (isStream && method === 'GET') {
    if (!memoryCache) {
      try {
        memoryCache = await fetchFromFirestore();
        lastFirestoreReadTime = Date.now();
      } catch (e) {
        console.warn('[VercelSync] Edge SSE fetch error:', e);
      }
    }
    return new Response(
      `data: ${JSON.stringify({ type: 'init', data: memoryCache, version: 1 })}\n\n`,
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Connection': 'keep-alive'
        }
      }
    );
  }

  if (method === 'GET') {
    const clientSince = url.searchParams.get('since');
    const now = Date.now();

    if (!memoryCache || (now - lastFirestoreReadTime > CACHE_TTL_MS)) {
      try {
        const freshData = await fetchFromFirestore();
        if (freshData && freshData.schedule) {
          memoryCache = freshData;
          lastFirestoreReadTime = now;
        }
      } catch (fetchErr: any) {
        console.warn('[VercelSync] Edge Firestore read notice:', fetchErr?.message || fetchErr);
      }
    }

    if (memoryCache) {
      const updatedAt = memoryCache.updatedAt || '';
      if (clientSince && updatedAt && updatedAt === clientSince) {
        return new Response(
          JSON.stringify({ exists: true, modified: false, version: 1, updatedAt }),
          { status: 200, headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ exists: true, modified: true, version: 1, updatedAt, data: memoryCache }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ exists: false, data: null }),
      { status: 200, headers: corsHeaders }
    );
  }

  if (method === 'POST') {
    let bodyData: any = {};
    try {
      bodyData = await req.json();
    } catch {
      bodyData = {};
    }

    const incoming = bodyData?.data || bodyData || {};
    const now = new Date().toISOString();
    const payload = {
      ...(isReset ? {} : (memoryCache || {})),
      ...incoming,
      updatedAt: now
    };

    memoryCache = payload;
    lastFirestoreReadTime = Date.now();

    writeToFirestore(payload, !isReset).catch((err) => {
      console.warn('[VercelSync] Edge async Firestore write error:', err);
    });

    return new Response(
      JSON.stringify({ success: true, version: 1, updatedAt: now, data: payload }),
      { status: 200, headers: corsHeaders }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
}

// Handler for Vercel Node.js Serverless Function (IncomingMessage, ServerResponse)
async function handleNode(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Accept');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const isReset = url.includes('/reset') || req.query?.action === 'reset';
  const isHealth = url.includes('/health') || req.query?.action === 'health';
  const isStream = url.includes('/stream') || req.headers?.['accept'] === 'text/event-stream';

  if (isHealth) {
    return res.status(200).json({
      status: 'ok',
      platform: 'vercel-node',
      directRest: true,
      cachedItems: memoryCache?.schedule?.length || 0,
      serverTime: new Date().toISOString()
    });
  }

  if (isStream && req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Connection', 'keep-alive');
    if (!memoryCache) {
      try {
        memoryCache = await fetchFromFirestore();
        lastFirestoreReadTime = Date.now();
      } catch (e) {
        console.warn('[VercelSync] Node SSE fetch error:', e);
      }
    }
    res.write(`data: ${JSON.stringify({ type: 'init', data: memoryCache, version: 1 })}\n\n`);
    return res.end();
  }

  if (req.method === 'GET') {
    const clientSince = req.query?.since as string | undefined;
    const now = Date.now();

    if (!memoryCache || (now - lastFirestoreReadTime > CACHE_TTL_MS)) {
      try {
        const freshData = await fetchFromFirestore();
        if (freshData && freshData.schedule) {
          memoryCache = freshData;
          lastFirestoreReadTime = now;
        }
      } catch (fetchErr: any) {
        console.warn('[VercelSync] Node Firestore read notice:', fetchErr?.message || fetchErr);
      }
    }

    if (memoryCache) {
      const updatedAt = memoryCache.updatedAt || '';
      if (clientSince && updatedAt && updatedAt === clientSince) {
        return res.status(200).json({ exists: true, modified: false, version: 1, updatedAt });
      }
      return res.status(200).json({ exists: true, modified: true, version: 1, updatedAt, data: memoryCache });
    }

    return res.status(200).json({ exists: false, data: null });
  }

  if (req.method === 'POST') {
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch {
        bodyData = {};
      }
    }

    const incoming = bodyData?.data || bodyData || {};
    const now = new Date().toISOString();
    const payload = {
      ...(isReset ? {} : (memoryCache || {})),
      ...incoming,
      updatedAt: now
    };

    memoryCache = payload;
    lastFirestoreReadTime = Date.now();

    writeToFirestore(payload, !isReset).catch((err) => {
      console.warn('[VercelSync] Node async Firestore write error:', err);
    });

    return res.status(200).json({ success: true, version: 1, updatedAt: now, data: payload });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Universal entry point supporting both Edge and Node environments
export default async function handler(req: any, res?: any) {
  try {
    if (!res || typeof res.status !== 'function') {
      return await handleEdge(req);
    }
    return await handleNode(req, res);
  } catch (error: any) {
    console.error('[VercelSync] Universal handler error:', error);
    if (!res || typeof res.status !== 'function') {
      return new Response(
        JSON.stringify({
          exists: true,
          modified: true,
          version: 1,
          updatedAt: memoryCache?.updatedAt || new Date().toISOString(),
          data: memoryCache
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
    return res.status(200).json({
      exists: true,
      modified: true,
      version: 1,
      updatedAt: memoryCache?.updatedAt || new Date().toISOString(),
      data: memoryCache
    });
  }
}
