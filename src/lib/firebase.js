// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc as _doc, setDoc as _setDoc, getDoc, onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// --- Config: use env first, fall back to the provided object ---
function readConfigFromEnv() {
  try {
    const raw = import.meta.env?.VITE_FIREBASE_CONFIG;
    if (raw && raw.trim().startsWith("{")) return JSON.parse(raw);
  } catch {}
  return null;
}

const FALLBACK_CFG = {
  apiKey: "AIzaSyBvJcSjv0scpaoGjKZDW93NLK9HvVeuHFo",
  authDomain: "jemima-asks.firebaseapp.com",
  projectId: "jemima-asks",
  storageBucket: "jemima-asks.firebasestorage.app",
  messagingSenderId: "945831741100",
  appId: "1:945831741100:web:3b40a06caf863a4f5b4109",
  measurementId: "G-22H4H6DWXH"
};

let app, db, auth;

export async function ensureFirebase() {
  if (db) return db;
  const cfg = readConfigFromEnv() || FALLBACK_CFG;
  app = getApps().length ? getApps()[0] : initializeApp(cfg);
  db = getFirestore(app);
  auth = getAuth(app);

  // anonymous auth (so security rules can distinguish players)
  await new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, u => { if (u) { unsub(); resolve(); } });
    signInAnonymously(auth).catch(reject);
  });

  return db;
}

// Thin adapters to keep existing imports working
export function doc(...path) {
  if (!db) throw new Error("Firestore not initialised; call ensureFirebase()");
  return _doc(db, ...path);
}
export async function setDoc(ref, data, opts) {
  if (!db) await ensureFirebase();
  return _setDoc(ref, data, opts);
}

// ---------- Room status / progress ----------
export async function setRoomStatus(roomCode, patch) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "meta", "status");
  await _setDoc(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
export async function subscribeRoomStatus(roomCode, cb) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "meta", "status");
  return onSnapshot(ref, snap => cb(snap.exists() ? snap.data() : {}));
}
export async function markJoined(roomCode, player) {
  await setRoomStatus(roomCode, { [player === "Daniel" ? "joinedDaniel" : "joinedJaime"]: true });
}

// ---------- Questions per round ----------
export async function saveRoundQuestions(roomCode, round, questions) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "rounds", `r${round}`);
  await _setDoc(ref, { questions, at: serverTimestamp(), round });
}
export async function loadRoundQuestions(roomCode, round) {
  await ensureFirebase();
  const ref = _doc(db, "rooms", roomCode, "rounds", `r${round}`);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().questions || []) : [];
}

// ---------- Answers (per player per round) ----------
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

// ---------- Ready synchronisation (marking) ----------
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
  return onSnapshot(ref, snap => {
    const d = snap.exists() ? snap.data() : {};
    cb({ Daniel: !!d.Daniel, Jaime: !!d.Jaime });
  });
}
