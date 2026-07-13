/**
 * REELIX – CENTRAL GATEWAY INFRASTRUCTURE WORKER
 * - Selar payment webhooks (POST / or /webhook)
 * - Secure customer account activation claims (POST /api/claim)
 * - TMDB metadata security proxy layer (GET /api/tmdb)
 */

let cachedToken = '';
let cachedTokenExpiry = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Normalize path: convert to lowercase and remove trailing slash
    const path = url.pathname.replace(/\/$/, '').toLowerCase();

    // ── 1. GLOBAL CORS PREFLIGHT HANDLER ──
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // ── 2. TMDB SECURE PROXY ROUTE (GET /api/tmdb) ──
      if ((path === '/api/tmdb' || path === '/tmdb') && request.method === 'GET') {
        const endpoint = url.searchParams.get('endpoint');
        if (!endpoint) {
          return jsonResponse(env, { error: 'Missing endpoint path' }, 400);
        }

        if (!env.TMDB_API_KEY) {
          console.error("CRITICAL CONFIG ERROR: env.TMDB_API_KEY is not defined.");
          return jsonResponse(env, { error: 'Proxy token configuration missing' }, 500);
        }

        // Forward all inbound query parameters except 'endpoint'
        const targetParams = new URLSearchParams(url.search);
        targetParams.delete('endpoint');
        targetParams.set('api_key', env.TMDB_API_KEY);

        const tmdbTargetUrl = `https://api.themoviedb.org/3${endpoint}?${targetParams.toString()}`;
        
        const tmdbResponse = await fetch(tmdbTargetUrl);
        const tmdbData = await tmdbResponse.json();

        return jsonResponse(env, tmdbData, tmdbResponse.status);
      }

      // ── 3. ACCOUNT SUBSCRIPTION ACTIVATION CLAIM ROUTE (POST /api/claim) ──
      if (path === '/claim' || path === '/api/claim') {
        if (request.method !== 'POST') {
          return jsonResponse(env, { error: 'Method not allowed' }, 405);
        }
        return await handleClaim(request, env);
      }

      // ── 4. SELAR WEBHOOK ROUTE (POST / or /webhook) ──
      if (path === '' || path === '/' || path === '/webhook' || path === '/api/webhook') {
        if (request.method !== 'POST') {
          return jsonResponse(env, { error: 'Method not allowed' }, 405);
        }
        return await handleSelarWebhook(request, env);
      }

      // 404 Fallback
      return jsonResponse(env, { error: `Endpoint route context match not found for path: ${path}` }, 404);

    } catch (error) {
      console.error('SERVER LEVEL EXCEPTION CRASH:', error);
      return jsonResponse(env, {
        error: 'Internal Gateway Server Error',
        details: error.message
      }, 500);
    }
  }
};

// ─────────────────────────────────────────────────────────────────
// STRATEGIC IMPLEMENTATION CORE PIPELINES
// ─────────────────────────────────────────────────────────────────

async function handleClaim(request, env) {
  const { idToken, code } = await request.json();
  if (!idToken || !code) {
    return jsonResponse(env, { error: 'Missing parameter fields' }, 400);
  }

  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) {
    return jsonResponse(env, { error: 'Server initialization variables unconfigured' }, 500);
  }

  // Validate the client user ID session token with the identity kit engine
  const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`;
  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    body: JSON.stringify({ idToken }),
    headers: { 'Content-Type': 'application/json' }
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.users || verifyData.users.length === 0) {
    return jsonResponse(env, { error: 'Authentication token check failed: Session invalid' }, 401);
  }

  const uid = verifyData.users[0].localId;
  const targetCode = code.trim().toUpperCase();

  // Read code check record using FireStore access token layer
  const oauthToken = await getGoogleOAuthToken(env);
  const pendingDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/pending_activations/${targetCode}`;

  const pendingRes = await fetch(pendingDocUrl, {
    headers: { 'Authorization': `Bearer ${oauthToken}` }
  });

  if (pendingRes.status === 404) {
    return jsonResponse(env, { error: 'Invalid activation token code. Please double-check.' }, 404);
  }

  if (!pendingRes.ok) {
    return jsonResponse(env, { error: 'Database checking read runtime transaction failure' }, 500);
  }

  const pendingDoc = await pendingRes.json();
  const fields = pendingDoc.fields;
  
  if (!fields || fields.status?.stringValue === 'claimed') {
    return jsonResponse(env, { error: 'This activation code has already been linked to an account.' }, 400);
  }

  const email = fields.email?.stringValue || '';
  const planDuration = fields.planDuration?.stringValue || 'monthly';
  
  const monthsToAdd = planDuration === 'yearly' ? 12 : 1;
  const endTimestamp = new Date();
  endTimestamp.setMonth(endTimestamp.getMonth() + monthsToAdd);

  // Write 1: Update client destination user file structure configuration profiles
  const userDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=plan&updateMask.fieldPaths=planDuration&updateMask.fieldPaths=subscriptionEnd&updateMask.fieldPaths=activatedAt&updateMask.fieldPaths=email`;
  
  const userPayload = {
    fields: {
      email: { stringValue: email },
      plan: { stringValue: 'active' },
      planDuration: { stringValue: planDuration },
      subscriptionEnd: { stringValue: endTimestamp.toISOString() },
      activatedAt: { stringValue: new Date().toISOString() }
    }
  };

  const userWriteRes = await fetch(userDocUrl, {
    method: 'PATCH',
    body: JSON.stringify(userPayload),
    headers: {
      'Authorization': `Bearer ${oauthToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!userWriteRes.ok) {
    return jsonResponse(env, { error: 'Account database mapping propagation error' }, 500);
  }

  // Write 2: Nullify code usability mapping records
  const updatePendingPayload = {
    fields: {
      ...fields,
      status: { stringValue: 'claimed' },
      claimedByUid: { stringValue: uid },
      claimedAt: { stringValue: new Date().toISOString() }
    }
  };

  await fetch(`${pendingDocUrl}?updateMask.fieldPaths=status&updateMask.fieldPaths=claimedByUid&updateMask.fieldPaths=claimedAt`, {
    method: 'PATCH',
    body: JSON.stringify(updatePendingPayload),
    headers: {
      'Authorization': `Bearer ${oauthToken}`,
      'Content-Type': 'application/json'
    }
  });

  return jsonResponse(env, { success: true, plan: 'active', subscriptionEnd: endTimestamp.toISOString() });
}

async function handleSelarWebhook(request, env) {
  const bodyText = await request.text();
  const json = JSON.parse(bodyText);

  if (env.SELAR_SECRET) {
    const inboundSig = request.headers.get('X-Selar-Signature') || json.webhook_secret;
    if (inboundSig !== env.SELAR_SECRET) {
      return new Response('Unauthorized Signature Handshake Mismatch', { status: 401 });
    }
  }

  const email = json.customer?.email;
  const reference = json.reference;
  if (!email || !reference) {
    return new Response('Incomplete tracking identifiers', { status: 200 });
  }

  let planDuration = 'monthly';
  if (JSON.stringify(json.items).toLowerCase().includes('year')) {
    planDuration = 'yearly';
  }

  const secureCodeToken = reference.trim().toUpperCase();
  const oauthToken = await getGoogleOAuthToken(env);
  const pendingDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/pending_activations/${secureCodeToken}`;

  const checkRes = await fetch(pendingDocUrl, {
    headers: { 'Authorization': `Bearer ${oauthToken}` }
  });

  if (checkRes.status === 200) {
    return new Response('Duplicate transaction registration reference blocked', { status: 200 });
  }

  const pendingPayload = {
    fields: {
      email: { stringValue: email },
      reference: { stringValue: reference },
      planDuration: { stringValue: planDuration },
      status: { stringValue: 'pending' },
      createdAt: { stringValue: new Date().toISOString() }
    }
  };

  await fetch(pendingDocUrl, {
    method: 'PATCH',
    body: JSON.stringify(pendingPayload),
    headers: {
      'Authorization': `Bearer ${oauthToken}`,
      'Content-Type': 'application/json'
    }
  });

  return new Response('Webhook completed successfully', { status: 200 });
}

// ─────────────────────────────────────────────────────────────────
// CRYPTOGRAPHIC ACCESS TOKEN PIPELINES
// ─────────────────────────────────────────────────────────────────

async function getGoogleOAuthToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpiry) {
    return cachedToken;
  }

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Service authorization variables are unconfigured inside dashboard.');
  }

  const rawKey = env.FIREBASE_PRIVATE_KEY;
  const normalizedKey = rawKey.replace(/\\n/g, '\n');

  const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const jwtClaimSet = btoa(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).replace(/=/g, '');

  const unsignedToken = `${jwtHeader.replace(/=/g, '')}.${jwtClaimSet}`;
  const signatureKey = await importPrivateKey(normalizedKey);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    signatureKey,
    new TextEncoder().encode(unsignedToken)
  );

  const base64Signature = arrayBufferToBase64Url(signatureBuffer);
  const completeSignedJwt = `${unsignedToken}.${base64Signature}`;

  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const tokenRequestParams = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(completeSignedJwt)}`;

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    body: tokenRequestParams,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error('Google OAuth token handshake exception: ' + JSON.stringify(data));
  }

  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonResponse(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
