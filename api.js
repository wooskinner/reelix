// api.js
import CONFIG from './config.js';

/**
 * Fetches TMDB data via the Cloudflare Worker Proxy
 * @param {string} endpoint - e.g., 'movie/popular'
 * @param {string} params - e.g., '?query=Inception'
 */
export async function fetchProxy(endpoint, params = "") {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = `${CONFIG.WORKER_URL}/tmdb/${cleanEndpoint}${params}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        return await response.json();
    } catch (err) {
        console.error("Fetch failed:", err);
        return null;
    }
}

/**
 * Handles subscription activation via the Worker
 */
export async function claimActivation(email, code) {
    try {
        const res = await fetch(`${CONFIG.WORKER_URL}/claim-activation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        return await res.json();
    } catch (err) {
        return { success: false, message: "Server connection failed" };
    }
}
