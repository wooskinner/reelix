// firebase-init.js — runtime-injected configuration (safe default)
let firebaseInitialized = false;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;

const firebaseConfig = {
  apiKey: window.__REELIX_CONFIG__?.FIREBASE_API_KEY || '',
  authDomain: window.__REELIX_CONFIG__?.FIREBASE_AUTH_DOMAIN || '',
  projectId: window.__REELIX_CONFIG__?.FIREBASE_PROJECT_ID || '',
  storageBucket: window.__REELIX_CONFIG__?.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: window.__REELIX_CONFIG__?.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: window.__REELIX_CONFIG__?.FIREBASE_APP_ID || ''
};

export async function getFirebaseInstances() {
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
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
    throw error;
  }
}
