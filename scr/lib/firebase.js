// /src/lib/firebase.js
// Firebase init with SESSION persistence so each tab/window is its own "user" in dev.
// Works with Hosting/Emulator and production.

import {
  initializeApp
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';

import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
  signInAnonymously,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

import {
  getFirestore,
  doc, getDoc, setDoc, onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export let app, auth, db;

export async function initFirebase() {
  if (app) return app;
  const cfg = window.__FIREBASE_CONFIG__;
  if (!cfg) throw new Error('Missing window.__FIREBASE_CONFIG__.');
  app = initializeApp(cfg);
  auth = getAuth(app);
  db = getFirestore(app);

  // IMPORTANT: per-tab auth persistence
  await setPersistence(auth, browserSessionPersistence).catch(() => { /* ignore; fallback is local */ });

  return app;
}

export async function ensureAuth() {
  await initFirebase();
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth).catch((e) => { throw new Error('Anonymous sign-in failed: ' + (e?.message || e)); });
  // Wait for user to attach
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Auth timeout.')), 8000);
    onAuthStateChanged(auth, (u) => { if (u) { clearTimeout(to); resolve(u); } });
  });
  return auth.currentUser;
}

// re-export commonly used Firestore helpers
export { doc, getDoc, setDoc, onSnapshot };
