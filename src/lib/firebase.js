// /src/lib/firebase.js
// Lightweight Firebase initialiser for a static (HTML/JS/CSS) site.
// Usage:
//  1) In your browser, set localStorage["firebaseConfig.json"] = JSON.stringify({...})
//     (Copy the config from Firebase Console → Project Settings → "Your apps" → Web app)
//  2) Or set window.__FIREBASE_CONFIG__ = { ... } in index.html before loading main.js
//  3) Call: await initFirebase(); await ensureAuth();

import {
  initializeApp, getApps, getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, collection,
  serverTimestamp, connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Internal module state (singleton) ----
let _inited = false;
let _app = null;
export let auth = null;
export let db = null;

// ---- Helpers ----
function readLocalConfig() {
  try {
    const raw = localStorage.getItem("firebaseConfig.json");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function getConfigOrThrow() {
  const fromLocal = readLocalConfig();
  const fromWindow = (typeof window !== 'undefined') ? window.__FIREBASE_CONFIG__ : null;
  const cfg = fromLocal || fromWindow || null;
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    const hint = `
No Firebase web config found.

How to fix (do either):
1) Paste your Firebase web config in the browser console:
   localStorage.setItem("firebaseConfig.json", JSON.stringify({
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     appId: "..."
   }));

2) Or define it before loading /src/main.js:
   <script>
     window.__FIREBASE_CONFIG__ = { apiKey:"...", authDomain:"...", projectId:"...", appId:"..." };
   </script>

Then reload this page.
`.trim();
    throw new Error(hint);
  }
  return cfg;
}

function usingEmulators() {
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  const url = new URL(location.href);
  const p = url.searchParams.get('emu');
  if (p === '1') return true;
  if (p === '0') return false;
  return isLocal; // default: emulator ON when running locally
}

// ---- Public: init & auth ----
export async function initFirebase() {
  if (_inited) return { app: _app, db, auth, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, serverTimestamp };

  const config = getConfigOrThrow();

  _app = getApps().length ? getApp() : initializeApp(config);
  auth = getAuth(_app);
  db = getFirestore(_app);

  if (usingEmulators()) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      console.info("[firebase] Connected to local emulators (Auth:9099, Firestore:8080). Add ?emu=0 to disable.");
    } catch (e) {
      console.warn("[firebase] Emulator connect failed (are they running?)", e);
    }
  }

  _inited = true;
  return { app: _app, db, auth, doc, setDoc, getDoc, updateDoc, onSnapshot, collection, serverTimestamp };
}

// Anonymous sign-in (idempotent)
export async function ensureAuth() {
  if (!auth) await initFirebase();

  const user = auth.currentUser;
  if (user) return user;

  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    }, reject);

    signInAnonymously(auth).catch((e) => {
      console.error("[firebase] Anonymous sign-in failed:", e);
      unsub();
      reject(e);
    });
  });
}
// Handy for debugging in the browser console:
try { window.__fb = { initFirebase, ensureAuth, auth, db }; } catch {}
// Re-export Firestore helpers for convenience
export {
  doc, setDoc, getDoc, updateDoc, onSnapshot, collection, serverTimestamp
};
