/**
 * REELIX CLOUDFLARE WORKER (SECURE PRODUCTION VERSION)
 * 
 * Expected Environment Variables (Bindings):
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY (Format: -----BEGIN PRIVATE KEY-----\nMIIEvgIBADAN...)
 * - FIREBASE_API_KEY (Web API key for account lookups)
 * - SELAR_SECRET (The secret token to verify Selar webhooks)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Route 1: Client claiming activation after checkout
    if (url.pathname === '/claim' || url.pathname === '/api/claim') {
      if (request.method !== 'POST') {
        return jsonResponse(env, { error: 'Method not allowed' }, 405);
      }
      return await handleClaim(request, env);
    }

    // Route 2: Selar Webhook Gateway
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // SECURITY CHECK: Fail closed if the verification secret is missing from environment
    if (!env.SELAR_SECRET) {
      console.error('CRITICAL: SELAR_SECRET environment variable is missing. Webhook execution halted.');
      return new Response('Internal Server Error Configuration', { status: 500 });
    }

    return await handleSelarWebhook(request, env);
  },
};

/**
 * Handles the secure /claim route called by the front-end application
 */
async function handleClaim(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(env, { error: 'Invalid JSON' }, 400);
  }

  const idToken = body.idToken;
  if (!idToken) return jsonResponse(env, { error: 'Missing idToken' }, 400);

  // 1. Verify the client session token via Firebase Auth API
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

  // 2. Check if user document is already active in Firestore
  const userDoc = await firestoreGet(projectId, `users/${uid}`, accessToken);
  if (userDoc && userDoc.fields && userDoc.fields.plan && userDoc.fields.plan.stringValue === 'active') {
    return jsonResponse(env, {
      activated: true,
      plan: userDoc.fields.planDuration ? userDoc.fields.planDuration.stringValue : null,
      subscriptionEnd: userDoc.fields.subscriptionEnd ? userDoc.fields.subscriptionEnd.stringValue : null,
    });
  }

  // 3. Search for a verified payment record matching this normalized email
  const docId = email.replace(/[^a-z0-9]/g, '_');
  const pending = await firestoreGet(projectId, `pending_activations/${docId}`, accessToken);

  // SECURITY FIX: Completely removed unverified 'redirect-trust' fallback logic.
  // If no authentic payload exists in the verified database collection, access is rejected.
  if (!pending || !pending.fields) {
    return jsonResponse(env, { activated: false, reason: 'no-pending-payment' });
  }

  const planDuration = pending.fields.planDuration.stringValue;
  const subscriptionEnd = pending.fields.subscriptionEnd.stringValue;

  // 4. Update the user record to active status
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

  // 5. Safely purge the pending record now that it is successfully claimed
  await firestoreDelete(projectId, `pending_activations/${docId}`, accessToken);

  return jsonResponse(env, { activated: true, plan: planDuration, subscriptionEnd });
}

/**
 * Handles incoming webhooks directly from Selar
 */
async function handleSelarWebhook(request, env) {
  let bodyText = '';
  try {
    bodyText = await request.text();
  } catch (e) {
    return new Response('Unable to read payload body', { status: 400 });
  }

  // Verify Selar signature token via header or payload data
  const authHeader = request.headers.get('Authorization') || '';
  let tokenMatched = false;
  if (authHeader.includes(env.SELAR_SECRET)) {
    tokenMatched = true;
  }

  let payload = {};
  try {
    payload = JSON.parse(bodyText);
  } catch (e) {
    return new Response('Invalid JSON dynamic structure', { status: 400 });
  }

  if (payload.secret === env.SELAR_SECRET) {
    tokenMatched = true;
  }

  if (!tokenMatched) {
    return new Response('Unauthorized Webhook Signature Verification Failed', { status: 401 });
  }

  // Determine subscription parameters based on the incoming package item bought
  const customer = payload.customer || {};
  const email = (customer.email || '').toLowerCase().trim();
  if (!email) return new Response('Missing customer target data', { status: 200 });

  let planDuration = '1m';
  let daysToAdd = 30;

  const orderItems = payload.items || [];
  let itemTitle = '';
  if (orderItems.length > 0 && orderItems[0].product) {
    itemTitle = (orderItems[0].product.name || '').toLowerCase();
  }

  if (itemTitle.includes('annual') || itemTitle.includes('yearly') || itemTitle.includes('12 months') || itemTitle.includes('12m')) {
    planDuration = '12m';
    daysToAdd = 365;
  } else if (itemTitle.includes('6 months') || itemTitle.includes('6m')) {
    planDuration = '6m';
    daysToAdd = 180;
  } else if (itemTitle.includes('3 months') || itemTitle.includes('3m')) {
    planDuration = '3m';
    daysToAdd = 90;
  }

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysToAdd);
  const subscriptionEndStr = expiryDate.toISOString();

  const accessToken = await getAccessToken(env);
  const projectId = env.FIREBASE_PROJECT_ID;
  const docId = email.replace(/[^a-z0-9]/g, '_');

  // Commit the verified order to the pending activations staging area
  await firestorePatch(
    projectId,
    `pending_activations/${docId}`,
    accessToken,
    {
      email: { stringValue: email },
      planDuration: { stringValue: planDuration },
      subscriptionEnd: { stringValue: subscriptionEndStr },
      createdAt: { stringValue: new Date().toISOString() },
    },
    ['email', 'planDuration', 'subscriptionEnd', 'createdAt']
  );

  return new Response('Webhook processed successfully', { status: 200 });
}

/**
 * Help helper to build standardized JSON responses with unified CORS headers
 */
function jsonResponse(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

/**
 * Generates an OAuth2 access token for authenticating Google Firestore REST commands
 */
async function getAccessToken(env) {
  const pk = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const claim = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64UrlEncode = (str) => btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(claim));

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pk.substring(pk.indexOf(pemHeader) + pemHeader.length, pk.indexOf(pemFooter)).replace(/\s/g, '');
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureArrayBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureArrayBuffer)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = signatureInput + '.' + signature;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  const data = await res.json();
  return data.access_token;
}

/**
 * Firestore Client Wrapper Layer
 */
async function firestoreGet(projectId, path, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  return await res.json();
}

async function firestorePatch(projectId, path, accessToken, fields, updateMaskFieldPaths) {
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`);
  for (const mask of updateMaskFieldPaths) {
    url.searchParams.append('updateMask.fieldPaths', mask);
  }
  await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
}

async function firestoreDelete(projectId, path, accessToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
