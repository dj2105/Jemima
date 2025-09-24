// /src/state.js
// Central state + Firestore bindings for Jemima’s Asking.
// Each player keeps a local role + id, but round data is synced in Firestore.

import { initFirebase, db, doc, collection, setDoc, getDoc, updateDoc, onSnapshot } from './lib/firebase.js';

export const state = {
  roomCode: null,
  role: null,            // "host" or "guest"
  playerId: null,
  scores: { daniel: 0, jaime: 0 },
  unsubscribeFns: []
};

/**
 * Generate a safe 4-char room code
 */
export function makeRoomCode(len = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Create a new room (host only).
 * Returns the room code.
 */
export async function createRoom() {
  initFirebase();
  const code = makeRoomCode();
  state.roomCode = code;
  state.role = 'host';
  state.playerId = 'daniel'; // fixed names for now

  const metaRef = doc(collection(db, 'rooms'), code);
  await setDoc(metaRef, {
    status: 'lobby',
    round: 0,
    created: Date.now()
  });

  return code;
}

/**
 * Join a room (guest only).
 * @param {string} code 
 */
export async function joinRoom(code) {
  initFirebase();
  state.roomCode = code;
  state.role = 'guest';
  state.playerId = 'jaime';

  const metaRef = doc(collection(db, 'rooms'), code);
  const snap = await getDoc(metaRef);
  if (!snap.exists()) throw new Error('Room not found');

  return code;
}

/**
 * Subscribe to changes in room meta (phase + round).
 * @param {(meta:Object)=>void} cb 
 */
export function onRoomMeta(cb) {
  if (!state.roomCode) return;
  const metaRef = doc(collection(db, 'rooms'), state.roomCode);
  const unsub = onSnapshot(metaRef, (snap) => {
    if (snap.exists()) cb(snap.data());
  });
  state.unsubscribeFns.push(unsub);
}

/**
 * Update room meta (host only).
 */
export async function setRoomMeta(data) {
  if (!state.roomCode) return;
  const metaRef = doc(collection(db, 'rooms'), state.roomCode);
  await updateDoc(metaRef, data);
}

/**
 * Save player’s answers for a round
 */
export async function saveAnswers(round, answers) {
  if (!state.roomCode || !state.playerId) return;
  const ref = doc(collection(db, 'rooms'), state.roomCode, 'answers', state.playerId + '_' + round);
  await setDoc(ref, { round, answers, ts: Date.now() });
}

/**
 * Subscribe to opponent’s answers
 */
export function onOpponentAnswers(round, cb) {
  if (!state.roomCode) return;
  const opp = state.playerId === 'daniel' ? 'jaime' : 'daniel';
  const ref = doc(collection(db, 'rooms'), state.roomCode, 'answers', opp + '_' + round);
  const unsub = onSnapshot(ref, (snap) => {
    if (snap.exists()) cb(snap.data());
  });
  state.unsubscribeFns.push(unsub);
}

/**
 * Save marking decisions for a round
 */
export async function saveMarking(round, marks) {
  if (!state.roomCode || !state.playerId) return;
  const ref = doc(collection(db, 'rooms'), state.roomCode, 'marking', state.playerId + '_' + round);
  await setDoc(ref, { round, marks, ts: Date.now() });
}

/**
 * Subscribe to opponent’s marking
 */
export function onOpponentMarking(round, cb) {
  if (!state.roomCode) return;
  const opp = state.playerId === 'daniel' ? 'jaime' : 'daniel';
  const ref = doc(collection(db, 'rooms'), state.roomCode, 'marking', opp + '_' + round);
  const unsub = onSnapshot(ref, (snap) => {
    if (snap.exists()) cb(snap.data());
  });
  state.unsubscribeFns.push(unsub);
}

/**
 * Clear all listeners
 */
export function clearSubscriptions() {
  state.unsubscribeFns.forEach((fn) => fn && fn());
  state.unsubscribeFns = [];
}
