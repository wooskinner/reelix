// api.js
const WORKER_BASE = "https://reelix.wooskinner.workers.dev/tmdb";

export async function fetchProxy(endpoint, params = "") {
    // endpoint example: "movie/popular" or "tv/123"
    const url = `${WORKER_BASE}/${endpoint}${params}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("API Proxy error");
        return await response.json();
    } catch (err) {
        console.error("Fetch failed:", err);
        return null;
    }
}
