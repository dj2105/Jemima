// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc as _doc, setDoc as _setDoc, updateDoc, getDoc, onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ---------- init ----------
let app, db, auth;
function parseConfig() {
  try {
    // Prefer a single JSON blob in Vite env
    const raw = import.meta.env.VITE_FIREBASE_CONFIG;
    if (raw && raw.trim().startsWith("{")) return JSON.parse(raw);
  } catch (e) {
    console.warn("VITE_FIREBASE_CONFIG parse failed:", e);
  }
  // Fallback to individual keys if you prefer that style (optional)
  return {
    apiKey: import.meta.env.VITE_FB_API_KEY,
    authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FB_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
    appId: import.meta.env.VITE_FB_APP_ID
  };
}

export async function ensureFirebase() {
  if (db) return db;
  const cfg = parseConfig();
  if (!cfg || !cfg.apiKey) throw new Error("Missing Firebase config env");

  app = getApps().length ? getApps()[0] : initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);

  // anonymous sign-in (keeps rules simple)
  await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { unsub(); resolve(); }
    });
    signInAnonymously(auth).catch(reject);
  });

  return db;
}

// ---------- thin adapters to keep your existing imports working ----------
export function doc(...path) {
  if (!db) throw new Error("Firestore not initialised; call ensureFirebase()");
  return _doc(db, ...path);
}
export async function setDoc(ref, data, opts) {
  await _ensure();
  return _setDoc(ref, data, opts);
}
async function _ensure() { if (!db) await ensureFirebase(); }

// ---------- game-specific helpers ----------
/** Save the player's chosen answers for a round */
export async function saveRoundAnswers({ roomCode, round, player, answers }) {
  await _ensure();
  const ref = _doc(db, "rooms", roomCode, "answers", `${player}_r${round}`);
  // schema: { answers: { qid: index }, at, player, round }
  await _setDoc(ref, { answers, at: serverTimestamp(), player, round }, { merge: true });
}

/** Fetch opponent answers for a round */
export async function getOpponentAnswers({ roomCode, round, player }) {
  await _ensure();
  const opponent = player === "Daniel" ? "Jaime" : "Daniel";
  const ref = _doc(db, "rooms", roomCode, "answers", `${opponent}_r${round}`);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().answers || {}) : {};
}

/** Mark the current player ready for a round+phase (question/marking) */
export async function markReady({ roomCode, round, phase, player }) {
  await _ensure();
  const key = `r${round}_${phase}`; // e.g. r1_marking
  const ref = _doc(db, "rooms", roomCode, "ready", key);
  await _setDoc(ref, { [player]: true, updatedAt: serverTimestamp() }, { merge: true });
}

/** Subscribe to "both players ready" for a round+phase */
export function subscribeReady({ roomCode, round, phase }, cb) {
  const key = `r${round}_${phase}`;
  const ref = _doc(db, "rooms", roomCode, "ready", key);
  // First ensure init (no await needed for onSnapshot; we guard lazily)
  _ensure().then(() => {
    onSnapshot(ref, (snap) => {
      const d = snap.exists() ? snap.data() : {};
      cb({ Daniel: !!d.Daniel, Jaime: !!d.Jaime });
    });
  });
}
