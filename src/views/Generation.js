// /src/views/Generation.js
// Final version: integrates Gemini + Firestore.
// - Ensures room document exists (status: "generating").
// - Generates quiz questions, Jemima interludes, and Jemima maths via Netlify function.
// - Writes all seeds to Firestore under rooms/{code}/seed/*
// - Shows live progress; GO activates when 100% and moves to Countdown.

import { geminiCall } from '../lib/gemini.js';
import { initFirebase, db, doc, collection, setDoc, getDoc, updateDoc } from '../lib/firebase.js';
import { JEMIMA_MATH_INTERLUDES_SPEC, QUIZ_MECHANICS_SPEC } from '../specs.js';

export default function Generation(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  // ---- Local helpers ----
  const get = (k, d = '') => {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  };

  const keyRoom = safeJSON(get('keyRoom', '{}'));
  const hasGemini = !!(keyRoom?.geminiKey || getEnvGeminiHint());
  const roomCode = (get('lastGameCode', '') || '').toUpperCase();

  // Root UI
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';

  const box = document.createElement('div');
  box.style.textAlign = 'center';
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'GENERATING…';

  const sub = document.createElement('div');
  sub.className = 'note';
  sub.textContent = hasGemini
    ? `Seeding questions and Jemima passages for room ${roomCode || '—'}.`
    : 'Missing Gemini key. Add it in Key Room (or Netlify env) to proceed.';

  const statusCard = document.createElement('div');
  statusCard.className = 'card';
  statusCard.style.textAlign = 'left';

  const lRoom  = line('Room: initialising…');
  const lQs    = line('Questions: 0/15 generated · 0 rejected');
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

  // Kick off async work (don’t block initial paint)
  void start();

  return wrap;

  // ---------- functions ----------

  async function start() {
    if (!roomCode || roomCode.length < 4) {
      lRoom.textContent = 'Room: missing code — go back to Lobby/Key Room.';
      return;
    }
    if (!hasGemini) {
      lRoom.textContent = 'Room: blocked (no Gemini key).';
      return;
    }

    try {
      initFirebase();
      await ensureRoomDoc(roomCode);
      lRoom.textContent = `Room: ${roomCode} — ready`;

      // Weighted progress: Qs 60%, Interludes 25%, Maths 15%
      setPct(5);

      // Fire tasks in sequence (so logs are tidy). Could be parallel if desired.
      await generateQuestions(roomCode);
      setPct(65);

      await generateInterludes(roomCode);
      setPct(90);

      await generateMaths(roomCode);
      setPct(100);

      // Flip room status
      await updateDoc(doc(collection(db, 'rooms'), roomCode), { status: 'ready', round: 0 });

      // Enable GO shortly after 100%
      setTimeout(() => { btn.disabled = false; }, 400);
    } catch (err) {
      console.error('[gen] failed', err);
      title.textContent = 'GENERATION FAILED';
      sub.textContent = String(err?.message || err);
    }
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

  async function generateQuestions(code) {
    lQs.textContent = 'Questions: requesting…';

    // Ask Gemini for a compact 5×3 set with two options and explicit correct key.
    // We pass the mechanics spec to guide quality, but the function enforces a simple schema.
    const res = await geminiCall({
      kind: 'questions',
      spec: {
        mechanics: QUIZ_MECHANICS_SPEC,
        rounds: 5,
        per_round: 3
      },
      temperature: 0.7
    });

    if (!res.ok) throw new Error('Questions generation failed: ' + (res.error || 'unknown'));

    // Expect schema:
    // { rounds: [ { round:1, questions:[ {q, a1, a2, correct: "a1"|"a2"} ] } ] }
    const data = res.data || {};
    const rounds = Array.isArray(data.rounds) ? data.rounds : [];

    // Basic validation + count
    let count = 0;
    for (const r of rounds) {
      if (!Array.isArray(r.questions)) continue;
      for (const q of r.questions) {
        if (q && typeof q.q === 'string' && q.a1 && q.a2 && (q.correct === 'a1' || q.correct === 'a2')) {
          count++;
        }
      }
    }
    const rejected = 15 - Math.min(count, 15);
    lQs.textContent = `Questions: ${Math.min(count, 15)}/15 generated · ${Math.max(rejected, 0)} rejected`;

    // Save to Firestore
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

    // Expect: { passages: [ { round:1..4, beats:[...4] } ] }
    const data = res.data || {};
    const passages = Array.isArray(data.passages) ? data.passages : [];

    lJem.textContent = `Jemima passages: ${passages.length}/4 ready`;

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

    // Expect: { questions:[{prompt,units,answer}], notes? }
    const data = res.data || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];

    lMaths.textContent = `Jemima maths: ${questions.length}/2 ready`;

    const ref = doc(collection(db, 'rooms'), code, 'seed', 'maths');
    await setDoc(ref, { questions, notes: data.notes || '', ts: Date.now() });
  }

  function setPct(p) {
    fill.style.width = `${Math.max(0, Math.min(100, p))}%`;
  }

  function line(text) {
    const d = document.createElement('div');
    d.className = 'mt-2';
    d.textContent = text;
    return d;
  }

  function safeJSON(x, fallback = null) {
    try { return JSON.parse(x); } catch { return fallback; }
  }

  function getEnvGeminiHint() {
    // On Netlify prod, the frontend doesn’t see server env, but if a dev sets VITE_GEMINI_API_KEY it exists at build time.
    try { return import.meta?.env?.VITE_GEMINI_API_KEY || ''; } catch { return ''; }
  }
}
