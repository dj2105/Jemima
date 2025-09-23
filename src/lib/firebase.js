// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc as _doc, setDoc as _setDoc, getDoc, onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

let app, db, auth;

// ----- init -----
function parseConfig() {
  try {
    const raw = import.meta.env.VITE_FIREBASE_CONFIG;
    if (raw && raw.trim().startsWith("{")) return JSON.parse(raw);
  } catch (e) {
    console.warn("VITE_FIREBASE_CONFIG parse failed:", e);
  }
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
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { unsub(); resolve(); }
    });
    signInAnonymously(auth).catch(reject);
  });

  return db;
}

// ----- thin adapters (keep existing imports working) -----
export function doc(...path) {
  if (!db) throw new Error("Firestore not initialised; call ensureFirebase()");
  return _doc(db, ...path);
}
export async function setDoc(ref, data, opts) {
  if (!db) await ensureFirebase();
  return _setDoc(ref, data, opts);
}

// ----- room status (for lobby → countdown) -----
export async function setRoomStatus(roomCode, patch) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "meta", "status");
  await _setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export async function subscribeRoomStatus(roomCode, cb) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "meta", "status");
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : {}));
}

export async function markJoined(roomCode, player) {
  const key = player === "Daniel" ? "joinedDaniel" : "joinedJaime";
  await setRoomStatus(roomCode, { [key]: true });
}

// ----- answers (optional, used by Question/Marking) -----
export async function saveRoundAnswers({ roomCode, round, player, answers }) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "answers", `${player}_r${round}`);
  await _setDoc(ref, { answers, at: serverTimestamp(), player, round }, { merge: true });
}

export async function getOpponentAnswers({ roomCode, round, player }) {
  await ensureFirebase();
  const opponent = player === "Daniel" ? "Jaime" : "Daniel";
  const ref = _doc(db, "rooms", roomCode, "answers", `${opponent}_r${round}`);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().answers || {}) : {};
}

// ----- READY SYNC (used by MarkingRoom) -----
export async function markReady({ roomCode, round, phase, player }) {
  await ensureFirebase();
  const key = `r${round}_${phase}`; // e.g. r1_marking
  const ref = _doc(db, "rooms", roomCode, "ready", key);
  await _setDoc(ref, { [player]: true, updatedAt: serverTimestamp() }, { merge: true });
}

export async function subscribeReady({ roomCode, round, phase }, cb) {
  await ensureFirebase();
  const key = `r${round}_${phase}`;
  const ref = _doc(db, "rooms", roomCode, "ready", key);
  return onSnapshot(ref, (snap) => {
    const d = snap.exists() ? snap.data() : {};
    cb({ Daniel: !!d.Daniel, Jaime: !!d.Jaime });
  });
}
