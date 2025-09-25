// /src/views/Generation.js
// Host seeds; guest watches. Guarantees 6 Qs per round (5 rounds).
// Writes under rooms/{code}/seed/{questions|interludes|maths}. When ready,
// sets localStorage.nextHash to '#/round/1' and navigates both to '#/countdown'.
// If Gemini API is unavailable, falls back to deterministic demo content so the
// whole game flow remains playable.

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
  btn.textContent = 'BEGIN';
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
      // Attempt Gemini generation, but always have a fallback
      const generated = await tryGenerateAllViaGemini().catch(() => null);
      const dataset = generated || demoSeed();

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

    await setDoc(qRef, { rounds, ...roundMap }, { merge: true });
    append('Questions seeded.');

    // Interludes
    await setDoc(iRef, { passages: dataset.interludes }, { merge: true });
    append('Interludes seeded.');

    // Maths
    await setDoc(mRef, { questions: dataset.maths }, { merge: true });
    append('Maths seeded.');
  }

  async function tryGenerateAllViaGemini() {
    // Read any custom prompt JSON supplied in Key Room
    const qSpecJson = get('questionsSpecJson', '');
    const iSpecJson = get('interludesSpecJson', '');
    let qSpec = QUIZ_MECHANICS_SPEC;
    let iSpec = JEMIMA_MATH_INTERLUDES_SPEC;
    try { if (qSpecJson) qSpec = JSON.parse(qSpecJson); } catch {}
    try { if (iSpecJson) iSpec = JSON.parse(iSpecJson); } catch {}

    // Ask server to generate a full pack in one or two calls, depending on your setup.
    // For robustness here, we just attempt two independent calls.
    append('Contacting Gemini for questions…');
    const qResp = await geminiCall({ kind: 'quiz_pack', spec: qSpec });
    if (!qResp || qResp.ok === false) throw new Error('Gemini questions failed');

    append('Contacting Gemini for interludes + maths…');
    const iResp = await geminiCall({ kind: 'interludes_pack', spec: iSpec });
    if (!iResp || iResp.ok === false) throw new Error('Gemini interludes failed');

    // Expecting shapes similar to our dataset; if not, the fallback demo will be used instead.
    const rounds = normaliseRounds(qResp.data);
    const interludes = normaliseInterludes(iResp.data);
    const maths = normaliseMaths(iResp.data);

    if (!rounds.length || interludes.length < 4 || maths.length < 2) throw new Error('Incomplete generation');

    return { rounds, interludes, maths };
  }

  function normaliseRounds(data) {
    // Accept either { rounds:[{round,questions:[]},…] } or { round_1:[…], … }
    const out = [];
    if (Array.isArray(data?.rounds)) {
      data.rounds.slice(0,5).forEach((r,i) => {
        const rr = Number(r.round) || (i+1);
        const qs = Array.isArray(r.questions) ? r.questions.slice(0,6) : [];
        out.push(qs6(rr, qs));
      });
      return out;
    }
    // key form
    for (let r=1;r<=5;r++){
      const arr = Array.isArray(data?.[`round_${r}`]) ? data[`round_${r}`].slice(0,6) : [];
      out.push(qs6(r, arr));
    }
    return out;
  }

  function qs6(round, qs) {
    // Ensure each question has {question,a1,a2,correct}
    const padded = [...qs];
    while (padded.length < 6) {
      padded.push({ question: `Placeholder Q${padded.length+1} (round ${round})`, a1: 'A', a2: 'B', correct: 'a1' });
    }
    return { round, questions: padded.map(q => ({
      question: String(q.question || ''),
      a1: String(q.a1 ?? q.options?.[0] ?? 'A'),
      a2: String(q.a2 ?? q.options?.[1] ?? 'B'),
      correct: (q.correct === 'a2' || q.correct === 'B' || q.correct === 2) ? 'a2' : 'a1'
    }))};
  }

  function normaliseInterludes(data) {
    // Expect array of 4 items: { round, beats:[4 strings] }
    const out = [];
    const src = Array.isArray(data?.passages) ? data.passages : [];
    for (let r=1;r<=4;r++){
      const item = src.find(p => Number(p.round) === r) || null;
      const beats = Array.isArray(item?.beats) ? item.beats.slice(0,4) : [
        `Demo passage ${r} — beat 1 with a number: ${r*3}`,
        `Beat 2 number: ${r*5}`,
        `Beat 3 number: ${r*7}`,
        `Beat 4 number: ${r*9}`
      ];
      out.push({ round: r, beats });
    }
    return out;
  }

  function normaliseMaths(data) {
    // Expect { questions:[{prompt,units?,answer(number)}] } — take first 2
    const qs = Array.isArray(data?.questions) ? data.questions.slice(0,2) : [];
    if (qs.length === 2) return qs.map(x => ({
      prompt: String(x.prompt || 'How many?'),
      units:  x.units ? String(x.units) : undefined,
      answer: Number(x.answer) || 0
    }));
    // fallback tied to demo interlude numbers
    return [
      { prompt: 'Sum of the four “beat 1” numbers?', units: undefined, answer: 3+5+7+9 },
      { prompt: 'Difference between last “beat 4” and first “beat 2”?', units: undefined, answer: (9*4) - (5*1) }
    ];
  }

  function demoSeed() {
    // Deterministic offline pack — lets the game run without Gemini.
    append('Using demo content.');
    const rounds = [];
    for (let r=1;r<=5;r++){
      const qs = [];
      for (let i=1;i<=6;i++){
        qs.push({
          question: `Round ${r} — Q${i}: Which option is correct?`,
          a1: `Option A (round ${r}, q${i})`,
          a2: `Option B (round ${r}, q${i})`,
          correct: (i % 2 === 0) ? 'a2' : 'a1'
        });
      }
      rounds.push({ round: r, questions: qs });
    }
    const interludes = [
      { round: 1, beats: ['She had €10.', 'Bought 2 pastries for €3 each.', 'Found 1 coin on pavement.', 'Gave 2 coins to busker.'] },
      { round: 2, beats: ['Train left at 09:15.', 'Arrived 47 minutes later.', 'Queue took 8 minutes.', 'Left shop at 10:30.'] },
      { round: 3, beats: ['Three boxes with 4 apples each.', 'A friend ate 3 apples.', 'She bought 5 more apples.', 'She gave away 2 apples.'] },
      { round: 4, beats: ['Ticket strips: 12 total.', 'Used 4 for rides.', 'Won 3 extra tickets.', 'Gave 2 to a kid.'] }
    ];
    const maths = [
      { prompt: 'How many euros remain from Round 1?', units: 'euros', answer: 10 - (2*3) + 1 - 2 },
      { prompt: 'Total tickets after Round 4?', units: 'tickets', answer: 12 - 4 + 3 - 2 }
    ];
    return { rounds, interludes, maths };
  }

  function append(text) {
    const line = document.createElement('div');
    line.textContent = text;
    log.appendChild(line);
  }
  function setPct(p) { fill.style.width = `${Math.max(0, Math.min(100, p))}%`; }
}
