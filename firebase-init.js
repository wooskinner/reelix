/**
 * Firebase initialization — deferred and only when needed
 * Loaded with 'async' to prevent render blocking
 */

let firebaseInitialized = false;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

const firebaseConfig = {
  apiKey: "AIzaSyDyCRDmqNaZRRBx52U72gesRUEnktKsG3Q",
  authDomain: "reelix-ffa51.firebaseapp.com",
  projectId: "reelix-ffa51",
  storageBucket: "reelix-ffa51.firebasestorage.app",
  messagingSenderId: "992750255210",
  appId: "1:992750255210:web:a03e62a14e685cfb5a5e13"
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
