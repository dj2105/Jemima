// /src/views/Generation.js
// Host seeds; guest watches. Guarantees 6 Qs per round (5 rounds),
// writes under rooms/{code}/seed/{questions|interludes|maths}. When ready,
// sets localStorage.nextHash to '#/round/1' and navigates both to '#/countdown'.

import { geminiCall } from '../lib/gemini.js';
import {
  initFirebase, ensureAuth, db, doc, collection, setDoc, getDoc, updateDoc, onSnapshot
} from '../lib/firebase.js';
import { JEMIMA_MATH_INTERLUDES_SPEC, QUIZ_MECHANICS_SPEC } from '../specs.js';

export default function Generation(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  // helpers
  const lsGet = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const roomCode = (lsGet('lastGameCode', '') || '').toUpperCase();
  const roleRaw  = (lsGet('playerRole', 'host') || '').toLowerCase();
  const isHost   = roleRaw === 'host' || roleRaw === 'daniel';

  // UI
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';

  const box = document.createElement('div');
  box.style.textAlign = 'center';
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = isHost ? 'Generation (Host)' : 'Waiting for Host';
  box.appendChild(title);

  const statusCard = document.createElement('div');
  statusCard.className = 'card mt-4';
  statusCard.style.textAlign = 'left';
  box.appendChild(statusCard);

  const bar = document.createElement('div');
  bar.className = 'progress mt-3';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  bar.appendChild(fill);
  box.appendChild(bar);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  row.appendChild(btn);
  box.appendChild(row);

  wrap.appendChild(box);

  btn.addEventListener('click', () => {
    // Set next route to Round 1 and send both through countdown
    lsSet('nextHash', '#/round/1');
    navigate('#/countdown');
  });

  // Kickoff
  void start();

  return wrap;

  async function start() {
    if (!roomCode) {
      statusCard.textContent = 'Missing room code. Return to Lobby.';
      return;
    }
    try {
      initFirebase();
      await ensureAuth();
    } catch {}

    // Text lines
    const lRoom = line(`Room: ${roomCode}`);
    const lQs   = line('Questions: 0/5 rounds');
    const lJem  = line('Jemima passages: 0/4');
    const lMath = line('Maths questions: 0/2');
    statusCard.append(lRoom, lQs, lJem, lMath);

    // Live snapshots so guests can watch progress
    onSnapshot(doc(db, 'rooms', roomCode, 'seed', 'questions'), (snap) => {
      if (!snap.exists()) return;
      const rounds = Array.isArray(snap.data()?.rounds) ? snap.data().rounds : [];
      lQs.textContent = `Questions: ${Math.min(5, rounds.length)}/5 rounds`;
      bumpPctTowards(70, rounds.length / 5);
      checkReady(rounds.length, null, null);
    });

    onSnapshot(doc(db, 'rooms', roomCode, 'seed', 'interludes'), (snap) => {
      if (!snap.exists()) return;
      const passages = Array.isArray(snap.data()?.passages) ? snap.data().passages : [];
      lJem.textContent = `Jemima passages: ${Math.min(4, passages.length)}/4`;
      bumpPctTowards(85, passages.length / 4);
      checkReady(null, passages.length, null);
    });

    onSnapshot(doc(db, 'rooms', roomCode, 'seed', 'maths'), (snap) => {
      if (!snap.exists()) return;
      const q2 = Array.isArray(snap.data()?.questions) ? snap.data().questions : [];
      lMath.textContent = `Maths questions: ${Math.min(2, q2.length)}/2`;
      bumpPctTowards(100, q2.length / 2);
      checkReady(null, null, q2.length);
    });

    // Host-only seeding (idempotent)
    if (isHost) {
      // Try to seed if nothing exists yet. Safe to call; use merge.
      await ensureSeedsOnce();
    }
  }

  async function ensureSeedsOnce() {
    // Check existence first; if present, skip generation.
    const qSnap  = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'));
    const iSnap  = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'interludes'));
    const mSnap  = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'maths'));

    const needQ = !qSnap.exists();
    const needI = !iSnap.exists();
    const needM = !mSnap.exists();

    try {
      if (needQ) {
        // Use your existing back end / geminiCall to create 5 rounds x 6 Qs each
        const payload = await geminiCall(QUIZ_MECHANICS_SPEC);
        await setDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'), payload || {}, { merge: true });
      }
    } catch (e) { console.warn('[Generation] questions seed failed', e); }

    try {
      if (needI) {
        const payload = await geminiCall(JEMIMA_MATH_INTERLUDES_SPEC);
        await setDoc(doc(db, 'rooms', roomCode, 'seed', 'interludes'), payload || {}, { merge: true });
      }
    } catch (e) { console.warn('[Generation] interludes seed failed', e); }

    try {
      if (needM) {
        // Expecting 2 maths questions total
        const payload = await geminiCall({ kind: 'jemima_two_questions' });
        await setDoc(doc(db, 'rooms', roomCode, 'seed', 'maths'), payload || {}, { merge: true });
      }
    } catch (e) { console.warn('[Generation] maths seed failed', e); }
  }

  // --- helpers for progress bar and ready state ---
  let bestRounds = 0, bestPassages = 0, bestMaths = 0;
  function checkReady(rCount, pCount, mCount) {
    if (typeof rCount === 'number') bestRounds = Math.max(bestRounds, rCount);
    if (typeof pCount === 'number') bestPassages = Math.max(bestPassages, pCount);
    if (typeof mCount === 'number') bestMaths = Math.max(bestMaths, mCount);

    const ready = bestRounds >= 5 && bestPassages >= 4 && bestMaths >= 2;
    btn.disabled = !ready;
  }

  function setPct(p) {
    fill.style.width = `${Math.max(0, Math.min(100, p))}%`;
  }
  function bumpPctTowards(target, frac) {
    const pct = Math.round(target * Math.max(0, Math.min(1, frac)));
    const current = Number((fill.style.width || '0%').replace('%', '')) || 0;
    if (pct > current) setPct(pct);
  }
  function line(text) {
    const d = document.createElement('div');
    d.className = 'mt-2';
    d.textContent = text;
    return d;
  }
}
