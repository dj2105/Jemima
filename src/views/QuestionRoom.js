// /src/views/QuestionRoom.js
// Questions Phase (OFFLINE): shows 3 questions for the current round.
// Role split: Daniel (host) answers indices [0,1,2]; Jaime (guest) answers [3,4,5].
// Saves only your own answers locally to Firestore, with no syncing during the phase.
// After all 3 are chosen, advances to Marking for the same round.

import { initFirebase, ensureAuth, db, doc, collection, getDoc, setDoc } from '../lib/firebase.js';

export default function QuestionRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  // -------- helpers --------
  const lsGet = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const setNext = (hash) => { try { localStorage.setItem('nextRoute', hash); } catch {} };

  const roomCode = (lsGet('lastGameCode','') || '').toUpperCase();
  const roleRaw  = (lsGet('playerRole','host') || '').toLowerCase();
  const me       = (roleRaw === 'guest' || roleRaw === 'jaime') ? 'jaime' : 'daniel';
  const round    = Number(ctx.round || 1);

  // -------- UI --------
  const root = document.createElement('div');
  root.className = 'wrap';

  const banner = document.createElement('div');
  banner.className = 'score-strip';
  banner.textContent = me === 'daniel' ? 'You are Daniel (Host)' : 'You are Jaime (Guest)';
  root.appendChild(banner);

  const header = document.createElement('div');
  header.className = 'panel-title accent-white mt-4';
  header.textContent = `ROUND ${round} — YOUR QUESTIONS`;
  root.appendChild(header);

  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';
  root.appendChild(card);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  row.appendChild(btn);
  root.appendChild(row);

  const note = document.createElement('div');
  note.className = 'note mt-2';
  note.textContent = 'This phase is offline. Your answers are saved at the end.';
  root.appendChild(note);

  // -------- state --------
  let questions = [];         // full 6 for the round
  let myIndices = [];         // [0,1,2] or [3,4,5]
  let mySubset  = [];         // the 3 question objects I answer
  let answers   = [null, null, null];  // 'a1' | 'a2'

  // -------- start --------
  void load();
  btn.addEventListener('click', onSubmit);

  return root;

  // ================== logic ==================

  async function load() {
    try {
      initFirebase();
      await ensureAuth();

      if (!roomCode) {
        card.textContent = 'Missing room code. Return to Lobby.';
        return;
      }

      const seedRef = doc(collection(db,'rooms'), roomCode, 'seed', 'questions');
      const seedSnap = await getDoc(seedRef);
      if (!seedSnap.exists()) {
        card.textContent = 'Questions not found yet. Please wait for the host to seed.';
        return;
      }

      const data = seedSnap.data() || {};
      const rounds = Array.isArray(data.rounds) ? data.rounds : [];
      const rObj = rounds.find(r => Number(r.round) === round);
      if (!rObj || !Array.isArray(rObj.questions) || rObj.questions.length === 0) {
        card.textContent = `No questions available for round ${round}.`;
        return;
      }

      questions = rObj.questions;

      // Role split: Daniel gets first 3, Jaime gets last 3 (fallback to first 3 if <6)
      if (questions.length >= 6) {
        myIndices = (me === 'daniel') ? [0,1,2] : [3,4,5];
      } else {
        // fallback: still ensure 3 (or as many as exist)
        myIndices = [0,1,2].filter(i => i < questions.length);
      }
      mySubset = myIndices.map(i => questions[i]).filter(Boolean);

      renderQuestions(mySubset);
    } catch (err) {
      console.error('[QuestionRoom] load error', err);
      card.textContent = 'Could not load questions.';
    }
  }

  function renderQuestions(list) {
    card.innerHTML = '';
    answers = new Array(Math.min(3, list.length)).fill(null);

    if (!list.length) {
      const d = document.createElement('div');
      d.textContent = 'No questions available.';
      card.appendChild(d);
      return;
    }

    list.forEach((q, idx) => {
      const block = document.createElement('div');
      block.className = 'mt-4';

      const h = document.createElement('div');
      h.style.fontWeight = '700';
      h.style.marginBottom = '8px';
      h.textContent = `${idx + 1}. ${q?.q || '(missing text)'}`;
      block.appendChild(h);

      const optsRow = document.createElement('div');
      const optA = makeOptionButton(q?.a1 ?? 'A', () => choose(idx, 'a1', optA, optB));
      const optB = makeOptionButton(q?.a2 ?? 'B', () => choose(idx, 'a2', optA, optB));
      optsRow.appendChild(optA);
      optsRow.appendChild(optB);

      block.appendChild(optsRow);
      card.appendChild(block);
    });
  }

  function makeOptionButton(label, onClick) {
    const b = document.createElement('button');
    b.className = 'btn btn-outline option';
    b.style.marginRight = '8px';
    b.textContent = String(label);
    b.addEventListener('click', onClick);
    return b;
  }

  function choose(idx, key, aBtn, bBtn) {
    // visual
    aBtn.classList.add('selected');
    if (bBtn) bBtn.classList.remove('selected');
    // store
    answers[idx] = key; // 'a1' | 'a2'
    // enable when all chosen
    if (answers.filter(Boolean).length === answers.length) btn.disabled = false;
  }

  async function onSubmit() {
    try {
      await saveAnswers();
    } catch (e) {
      console.error('[QuestionRoom] saveAnswers error', e);
      // still advance; offline phase shouldn’t block
    }
    // Proceed directly to Marking (still offline)
    const next = `#/marking/${round}`;
    setNext(next); // not strictly needed here, but harmless
    navigate(next);
  }

  async function saveAnswers() {
    if (!roomCode || !myIndices.length) return;
    // Persist ONLY my answers; opponent remains isolated until marking.
    const payload = {
      role: me,                 // 'daniel' | 'jaime'
      round,
      indices: myIndices,       // which of the 6 seeded Qs I answered
      answers,                  // 'a1' | 'a2' for each of my 3
      ts: Date.now()
    };
    const id = `${me}_${round}`; // MarkingRoom expects this exact id
    const ref = doc(collection(db, 'rooms'), roomCode, 'answers', id);
    await setDoc(ref, payload, { merge: true });
  }
}
