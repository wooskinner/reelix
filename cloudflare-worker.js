/**
 * Reelix – Selar Webhook Handler + Activation Claim Endpoint
 * Deploy this as a Cloudflare Worker.
 *
 * ── ROUTES ──
 *   POST /            → Selar payment webhook (activates or queues a subscription)
 *   POST /claim-activation → called by activate.html after sign-in/sign-up to
 *                            securely promote a pending payment onto the
 *                            signed-in account. This is the ONLY path that
 *                            grants an active subscription besides the
 *                            webhook itself — the client can never do this
 *                            directly against Firestore.
 *
 * ── ENV VARS to set in Cloudflare Worker Settings → Variables ──
 *   FIREBASE_PROJECT_ID     → reelix-ffa51
 *   FIREBASE_API_KEY        → your Firebase Web API key (used only to verify
 *                              ID tokens via Identity Toolkit, not for writes)
 *   FIREBASE_CLIENT_EMAIL   → client_email from your service account JSON
 *   FIREBASE_PRIVATE_KEY    → private_key from your service account JSON
 *                              (paste with real newlines — Cloudflare secrets
 *                              support multiline values)
 *   SELAR_SECRET             → the secret string you configure in Selar's
 *                               webhook settings
 *   ALLOWED_ORIGIN           → https://www.reelix.2bd.net
 *
 * All Firestore writes now go through a real Google OAuth2 access token
 * (service account), not a bare API key. API keys alone do NOT authenticate
 * Firestore writes — they're only a routing/quota parameter — so any writes
 * that were succeeding with just `?key=` meant Firestore rules were wide
 * open to unauthenticated requests. Lock down firestore.rules alongside
 * this change (see the rules block Claude gave you separately).
 */

const PLAN_DAYS = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 };

const PRODUCT_SLUGS = {
  '1c7tz476t8': '1m',
  '851861q275': '3m',
  '6487z415ih': '6m',
  '5rc8s61861': '12m',
};

const PRICE_TO_PLAN = { 3: '1m', 6: '3m', 9: '6m', 18: '12m' };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === '/claim-activation' && request.method === 'POST') {
      try {
        return await handleClaim(request, env);
      } catch (err) {
        console.error('Claim error:', err);
        return jsonResponse(env, { error: 'Server error' }, 500);
      }
    }

    // ── Everything else: treat as the Selar webhook ──
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    console.log('Selar webhook payload:', JSON.stringify(payload));

    // ── Verify Selar secret token ──
    if (env.SELAR_SECRET) {
      let incomingSecret =
        request.headers.get('x-selar-token') ||
        request.headers.get('x-selar-signature') ||
        request.headers.get('x-api-key') ||
        request.headers.get('api-key') ||
        request.headers.get('authorization') ||
        payload.secret ||
        payload.token ||
        payload.selar_token ||
        payload.api_key ||
        null;

      if (incomingSecret && incomingSecret.toLowerCase().startsWith('bearer ')) {
        incomingSecret = incomingSecret.slice(7).trim();
      }

      if (incomingSecret !== env.SELAR_SECRET) {
        console.warn('Webhook rejected — secret mismatch or missing. Got:', incomingSecret);
        return new Response('Unauthorized', { status: 401 });
      }
    } else {
      console.warn('SELAR_SECRET env var not set — skipping secret verification. Set it before going live.');
    }

    const email =
      payload.buyer_email ||
      payload.customer_email ||
      payload.email ||
      (payload.customer && payload.customer.email) ||
      null;

    if (!email) {
      console.error('No email found in payload');
      return new Response('No email in payload', { status: 400 });
    }

    const planDuration = detectPlan(payload);
    const now = new Date();
    const days = PLAN_DAYS[planDuration];
    const subscriptionEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    try {
      const accessToken = await getAccessToken(env);
      const activated = await activateUserByEmail(
        email,
        subscriptionEnd.toISOString(),
        planDuration,
        env,
        accessToken
      );

      if (!activated) {
        await storePendingActivation(email, subscriptionEnd.toISOString(), planDuration, env, accessToken);
        console.log(`No user found for ${email} — stored as pending activation (${planDuration})`);
      }

      return new Response(JSON.stringify({ success: true, email, plan: planDuration }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Firestore error:', err);
      return new Response('Firestore error: ' + err.message, { status: 500 });
    }
  },
};

// ────────────────────────────────────────────────
// /claim-activation handler
// Called by activate.html after the user is signed in. Verifies their
// Firebase ID token server-side, then either confirms an already-active
// account or promotes a matching pending_activations record onto it.
// This is the only path (besides the webhook) that can set plan:'active'.
// ────────────────────────────────────────────────
async function handleClaim(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON' }, 400);
  }

  const idToken = body.idToken;
  if (!idToken) return jsonResponse(env, { error: 'Missing idToken' }, 400);

  // Verify the token is real and get the uid/email it belongs to.
  // Google verifies the token signature server-side here — a forged
  // or expired token will simply fail this lookup.
  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const lookupData = await lookupRes.json();
  const account = lookupData.users && lookupData.users[0];
  if (!account) return jsonResponse(env, { error: 'Invalid session, please sign in again' }, 401);

  const uid = account.localId;
  const email = (account.email || '').toLowerCase().trim();
  const accessToken = await getAccessToken(env);
  const projectId = env.FIREBASE_PROJECT_ID;

  // 1. Already active? (e.g. webhook matched them directly by email)
  const userDoc = await firestoreGet(projectId, `users/${uid}`, accessToken);
  if (userDoc && userDoc.fields && userDoc.fields.plan && userDoc.fields.plan.stringValue === 'active') {
    return jsonResponse(env, {
      activated: true,
      plan: userDoc.fields.planDuration ? userDoc.fields.planDuration.stringValue : null,
      subscriptionEnd: userDoc.fields.subscriptionEnd ? userDoc.fields.subscriptionEnd.stringValue : null,
    });
  }

  // 2. Look for a pending activation matching this email
  const docId = email.replace(/[^a-z0-9]/g, '_');
  const pending = await firestoreGet(projectId, `pending_activations/${docId}`, accessToken);

  if (!pending || !pending.fields) {
    return jsonResponse(env, { activated: false, reason: 'no-pending-payment' });
  }

  const planDuration = pending.fields.planDuration.stringValue;
  const subscriptionEnd = pending.fields.subscriptionEnd.stringValue;

  // 3. Promote — write the active subscription onto the real user doc
  await firestorePatch(
    projectId,
    `users/${uid}`,
    accessToken,
    {
      email: { stringValue: email },
      plan: { stringValue: 'active' },
      planDuration: { stringValue: planDuration },
      subscriptionEnd: { stringValue: subscriptionEnd },
      activatedAt: { stringValue: new Date().toISOString() },
    },
    ['email', 'plan', 'planDuration', 'subscriptionEnd', 'activatedAt']
  );

  // 4. Clean up the pending record
  await firestoreDelete(projectId, `pending_activations/${docId}`, accessToken);

  return jsonResponse(env, { activated: true, plan: planDuration, subscriptionEnd });
}

// ────────────────────────────────────────────────
// Work out which plan (1m / 3m / 6m / 12m) the Selar payload corresponds to.
// ────────────────────────────────────────────────
function detectPlan(payload) {
  const productRefCandidates = [
    payload.product_url,
    payload.product_link,
    payload.product_id,
    payload.product_slug,
    payload.product && payload.product.id,
    payload.product && payload.product.slug,
    payload.product && payload.product.url,
    payload.item_id,
  ].filter(Boolean).map(String);

  for (const ref of productRefCandidates) {
    for (const [slug, plan] of Object.entries(PRODUCT_SLUGS)) {
      if (ref.includes(slug)) return plan;
    }
  }

  const nameCandidates = [
    payload.product_name,
    payload.product_title,
    payload.item_name,
    payload.product && payload.product.name,
    payload.product && payload.product.title,
  ].filter(Boolean).map(s => String(s).toLowerCase());

  for (const name of nameCandidates) {
    if (name.includes('12 month') || name.includes('12-month') || name.includes('1 year') || name.includes('annual')) return '12m';
    if (name.includes('6 month') || name.includes('6-month')) return '6m';
    if (name.includes('3 month') || name.includes('3-month') || name.includes('quarter')) return '3m';
    if (name.includes('1 month') || name.includes('1-month') || name.includes('monthly')) return '1m';
  }

  const amountCandidates = [
    payload.amount,
    payload.price,
    payload.total,
    payload.total_amount,
  ].filter(v => v !== undefined && v !== null);

  for (const raw of amountCandidates) {
    const num = Math.round(parseFloat(raw));
    if (PRICE_TO_PLAN[num]) return PRICE_TO_PLAN[num];
  }

  console.warn('Could not determine plan from payload — defaulting to 1m.');
  return '1m';
}

// ────────────────────────────────────────────────
// Query Firestore for a user doc matching the email, then activate it
// ────────────────────────────────────────────────
async function activateUserByEmail(email, subscriptionEnd, planDuration, env, accessToken) {
  const projectId = env.FIREBASE_PROJECT_ID;

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'email' },
          op: 'EQUAL',
          value: { stringValue: email.toLowerCase().trim() },
        },
      },
      limit: 1,
    },
  };

  const queryRes = await fetch(queryUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryBody),
  });

  const queryData = await queryRes.json();
  console.log('Firestore query result:', JSON.stringify(queryData));

  const firstResult = queryData[0];
  if (!firstResult || !firstResult.document) return false;

  const docPath = firstResult.document.name.split('/documents/')[1]; // e.g. "users/UID"

  await firestorePatch(
    projectId,
    docPath,
    accessToken,
    {
      plan: { stringValue: 'active' },
      planDuration: { stringValue: planDuration },
      subscriptionEnd: { stringValue: subscriptionEnd },
      activatedAt: { stringValue: new Date().toISOString() },
    },
    ['plan', 'planDuration', 'subscriptionEnd', 'activatedAt']
  );

  console.log(`✅ Activated ${planDuration} subscription for ${email} until ${subscriptionEnd}`);
  return true;
}

async function storePendingActivation(email, subscriptionEnd, planDuration, env, accessToken) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const docId = email.toLowerCase().replace(/[^a-z0-9]/g, '_');

  await firestorePatch(
    projectId,
    `pending_activations/${docId}`,
    accessToken,
    {
      email: { stringValue: email.toLowerCase().trim() },
      planDuration: { stringValue: planDuration },
      subscriptionEnd: { stringValue: subscriptionEnd },
      createdAt: { stringValue: new Date().toISOString() },
    },
    ['email', 'planDuration', 'subscriptionEnd', 'createdAt']
  );
}

// ────────────────────────────────────────────────
// Firestore REST helpers (all authenticated with the service-account
// access token — no more relying on the bare API key for writes)
// ────────────────────────────────────────────────
async function firestoreGet(projectId, path, accessToken) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Firestore GET failed: ' + (await res.text()));
  return res.json();
}

async function firestorePatch(projectId, path, accessToken, fields, fieldPaths) {
  const mask = fieldPaths.map(f => `updateMask.fieldPaths=${f}`).join('&');
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}?${mask}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) throw new Error('Firestore PATCH failed: ' + (await res.text()));
  return res.json();
}

async function firestoreDelete(projectId, path, accessToken) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  ).catch(() => {});
}

// ────────────────────────────────────────────────
// Google service-account OAuth2 access token (signed JWT bearer flow)
// Cached in module scope for the life of the Worker isolate.
// ────────────────────────────────────────────────
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiry - 60 > now) return cachedToken;

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = obj =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${encode(header)}.${encode(claim)}`;

  const key = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${arrayBufferToBase64Url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));

  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}

async function importPrivateKey(pem) {
  const normalized = pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
  const pemContents = normalized
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

// ────────────────────────────────────────────────
// Response helpers
// ────────────────────────────────────────────────
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || 'https://www.reelix.2bd.net',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(env, obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}
