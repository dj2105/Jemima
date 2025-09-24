// /src/views/Generation.js
// Production: Gemini + Firestore seeding with host/guest awareness.
// - Host seeds once; guests watch progress.
// - Idempotent: if any seed exists, nobody reseeds.
// - Writes under rooms/{code}/seed/{questions|interludes|maths} and flips rooms/{code}.status="ready".
// - Shows progress and enables GO to proceed to the countdown.

import { geminiCall } from '../lib/gemini.js';
import {
  initFirebase, ensureAuth, db, doc, collection, setDoc, getDoc, updateDoc, onSnapshot
} from '../lib/firebase.js';
import { JEMIMA_MATH_INTERLUDES_SPEC, QUIZ_MECHANICS_SPEC } from '../specs.js';

export default function Generation(ctx = {}) {
  const navigate = (hash) => (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  // helpers
  const lsGet = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const safeJSON = (x, f = null) => { try { return JSON.parse(x); } catch { return f; } };

  const roomCode = (lsGet('lastGameCode', '') || '').toUpperCase();
  const roleRaw = (lsGet('playerRole', 'host') || '').toLowerCase();
  const isHost = roleRaw === 'host' || roleRaw === 'daniel';

  // UI
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';

  const box = document.createElement('div');
  box.style.textAlign = 'center';
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = isHost ? 'GENERATING…' : 'JOINING…';

  const sub = document.createElement('div');
  sub.className = 'note';
  sub.textContent = isHost
    ? `Seeding questions and Jemima passages.${roomCode ? ` Room ${roomCode}.` : ''}`
    : `Waiting for host to seed${roomCode ? ` room ${roomCode}` : ''}…`;

  const statusCard = document.createElement('div');
  statusCard.className = 'card';
  statusCard.style.textAlign = 'left';

  const lRoom  = line('Room: initialising…');
  const lQs    = line('Questions: waiting…');
  const lJem   = line('Jemima passages: waiting…');
  const lMaths = line('Jemima maths: waiting…');

  statusCard.append(lRoom, lQs, lJem, lMaths);

  const bar = document.createElement('div');
  bar.className = 'progress mt-4';
  const fill = document.createElement('span');
  bar.appendChild(fill);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  btn.addEventListener('click', () => navigate('#/countdown'));
  row.appendChild(btn);

  box.append(title, sub, statusCard, bar, row);
  wrap.appendChild(box);

  // kick off
  void start();

  return wrap;

  async function start() {
    if (!roomCode || roomCode.length < 4) {
      lRoom.textContent = 'Room: missing code — go back to Key Room.';
      return;
    }

    try {
      initFirebase();
      await ensureAuth();

      // Always watch progress so guests update live
      watchProgress(roomCode);

      // HARD GUARD: if any seeds already exist, nobody reseeds
      const seeded = await roomHasAnySeeds(roomCode);

      if (!isHost || seeded) {
        // behave as guest/waiting
        lRoom.textContent = `Room: ${roomCode} — ${seeded ? 'seeded' : 'connected'} (${isHost ? 'host' : 'guest'})`;
        title.textContent = seeded ? 'READY (WAITING)…' : 'WAITING FOR HOST…';
        sub.textContent = seeded
          ? 'Content already generated. GO will enable momentarily.'
          : 'Host is generating content. This will update automatically.';
        // If already seeded, try enabling GO (room watcher will also do this)
        if (seeded) setPct(100);
        return;
      }

      // HOST path: create/update room, then seed
      await ensureRoomDoc(roomCode);
      lRoom.textContent = `Room: ${roomCode} — ready (host)`;

      setPct(5);
      await generateQuestions(roomCode); setPct(65);
      await generateInterludes(roomCode); setPct(90);
      await generateMaths(roomCode); setPct(100);

      await updateDoc(doc(collection(db, 'rooms'), roomCode), { status: 'ready', round: 0 });
      setTimeout(() => { btn.disabled = false; }, 400);
    } catch (err) {
      console.error('[generation] error', err);
      title.textContent = 'GENERATION FAILED';
      sub.textContent = String((err && err.message) || err);
    }
  }

  // --- realtime progress watchers (both roles) ---
  function watchProgress(code) {
    // room status
    onSnapshot(doc(collection(db, 'rooms'), code), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      lRoom.textContent = `Room: ${code} — status: ${d.status || '…'}`;
      if (d.status === 'ready') {
        setPct(100);
        btn.disabled = false;
        title.textContent = 'READY';
        sub.textContent = 'Content generated. Press GO to continue.';
      }
    });

    // questions
    onSnapshot(doc(db, 'rooms', code, 'seed', 'questions'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      const rounds = Array.isArray(d.rounds) ? d.rounds : [];
      let count = 0;
      for (const r of rounds) if (Array.isArray(r.questions)) count += r.questions.length;
      lQs.textContent = `Questions: ${Math.min(count, 15)}/15`;
      bumpPctTowards(60, count / 15);
    });

    // interludes
    onSnapshot(doc(db, 'rooms', code, 'seed', 'interludes'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      const passages = Array.isArray(d.passages) ? d.passages : [];
      lJem.textContent = `Jemima passages: ${passages.length}/4`;
      bumpPctTowards(85, passages.length / 4);
    });

    // maths
    onSnapshot(doc(db, 'rooms', code, 'seed', 'maths'), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() || {};
      const questions = Array.isArray(d.questions) ? d.questions : [];
      lMaths.textContent = `Jemima maths: ${questions.length}/2`;
      bumpPctTowards(100, questions.length / 2);
    });
  }

  async function ensureRoomDoc(code) {
    const ref = doc(collection(db, 'rooms'), code);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        status: 'generating',
        round: 0,
        created: Date.now(),
        version: 1
      });
    } else {
      await updateDoc(ref, { status: 'generating', round: 0 });
    }
  }

  // ---- idempotency guard ----
  async function roomHasAnySeeds(code) {
    const q = await getDoc(doc(db, 'rooms', code, 'seed', 'questions'));
    if (q.exists()) return true;
    const i = await getDoc(doc(db, 'rooms', code, 'seed', 'interludes'));
    if (i.exists()) return true;
    const m = await getDoc(doc(db, 'rooms', code, 'seed', 'maths'));
    if (m.exists()) return true;
    return false;
  }

  // ---- generation steps (host only) ----
  async function generateQuestions(code) {
    lQs.textContent = 'Questions: requesting…';
    const res = await geminiCall({
      kind: 'questions',
      spec: { mechanics: QUIZ_MECHANICS_SPEC, rounds: 5, per_round: 3 },
      temperature: 0.7
    });
    if (!res.ok) throw new Error('Questions generation failed: ' + (res.error || 'unknown'));

    const data = res.data || {};
    const rounds = Array.isArray(data.rounds) ? data.rounds : [];

    let count = 0;
    for (const r of rounds) {
      if (!Array.isArray(r.questions)) continue;
      for (const q of r.questions) {
        if (q && typeof q.q === 'string' && q.a1 && q.a2 && (q.correct === 'a1' || q.correct === 'a2')) count++;
      }
    }
    const made = Math.min(count, 15);
    const rejected = 15 - made;
    lQs.textContent = `Questions: ${made}/15 generated · ${Math.max(rejected, 0)} rejected`;

    const ref = doc(collection(db, 'rooms'), code, 'seed', 'questions');
    await setDoc(ref, { rounds, ts: Date.now() });
  }

  async function generateInterludes(code) {
    lJem.textContent = 'Jemima passages: requesting…';
    const res = await geminiCall({
      kind: 'interludes',
      spec: JEMIMA_MATH_INTERLUDES_SPEC,
      temperature: 0.8
    });
    if (!res.ok) throw new Error('Interludes generation failed: ' + (res.error || 'unknown'));

    const data = res.data || {};
    const passages = Array.isArray(data.passages) ? data.passages : [];
    lJem.textContent = `Jemima passages: ${passages.length}/4`;
    const ref = doc(collection(db, 'rooms'), code, 'seed', 'interludes');
    await setDoc(ref, { passages, ts: Date.now() });
  }

  async function generateMaths(code) {
    lMaths.textContent = 'Jemima maths: requesting…';
    const res = await geminiCall({
      kind: 'maths',
      spec: { basis: 'interludes', hint: 'two numeric questions with whole-number answers' },
      temperature: 0.6
    });
    if (!res.ok) throw new Error('Maths generation failed: ' + (res.error || 'unknown'));

    const data = res.data || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];
    lMaths.textContent = `Jemima maths: ${questions.length}/2`;
    const ref = doc(collection(db, 'rooms'), code, 'seed', 'maths');
    await setDoc(ref, { questions, notes: data.notes || '', ts: Date.now() });
  }

  // UI helpers
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
