// /src/lib/firebase.js
// Firestore adapter. Defaults to Daniel’s provided config.
// If host pasted a JSON config in Key Room, it overrides.

import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, collection, setDoc, getDoc,
  updateDoc, onSnapshot
} from 'firebase/firestore';

// --- Default config (replace if override exists in localStorage) ---
const defaultConfig = {
  apiKey: "AIzaSyBvJcSjv0scpaoGjKZDW93NLK9HvVeuHFo",
  authDomain: "jemima-asks.firebaseapp.com",
  projectId: "jemima-asks",
  storageBucket: "jemima-asks.firebasestorage.app",
  messagingSenderId: "945831741100",
  appId: "1:945831741100:web:3b40a06caf863a4f5b4109",
  measurementId: "G-22H4H6DWXH"
};

let app, db;

/**
 * Initialise Firebase app + Firestore
 * Will only run once (idempotent).
 */
export function initFirebase() {
  if (db) return db;

  let cfg = defaultConfig;

  // Check for override from KeyRoom
  try {
    const saved = JSON.parse(localStorage.getItem('keyRoom') || '{}');
    if (saved.firebaseConfig) {
      const parsed = JSON.parse(saved.firebaseConfig);
      if (parsed && parsed.apiKey && parsed.projectId) {
        cfg = parsed;
        console.log('[firebase] Using override config from KeyRoom');
      }
    }
  } catch (err) {
    console.warn('[firebase] Failed to parse override config, using default.', err);
  }

  app = initializeApp(cfg);
  db = getFirestore(app);
  return db;
}

// Expose helpers for rest of app
export {
  db, doc, collection, setDoc, getDoc,
  updateDoc, onSnapshot
};
