// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc as _doc, setDoc as _setDoc, getDoc, onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

let app, db, auth;

function parseConfig() {
  try {
    const raw = import.meta.env.VITE_FIREBASE_CONFIG;
    if (raw && raw.trim().startsWith("{")) return JSON.parse(raw);
  } catch (e) { console.warn("VITE_FIREBASE_CONFIG parse failed:", e); }
  return null;
}

export async function ensureFirebase() {
  if (db) return db;
  const cfg = parseConfig();
  if (!cfg || !cfg.apiKey) throw new Error("Missing Firebase config env");

  app = getApps().length ? getApps()[0] : initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);

  await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) { unsub(); resolve(); } });
    signInAnonymously(auth).catch(reject);
  });

  return db;
}

// Keep existing thin adapters (if you use them elsewhere)
export function doc(...path) {
  if (!db) throw new Error("Firestore not initialised; call ensureFirebase()");
  return _doc(db, ...path);
}
export async function setDoc(ref, data, opts) {
  if (!db) await ensureFirebase();
  return _setDoc(ref, data, opts);
}

// ---------- New: room status sync ----------
/** Write/merge room status: { phase, round, joinedDaniel, joinedJaime } */
export async function setRoomStatus(roomCode, patch) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "meta", "status");
  await _setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

/** Subscribe to room status changes */
export async function subscribeRoomStatus(roomCode, cb) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "meta", "status");
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : {}));
}

/** Mark a player as joined */
export async function markJoined(roomCode, player) {
  const key = player === "Daniel" ? "joinedDaniel" : "joinedJaime";
  await setRoomStatus(roomCode, { [key]: true });
}
