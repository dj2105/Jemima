// /src/views/MarkingRoom.js
// Marking Phase (OFFLINE): you judge your opponent's 3 answers.
// Role split (as in Questions Phase):
// - Daniel (host) answered indices [0,1,2]; Jaime (guest) answered [3,4,5].
// This screen shows the opponent's 3 questions + the answer they chose.
// You mark each as Correct / Incorrect. Your marks are saved to Firestore, but
// your own awarded score is based solely on how your opponent marked YOU.
// After BOTH have submitted marks, we show “You were awarded X/3”, then set
// nextHash and send both through the Countdown to keep in sync.

import {
  initFirebase, ensureAuth, db, doc, getDoc, setDoc, onSnapshot
} from '../lib/firebase.js';

export default function MarkingRoom(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const lsGet = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const round = Number(ctx.round || 1);
  const roomCode = (lsGet('lastGameCode','') || '').toUpperCase();
  const roleRaw  = (lsGet('playerRole','host') || '').toLowerCase();
  const me       = (roleRaw === 'host' || roleRaw === 'daniel') ? 'daniel' : 'jaime';
  const them     = (me === 'daniel') ? 'jaime' : 'daniel';

  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = `Round ${round} — Marking (${me === 'daniel' ? 'Host' : 'Guest'})`;
  root.appendChild(title);

  const note = document.createElement('div');
  note.className = 'mt-2';
  note.textContent = 'This phase is offline. You both mark simultaneously.';
  root.appendChild(note);

  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';
  root.appendChild(card);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'SUBMIT MARKS';
  btn.disabled = true;
  row.appendChild(btn);
  root.appendChild(row);

  let oppIndices = [];
  let oppAnswers = [];
  let questions = [];
  let marks     = [null, null, null];

  start();

  async function start() {
    try {
      initFirebase();
      await ensureAuth();

      // Load opponent’s answers (indices + their picked a1/a2)
      const ansRef = doc(db, 'rooms', roomCode, 'answers', `${them}_${round}`);
      const ansSnap = await getDoc(ansRef);
      if (!ansSnap.exists()) {
        card.textContent = 'Waiting for opponent answers…';
        return;
      }
      const a = ansSnap.data() || {};
      oppIndices = Array.isArray(a.indices) ? a.indices : [];
      oppAnswers = Array.isArray(a.answers) ? a.answers : [];

      await renderQuestions();

      btn.disabled = marks.some(x => x !== true && x !== false);
      btn.onclick = onSubmit;

      // After submit, we wait for both to finish, then reveal awarded score and resync.
    } catch (e) {
      console.error('[MarkingRoom] start error', e);
      card.textContent = 'Could not load marking data.';
    }
  }

  async function renderQuestions() {
    // Get seeded questions for this round (same shape as QuestionRoom)
    const seed = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'));
    const data = seed.exists() ? (seed.data() || {}) : {};
    const rKey = `round_${round}`;
    questions = Array.isArray(data[rKey]) ? data[rKey] : [];

    card.innerHTML = '';
    marks = [null, null, null];

    if (!oppIndices.length || !questions.length) {
      const d = document.createElement('div');
      d.textContent = 'No items to mark yet.';
      card.appendChild(d);
      return;
    }

    // Build 3 marking blocks showing opponent’s chosen answer
    oppIndices.slice(0,3).forEach((qIndex, i) => {
      const q = questions[qIndex] || {};
      const picked = oppAnswers[i]; // 'a1' | 'a2'

      const block = document.createElement('div');
      block.className = 'mt-4';

      const h = document.createElement('div');
      h.style.fontWeight = '700';
      h.style.marginBottom = '6px';
      h.textContent = `${i + 1}. ${q?.question || '(missing question)'}`;
      block.appendChild(h);

      const sel = document.createElement('div');
      sel.className = 'mt-1';
      sel.textContent = `Their answer: ${picked === 'a2' ? (q?.a2 ?? 'B') : (q?.a1 ?? 'A')}`;
      block.appendChild(sel);

      const btnRow = document.createElement('div');
      btnRow.className = 'mt-2';

      const bYes = makeSmall('Mark Correct', () => choose(i, true, bYes, bNo));
      const bNo  = makeSmall('Mark Incorrect', () => choose(i, false, bYes, bNo));

      btnRow.appendChild(bYes);
      btnRow.appendChild(bNo);
      block.appendChild(btnRow);

      card.appendChild(block);
    });
  }

  function makeSmall(label, onClick) {
    const b = document.createElement('button');
    b.className = 'btn btn-outline';
    b.style.marginRight = '8px';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function choose(idx, val, yesBtn, noBtn) {
    marks[idx] = val;
    // visual toggle
    if (val) {
      yesBtn.classList.add('selected');
      noBtn.classList.remove('selected');
    } else {
      noBtn.classList.add('selected');
      yesBtn.classList.remove('selected');
    }
    btn.disabled = marks.filter(v => v === true || v === false).length !== 3;
  }

  async function onSubmit() {
    try {
      const myRef = doc(db, 'rooms', roomCode, 'marking', `${me}_${round}`);
      await setDoc(myRef, { marks, ts: Date.now() }, { merge: true });
    } catch (e) {
      console.error('[MarkingRoom] save marks error', e);
      // keep going; other side may still award us
    }

    // Now wait for both sides to finish and then reveal perceived award for ME
    waitForBothThenReveal();
  }

  function waitForBothThenReveal() {
    const meRef = doc(db, 'rooms', roomCode, 'marking', `${me}_${round}`);
    const thRef = doc(db, 'rooms', roomCode, 'marking', `${them}_${round}`);

    let meDone = false;
    let themDone = false;

    const maybeReveal = async () => {
      if (!(meDone && themDone)) return;

      // Opponent's marks determine *my* perceived award this round
      let awarded = 0;
      try {
        const thSnap = await getDoc(thRef);
        if (thSnap.exists()) {
          const thMarks = Array.isArray(thSnap.data()?.marks) ? thSnap.data().marks : [];
          // Opponent marked *my* 3 answers; count trues
          awarded = thMarks.slice(0,3).filter(Boolean).length;
        }
      } catch (e) {
        console.error('[MarkingRoom] read opponent marks', e);
      }

      // Update perceived totals in localStorage
      const key = (me === 'daniel') ? 'perceived_daniel' : 'perceived_jaime';
      const cur = Number(lsGet(key, '0')) || 0;
      const nextTotal = cur + awarded;
      lsSet(key, String(nextTotal));

      // Reveal
      card.innerHTML = '';
      const reveal = document.createElement('div');
      reveal.className = 'panel-title accent-white';
      reveal.textContent = `You were awarded ${awarded}/3`;
      card.appendChild(reveal);

      // After 4s, resynchronise via Countdown
      const target = (round < 5) ? `#/interlude/${round}` : '#/jemima';
      lsSet('nextHash', target);
      setTimeout(() => navigate('#/countdown'), 4000);
    };

    onSnapshot(meRef, (sn) => {
      meDone = sn.exists();
      maybeReveal();
    });
    onSnapshot(thRef, (sn) => {
      themDone = sn.exists();
      maybeReveal();
    });
  }
}

function capitalize(s=''){ return s.charAt(0).toUpperCase() + s.slice(1); }
