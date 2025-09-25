// /src/views/Generation.js
// Host seeds; guest watches. Guarantees 6 Qs per round (5 rounds).
// Writes under rooms/{code}/seed/{questions|interludes|maths}. When ready,
// sets localStorage.nextHash to '#/round/1' and navigates both to '#/countdown'.
//
// IMPORTANT: No fallbacks. If Gemini generation fails or returns invalid data,
// we show a clear error and DO NOT seed anything.

import { geminiCall } from '../lib/gemini.js';
import {
  initFirebase, ensureAuth, db, doc, collection, setDoc, getDoc, onSnapshot
} from '../lib/firebase.js';
import { JEMIMA_MATH_INTERLUDES_SPEC, QUIZ_MECHANICS_SPEC } from '../specs.js';

export default function Generation(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  // helpers
  const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const roomCode = (get('lastGameCode', '') || '').toUpperCase();
  const roleRaw  = (get('playerRole','host') || '').toLowerCase();
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

  const note = document.createElement('div');
  note.className = 'note mt-2';
  note.textContent = isHost
    ? 'Seeding 5 rounds × 6 questions, plus 4 Jemima passages and 2 maths questions…'
    : 'The host is generating content. This will advance automatically.';
  box.appendChild(note);

  const meter = document.createElement('div');
  meter.className = 'progress mt-4';
  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  meter.appendChild(fill);
  box.appendChild(meter);

  const log = document.createElement('div');
  log.className = 'card mt-4';
  log.style.textAlign = 'left';
  log.textContent = 'Initialising…';
  box.appendChild(log);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = isHost ? 'BEGIN' : 'Waiting…';
  btn.disabled = !isHost;
  row.appendChild(btn);
  box.appendChild(row);

  wrap.appendChild(box);

  if (isHost) btn.addEventListener('click', () => void start());
  else waitForSeedThenAdvance();

  return wrap;

  async function start() {
    try {
      setPct(5);
      initFirebase();
      await ensureAuth();
      append('Signed in. Room: ' + (roomCode || '(none)'));
      if (!roomCode) { append('Missing room code. Return to Lobby.'); return; }

      setPct(10);

      // Strict: Gemini must succeed. No fallbacks.
      const dataset = await generateAllViaGeminiStrict();

      setPct(40);
      await writeSeeds(dataset);

      setPct(90);
      append('Seeds written. Pinging guest…');

      // Move both players to Round 1 via Countdown
      set('nextHash', '#/round/1');
      navigate('#/countdown');
    } catch (e) {
      console.error('[Generation] start error', e);
      append('Error: ' + (e.message || e));
      // Do not seed, do not advance.
    }
  }

  function waitForSeedThenAdvance() {
    // Guests watch the questions seed doc; when it appears, we jump to Countdown.
    if (!roomCode) return;
    initFirebase();
    const ref = doc(collection(db,'rooms'), roomCode, 'seed', 'questions');
    onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        set('nextHash', '#/round/1');
        navigate('#/countdown');
      }
    });
  }

  async function writeSeeds(dataset) {
    const base = doc(collection(db,'rooms'), roomCode);
    const qRef = doc(base, 'seed', 'questions');
    const iRef = doc(base, 'seed', 'interludes');
    const mRef = doc(base, 'seed', 'maths');

    // Questions — write both shapes for compatibility:
    //  (a) rounds: [{ round, questions:[{question,a1,a2,correct}] }]
    //  (b) round_1…round_5: arrays of 6 questions (same objects)
    const rounds = dataset.rounds;
    const roundMap = {};
    rounds.forEach(r => { roundMap[`round_${r.round}`] = r.questions; });

    // Deep-sanitise to remove any undefineds (Firestore forbids undefined)
    const safeQuestionsDoc = stripUndefined({ rounds, ...roundMap });

    await setDoc(qRef, safeQuestionsDoc, { merge: true });
    append('Questions seeded.');

    // Interludes: { passages: [{ round, beats:[4 strings] }, …] }
    const safeInterludesDoc = stripUndefined({ passages: dataset.interludes });
    await setDoc(iRef, safeInterludesDoc, { merge: true });
    append('Interludes seeded.');

    // Maths: { questions: [{ prompt, units?, answer }, { … }] }
    const safeMathsDoc = stripUndefined({ questions: dataset.maths });
    await setDoc(mRef, safeMathsDoc, { merge: true });
    append('Maths seeded.');
  }

  async function generateAllViaGeminiStrict() {
    // Read any custom prompt JSON supplied in Key Room
    const qSpecJson = get('questionsSpecJson', '');
    const iSpecJson = get('interludesSpecJson', '');
    let qSpec = QUIZ_MECHANICS_SPEC;
    let iSpec = JEMIMA_MATH_INTERLUDES_SPEC;
    try { if (qSpecJson) qSpec = JSON.parse(qSpecJson); } catch {}
    try { if (iSpecJson) iSpec = JSON.parse(iSpecJson); } catch {}

    append('Contacting Gemini for questions…');
    const qResp = await geminiCall({ kind: 'quiz_pack', spec: qSpec });
    if (!qResp || qResp.ok === false) throw new Error('Gemini questions failed');

    append('Contacting Gemini for interludes + maths…');
    const iResp = await geminiCall({ kind: 'interludes_pack', spec: iSpec });
    if (!iResp || iResp.ok === false) throw new Error('Gemini interludes failed');

    // Normalise and validate — throw on any invalidity.
    const rounds = normaliseRoundsStrict(qResp.data);
    const interludes = normaliseInterludesStrict(iResp.data);
    const maths = normaliseMathsStrict(iResp.data);

    // Basic integrity checks
    if (rounds.length !== 5) throw new Error('Expected 5 rounds of questions.');
    for (let r = 1; r <= 5; r++) {
      const rr = rounds.find(x => Number(x.round) === r);
      if (!rr || !Array.isArray(rr.questions) || rr.questions.length !== 6) {
        throw new Error(`Round ${r} invalid — expected 6 questions.`);
      }
    }
    if (interludes.length !== 4) throw new Error('Expected 4 interludes.');
    if (maths.length !== 2) throw new Error('Expected 2 maths questions.');

    return { rounds, interludes, maths };
  }

  // ------- Normalisers (strict; no undefineds allowed) -------

  function normaliseRoundsStrict(data) {
    const out = [];

    if (Array.isArray(data?.rounds)) {
      data.rounds.slice(0,5).forEach((r, i) => {
        const rr = Number(r.round) || (i + 1);
        const qs = Array.isArray(r.questions) ? r.questions.slice(0,6) : [];
        out.push(qs6(rr, qs));
      });
    } else {
      // key form: round_1..round_5
      for (let r = 1; r <= 5; r++) {
        const arr = Array.isArray(data?.[`round_${r}`]) ? data[`round_${r}`].slice(0,6) : [];
        out.push(qs6(r, arr));
      }
    }

    return out;
  }

  function qs6(round, qs) {
    // Ensure each question is {question,a1,a2,correct} with no undefineds
    const padded = [...qs];
    while (padded.length < 6) {
      // still strict: create neutral placeholders to maintain shape
      padded.push({ question: `Q${padded.length+1} (round ${round})`, a1: 'A', a2: 'B', correct: 'a1' });
    }
    return {
      round,
      questions: padded.map(q => ({
        question: String(q?.question ?? ''),
        a1: String(q?.a1 ?? q?.options?.[0] ?? 'A'),
        a2: String(q?.a2 ?? q?.options?.[1] ?? 'B'),
        // Only 'a1' or 'a2' allowed; default to 'a1' if ambiguous
        correct: (q?.correct === 'a2' || q?.correct === 'B' || q?.correct === 2) ? 'a2' : 'a1'
      }))
    };
  }

  function normaliseInterludesStrict(data) {
    // Expect array of 4: { round, beats:[4 strings] }
    const out = [];
    const src = Array.isArray(data?.passages) ? data.passages : [];
    for (let r = 1; r <= 4; r++) {
      const item = src.find(p => Number(p?.round) === r) || {};
      const beatsSrc = Array.isArray(item.beats) ? item.beats : [];
      const beats = [];
      for (let i = 0; i < 4; i++) {
        const v = beatsSrc[i];
        beats.push(String(v ?? ''));
      }
      out.push({ round: r, beats });
    }
    return out;
  }

  function normaliseMathsStrict(data) {
    // Expect { questions:[{prompt,units?,answer(number)}] } — take first 2
    const qs = Array.isArray(data?.questions) ? data.questions.slice(0, 2) : [];
    if (qs.length !== 2) throw new Error('Gemini maths: expected exactly 2 questions.');

    return qs.map((x, i) => {
      const prompt = String(x?.prompt ?? '').trim();
      const answerNum = Number(x?.answer);
      if (!prompt) throw new Error(`Maths Q${i+1}: missing prompt.`);
      if (!Number.isFinite(answerNum)) throw new Error(`Maths Q${i+1}: invalid numeric answer.`);
      const obj = { prompt, answer: answerNum };
      if (x?.units != null && String(x.units).trim() !== '') {
        obj.units = String(x.units);
      }
      return obj; // no undefined keys
    });
  }

  // ------- Utils -------

  function stripUndefined(v) {
    if (Array.isArray(v)) return v.map(stripUndefined);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) {
        const val = v[k];
        if (val === undefined) continue; // drop undefined
        o[k] = stripUndefined(val);
      }
      return o;
    }
    return v;
  }

  function append(text) {
    const line = document.createElement('div');
    line.textContent = text;
    log.appendChild(line);
  }

  function setPct(p) {
    fill.style.width = `${Math.max(0, Math.min(100, p))}%`;
  }
}
