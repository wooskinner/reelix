/**
 * REELIX — CENTRAL GATEWAY WORKER
 *
 * Routes:
 *   POST /              Selar payment webhook (also accepts /webhook)
 *   POST /api/claim     Customer activates their account with a purchase code
 *   GET  /api/tmdb       Secure proxy to TMDB (keeps the API key server-side)
 *   GET  /sitemap.xml   Dynamically generated sitemap for SEO
 *   GET  /robots.txt    Robots.txt for search engines
 *
 * Required environment variables / secrets (set via `wrangler secret put`):
 *   TMDB_API_KEY
 *   FIREBASE_API_KEY
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   SELAR_SECRET            (optional but recommended — verifies webhook authenticity)
 *
 * Optional plain var (set in wrangler.toml [vars] or the dashboard):
 *   ALLOWED_ORIGINS          comma-separated list, e.g.
 *                             "https://www.reelix.2bd.net,https://reelix.2bd.net"
 *                             Falls back to DEFAULT_ORIGINS below if unset.
 */

const DEFAULT_ORIGINS = [
  'https://www.reelix.2bd.net',
  'https://reelix.2bd.net',
];

let cachedToken = '';
let cachedTokenExpiry = 0;

// ─── SITEMAP CONFIGURATION ───
const SITEMAP_PAGES = [
  { url: '/', priority: 1.0, changefreq: 'daily' },
  { url: '/index.html', priority: 1.0, changefreq: 'daily' },
  { url: '/browse.html', priority: 0.9, changefreq: 'daily' },
  { url: '/watch.html', priority: 0.8, changefreq: 'weekly' },
  { url: '/pricing.html', priority: 0.9, changefreq: 'weekly' },
  { url: '/signup.html', priority: 0.9, changefreq: 'weekly' },
  { url: '/download.html', priority: 0.7, changefreq: 'monthly' },
  { url: '/activate.html', priority: 0.5, changefreq: 'monthly' },
  // Legal pages
  { url: '/terms.html', priority: 0.5, changefreq: 'monthly' },
  { url: '/privacy.html', priority: 0.5, changefreq: 'monthly' },
  { url: '/cookies.html', priority: 0.5, changefreq: 'monthly' },
  { url: '/dmca.html', priority: 0.5, changefreq: 'monthly' },
];

// Popular movie IDs for dynamic sitemap entries
const POPULAR_MOVIE_IDS = [278, 238, 155, 680, 13, 550, 597, 769, 122, 129, 496243, 372058];
const POPULAR_TV_IDS = [1399, 1396, 1402, 1403, 1412, 1421, 1436, 1440];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '').toLowerCase() || '/';
    const origin = resolveOrigin(request, env);

    if (request.method === 'OPTIONS') {
      return corsPreflight(origin);
    }

    try {
      // ─── SITEMAP ROUTE ───
      if (path === '/sitemap.xml') {
        return await handleSitemap(env, origin);
      }

      // ─── ROBOTS.TXT ROUTE ───
      if (path === '/robots.txt') {
        return await handleRobots(env, origin);
      }

      // ─── TMDB PROXY ───
      if (path === '/api/tmdb' && request.method === 'GET') {
        return await handleTmdb(url, env, origin);
      }

      // ─── CLAIM ROUTE ───
      if (path === '/api/claim' && request.method === 'POST') {
        return await handleClaim(request, env, origin);
      }

      // ─── WEBHOOK ROUTE ───
      if ((path === '/' || path === '/webhook') && request.method === 'POST') {
        return await handleSelarWebhook(request, env, origin);
      }

      return json({ error: `No route for ${request.method} ${path}` }, 404, origin);
    } catch (err) {
      console.error('Unhandled worker error:', err);
      return json({ error: 'Internal server error', details: err.message }, 500, origin);
    }
  },
};

// ─── CORS ──────────────────────────────────────────────────────────

function getAllowedOrigins(env) {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  }
  return DEFAULT_ORIGINS;
}

function resolveOrigin(request, env) {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowed = getAllowedOrigins(env);
  return allowed.includes(requestOrigin) ? requestOrigin : allowed[0];
}

function corsPreflight(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin',
    },
  });
}

// ─── SITEMAP GENERATOR ──────────────────────────────────────────

function generateSitemap(env) {
  const baseUrl = 'https://reelix.2bd.net';
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;

  // Static pages
  for (const page of SITEMAP_PAGES) {
    xml += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  }

  // Dynamic movie pages
  for (const id of POPULAR_MOVIE_IDS) {
    xml += `
  <url>
    <loc>${baseUrl}/watch.html?id=${id}&type=movie</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  // Dynamic TV show pages
  for (const id of POPULAR_TV_IDS) {
    xml += `
  <url>
    <loc>${baseUrl}/watch.html?id=${id}&type=tv</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }

  xml += '\n</urlset>';
  return xml;
}

async function handleSitemap(env, origin) {
  const sitemap = generateSitemap(env);
  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': origin || '*',
      'Vary': 'Origin',
    },
  });
}

// ─── ROBOTS.TXT ──────────────────────────────────────────────────

async function handleRobots(env, origin) {
  const robots = `# https://reelix.2bd.net/robots.txt
# Generated: ${new Date().toISOString()}

User-agent: *
Allow: /
Allow: /index.html
Allow: /browse.html
Allow: /watch.html
Allow: /pricing.html
Allow: /signup.html
Allow: /download.html
Allow: /terms.html
Allow: /privacy.html
Allow: /cookies.html
Allow: /dmca.html
Disallow: /activate.html
Disallow: /api/
Disallow: /admin/

# Sitemap location
Sitemap: https://reelix.2bd.net/sitemap.xml

# Crawl delay (be nice to the server)
Crawl-delay: 1

# Host directive
Host: https://reelix.2bd.net

# For Googlebot
User-agent: Googlebot
Allow: /
Allow: /browse.html
Allow: /watch.html
Allow: /pricing.html
Allow: /signup.html
Disallow: /activate.html
Disallow: /api/
Disallow: /admin/

# For Bingbot
User-agent: Bingbot
Allow: /
Disallow: /activate.html
Disallow: /api/
Disallow: /admin/

# For Social Media bots (Open Graph)
User-agent: Facebookbot
Allow: /
User-agent: Twitterbot
Allow: /
`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': origin || '*',
      'Vary': 'Origin',
    },
  });
}

// ─── TMDB PROXY ────────────────────────────────────────────────────

async function handleTmdb(url, env, origin) {
  const endpoint = url.searchParams.get('endpoint');
  if (!endpoint) {
    return json({ error: 'Missing "endpoint" query parameter' }, 400, origin);
  }
  if (!env.TMDB_API_KEY) {
    console.error('TMDB_API_KEY is not configured');
    return json({ error: 'Server misconfiguration' }, 500, origin);
  }

  const params = new URLSearchParams(url.search);
  params.delete('endpoint');
  params.set('api_key', env.TMDB_API_KEY);

  const tmdbRes = await fetch(`https://api.themoviedb.org/3${endpoint}?${params}`);
  const tmdbData = await tmdbRes.json();
  return json(tmdbData, tmdbRes.status, origin);
}

// ─── ACCOUNT ACTIVATION CLAIM ─────────────────────────────────────

async function handleClaim(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400, origin);
  }

  const { idToken, code } = body;
  if (!idToken || !code) {
    return json({ error: 'Missing idToken or code' }, 400, origin);
  }

  if (!env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) {
    console.error('Firebase env vars are not configured');
    return json({ error: 'Server misconfiguration' }, 500, origin);
  }

  // 1. Verify the caller's Firebase session token.
  const verifyRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.users?.length) {
    return json({ error: 'Your session has expired. Please sign in again.' }, 401, origin);
  }
  const uid = verifyData.users[0].localId;

  // 2. Look up the pending activation record for this code.
  const oauthToken = await getGoogleOAuthToken(env);
  const code_ = code.trim().toUpperCase();
  const pendingUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/pending_activations/${code_}`;

  const pendingRes = await fetch(pendingUrl, {
    headers: { Authorization: `Bearer ${oauthToken}` },
  });

  if (pendingRes.status === 404) {
    return json({ error: 'We couldn\u2019t find that activation code. Please double-check it.' }, 404, origin);
  }
  if (!pendingRes.ok) {
    console.error('Firestore read failed:', await pendingRes.text());
    return json({ error: 'Could not verify your code right now. Please try again shortly.' }, 502, origin);
  }

  const pendingDoc = await pendingRes.json();
  const fields = pendingDoc.fields;
  if (!fields || fields.status?.stringValue === 'claimed') {
    return json({ error: 'This activation code has already been used.' }, 400, origin);
  }

  const email = fields.email?.stringValue || '';
  const planDuration = fields.planDuration?.stringValue || 'monthly';
  const subscriptionEnd = new Date();
  subscriptionEnd.setMonth(subscriptionEnd.getMonth() + (planDuration === 'yearly' ? 12 : 1));

  // 3. Activate the user's account.
  const userUrl =
    `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}` +
    '?updateMask.fieldPaths=plan&updateMask.fieldPaths=planDuration' +
    '&updateMask.fieldPaths=subscriptionEnd&updateMask.fieldPaths=activatedAt' +
    '&updateMask.fieldPaths=email';

  const userWriteRes = await fetch(userUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${oauthToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        email: { stringValue: email },
        plan: { stringValue: 'active' },
        planDuration: { stringValue: planDuration },
        subscriptionEnd: { stringValue: subscriptionEnd.toISOString() },
        activatedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  if (!userWriteRes.ok) {
    console.error('User write failed:', await userWriteRes.text());
    return json({ error: 'Could not activate your account right now. Please try again.' }, 502, origin);
  }

  // 4. Mark the code as claimed so it can't be reused.
  const claimRes = await fetch(
    `${pendingUrl}?updateMask.fieldPaths=status&updateMask.fieldPaths=claimedByUid&updateMask.fieldPaths=claimedAt`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${oauthToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ...fields,
          status: { stringValue: 'claimed' },
          claimedByUid: { stringValue: uid },
          claimedAt: { stringValue: new Date().toISOString() },
        },
      }),
    }
  );
  if (!claimRes.ok) {
    // The user's account is already active at this point — this is a
    // non-fatal cleanup step, so log it but don't fail the request.
    console.error('Failed to mark code claimed:', await claimRes.text());
  }

  return json({ success: true, plan: 'active', subscriptionEnd: subscriptionEnd.toISOString() }, 200, origin);
}

// ─── SELAR PAYMENT WEBHOOK ─────────────────────────────────────────

async function handleSelarWebhook(request, env, origin) {
  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (env.SELAR_SECRET) {
    const signature = request.headers.get('X-Selar-Signature') || payload.webhook_secret;
    if (signature !== env.SELAR_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const email = payload.customer?.email;
  const reference = payload.reference;
  if (!email || !reference) {
    return new Response('Missing email or reference', { status: 200 });
  }

  const planDuration = JSON.stringify(payload.items || '').toLowerCase().includes('year')
    ? 'yearly'
    : 'monthly';

  const code = reference.trim().toUpperCase();
  const oauthToken = await getGoogleOAuthToken(env);
  const pendingUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/pending_activations/${code}`;

  const existing = await fetch(pendingUrl, {
    headers: { Authorization: `Bearer ${oauthToken}` },
  });
  if (existing.status === 200) {
    return new Response('Duplicate webhook — already recorded', { status: 200 });
  }

  await fetch(pendingUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${oauthToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        email: { stringValue: email },
        reference: { stringValue: reference },
        planDuration: { stringValue: planDuration },
        status: { stringValue: 'pending' },
        createdAt: { stringValue: new Date().toISOString() },
      },
    }),
  });

  return new Response('OK', { status: 200 });
}

// ─── GOOGLE OAUTH (for Firestore REST access) ───────────────────────

async function getGoogleOAuthToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpiry) return cachedToken;

  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error('FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not configured');
  }

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    })
  );

  const unsigned = `${header}.${claims}`;
  const key = await importPrivateKey(env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${arrayBufferToBase64Url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(jwt)}`,
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error('Google OAuth token exchange failed: ' + JSON.stringify(data));
  }

  cachedToken = data.access_token;
  cachedTokenExpiry = now + (data.expires_in || 3600) - 60; // refresh a minute early
  return cachedToken;
}

async function importPrivateKey(pem) {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(contents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64Url(buffer) {
  let binary = '';
  for (const b of new Uint8Array(buffer)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
