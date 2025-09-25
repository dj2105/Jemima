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
  const setNext = (hash) => { try { localStorage.setItem('nextHash', hash); } catch {} };

  const roomCode = (lsGet('lastGameCode','') || '').toUpperCase();
  const roleRaw  = (lsGet('playerRole','host') || '').toLowerCase();
  const me       = (roleRaw === 'host' || roleRaw === 'daniel') ? 'daniel' : 'jaime';

  const round = Number(ctx.round || 1);
  const myIndices = (me === 'daniel') ? [0,1,2] : [3,4,5];

  // -------- UI --------
  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = `Round ${round} — Questions (${me === 'daniel' ? 'Host' : 'Guest'})`;
  root.appendChild(title);

  const note = document.createElement('div');
  note.className = 'mt-2';
  note.textContent = 'This phase is offline. Your answers are saved at the end.';
  root.appendChild(note);

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

  const answers = [null, null, null];
  let questions = [];

  // -------- behaviour --------
  load();

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
        card.textContent = 'Questions not found yet — waiting for host to generate.';
        return;
      }

      const data = seedSnap.data() || {};
      const rKey = `round_${round}`;
      const all = Array.isArray(data[rKey]) ? data[rKey] : [];
      if (all.length !== 6) {
        card.textContent = `Round ${round} has ${all.length} questions (expected 6).`;
        return;
      }

      questions = all;
      render();
    } catch (err) {
      console.error('[QuestionRoom] load error', err);
      card.textContent = 'Failed to load round questions.';
    }
  }

  function render() {
    card.innerHTML = '';

    myIndices.forEach((idx, i) => {
      const q = questions[idx];
      const block = document.createElement('div');
      block.className = 'qblock';

      const qt = document.createElement('div');
      qt.className = 'qtext';
      qt.textContent = `${i+1}. ${q.question}`;
      block.appendChild(qt);

      const opts = document.createElement('div');
      opts.className = 'options';

      const a1 = document.createElement('button');
      a1.className = 'btn btn-outline';
      a1.textContent = q.a1;
      a1.addEventListener('click', () => pick(i, 'a1', a1, a2));
      opts.appendChild(a1);

      const a2 = document.createElement('button');
      a2.className = 'btn btn-outline';
      a2.textContent = q.a2;
      a2.addEventListener('click', () => pick(i, 'a2', a1, a2));
      opts.appendChild(a2);

      block.appendChild(opts);
      card.appendChild(block);
    });

    btn.disabled = true;
    btn.onclick = onSubmit;
  }

  function pick(pos, val, b1, b2) {
    answers[pos] = val;
    b1.classList.toggle('selected', val === 'a1');
    b2.classList.toggle('selected', val === 'a2');
    btn.disabled = answers.some(v => v !== 'a1' && v !== 'a2');
  }

  async function onSubmit() {
    try {
      await saveAnswers();
    } catch (e) {
      console.error('[QuestionRoom] save error', e);
      // still advance; offline phase shouldn’t block
    }

    // Proceed directly to Marking (still offline)
    navigate(`#/mark/${round}`);
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
