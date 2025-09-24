// /src/lib/firebase.js
// Firestore + Anonymous Auth. Defaults to your provided config, but allows
// override from Key Room (JSON). Ensures we are signed in before any writes.

import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, setDoc, getDoc,
  updateDoc, onSnapshot
} from 'firebase/firestore';
import {
  getAuth, onAuthStateChanged, signInAnonymously
} from 'firebase/auth';

// --- Default config (Daniel’s) ---
const defaultConfig = {
  apiKey: "AIzaSyBvJcSjv0scpaoGjKZDW93NLK9HvVeuHFo",
  authDomain: "jemima-asks.firebaseapp.com",
  projectId: "jemima-asks",
  storageBucket: "jemima-asks.firebasestorage.app",
  messagingSenderId: "945831741100",
  appId: "1:945831741100:web:3b40a06caf863a4f5b4109",
  measurementId: "G-22H4H6DWXH"
};

let app, db, auth, authReadyPromise;

/** Initialise Firebase + Firestore + Anonymous Auth (idempotent). */
export function initFirebase() {
  if (db) return db;

  let cfg = defaultConfig;
  try {
    const saved = JSON.parse(localStorage.getItem('keyRoom') || '{}');
    if (saved.firebaseConfig) {
      const parsed = JSON.parse(saved.firebaseConfig);
      if (parsed && parsed.apiKey && parsed.projectId) cfg = parsed;
    }
  } catch {}

  app = initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);

  // Ensure anonymous sign-in (so rules with request.auth != null pass)
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      onAuthStateChanged(auth, (u) => resolve(u || null));
      // If no user, sign in anonymously
      signInAnonymously(auth).catch(() => {/* ignore: onAuthStateChanged will still fire */});
    });
  }
  return db;
}

/** Await auth being available (Anonymous). */
export async function ensureAuth() {
  if (!authReadyPromise) initFirebase();
  return authReadyPromise;
}

// Expose helpers
export {
  db, doc, collection, setDoc, getDoc, updateDoc, onSnapshot, auth
};
