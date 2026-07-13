/**
 * Reelix Unified Worker 
 * Handles: Selar Webhooks, Subscription Claims, and TMDB Proxying
 */

const PLAN_DAYS = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    // 2. TMDB Proxy Route (Secures your API Key)
    if (url.pathname.startsWith('/tmdb/')) {
      const tmdbPath = url.pathname.replace('/tmdb/', '');
      const searchParams = url.search;
      
      // Use the Secret stored in Cloudflare Environment Variables
      const targetUrl = `https://api.themoviedb.org/3/${tmdbPath}${searchParams}${searchParams ? '&' : '?'}api_key=${env.TMDB_API_KEY}`;

      try {
        const tmdbResponse = await fetch(targetUrl, {
          cf: { cacheTtl: 3600, cacheEverything: true } // Cache at edge for 1 hour
        });
        const data = await tmdbResponse.json();
        
        return new Response(JSON.stringify(data), {
          headers: { 
            "Content-Type": "application/json", 
            ...corsHeaders(env),
            "Cache-Control": "public, max-age=3600" 
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Proxy failed' }), { status: 500, headers: corsHeaders(env) });
      }
    }

    // 3. Claim Activation Route
    if (url.pathname === '/claim-activation' && request.method === 'POST') {
        // ... (Keep your existing handleClaim logic here)
        return handleClaim(request, env);
    }

    // 4. Selar Webhook Route
    if (request.method === 'POST') {
        // ... (Keep your existing Webhook logic here)
        return handleWebhook(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Ensure you include your existing handleClaim and handleWebhook functions below in the same file
