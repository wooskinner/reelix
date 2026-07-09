/**
 * Firebase initialization — deferred and only when needed
 * Loaded with 'async' to prevent render blocking
 */

let firebaseInitialized = false;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

const firebaseConfig = {
  apiKey: "AIzaSyARv0yl2troYUULCo-7avpF4yg5nZ-xoEE",
  authDomain: "reelix-2bf23.firebaseapp.com",
  projectId: "reelix-2bf23",
  storageBucket: "reelix-2bf23.firebasestorage.app",
  messagingSenderId: "912475832817",
  appId: "1:912475832817:web:7d0de62cac82a04c4e8450"
};

/**
 * Initialize Firebase on demand (lazy loading)
 * Only called when subscription state or auth is needed
 */
async function ensureFirebaseInitialized() {
  if (firebaseInitialized) return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb };

  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    firebaseApp = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    firebaseInitialized = true;

    return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb };
  } catch (err) {
    console.error('Firebase initialization failed:', err);
    throw err;
  }
}

/**
 * Get Firebase instances (ensures they're initialized first)
 */
export async function getFirebaseInstances() {
  return ensureFirebaseInitialized();
}
