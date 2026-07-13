/**
 * Subscription state caching with debouncing
 * Reduces redundant Firestore queries
 */

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const DEBOUNCE_DELAY = 1000; // 1 second

let subscriptionCache = {
  state: null,
  timestamp: 0,
  isStale: true
};

let subscriptionCheckTimeout = null;

/**
 * Load subscription from cache if fresh, otherwise mark as stale
 */
export function getCachedSubscription() {
  const now = Date.now();
  if (subscriptionCache.timestamp && (now - subscriptionCache.timestamp) < CACHE_DURATION) {
    return subscriptionCache.state;
  }
  subscriptionCache.isStale = true;
  return null;
}

/**
 * Cache subscription state
 */
export function cacheSubscription(state) {
  subscriptionCache = {
    state,
    timestamp: Date.now(),
    isStale: false
  };
}

/**
 * Debounced subscription check — prevents repeated Firestore calls
 */
export function debouncedCheckSubscription(checkFn) {
  clearTimeout(subscriptionCheckTimeout);
  subscriptionCheckTimeout = setTimeout(() => {
    if (subscriptionCache.isStale) {
      checkFn();
    }
  }, DEBOUNCE_DELAY);
}

/**
 * Invalidate cache (call after auth state changes)
 */
export function invalidateSubscriptionCache() {
  subscriptionCache.isStale = true;
  subscriptionCache.timestamp = 0;
}
