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

  const roomCode = (lsGet('lastGameCode','') || '').toUpperCase();
  const roleRaw  = (lsGet('playerRole','host') || '').toLowerCase();
  const me       = (roleRaw === 'guest' || roleRaw === 'jaime') ? 'jaime' : 'daniel';
  const them     = (me === 'daniel') ? 'jaime' : 'daniel';
  const round    = Number(ctx.round || 1);

  // ---- UI scaffold ----
  const root = document.createElement('div');
  root.className = 'wrap';

  const banner = document.createElement('div');
  banner.className = 'score-strip';
  banner.textContent = `Marking — You are ${me === 'daniel' ? 'Daniel (Host)' : 'Jaime (Guest)'}`;
  root.appendChild(banner);

  const title = document.createElement('div');
  title.className = 'panel-title accent-white mt-2';
  title.textContent = `ROUND ${round} — MARK YOUR OPPONENT`;
  root.appendChild(title);

  const card = document.createElement('div');
  card.className = 'card mt-3';
  card.style.textAlign = 'left';
  root.appendChild(card);

  const note = document.createElement('div');
  note.className = 'note mt-2';
  note.textContent = 'This phase is offline. You both mark simultaneously.';
  root.appendChild(note);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'SUBMIT MARKING';
  btn.disabled = true;
  row.appendChild(btn);
  root.appendChild(row);

  // ---- State ----
  let oppIndices = [];      // opponent's question indices within seeded 6
  let oppAnswers = [];      // opponent's selected 'a1' | 'a2'
  let questions  = [];      // full 6 question objects for this round
  let marks      = [null, null, null]; // true/false

  // Start
  void start();
  btn.addEventListener('click', onSubmit);

  return root;

  // ===================== Logic =====================

  async function start() {
    if (!roomCode) {
      card.textContent = 'Missing room code. Return to Lobby.';
      return;
    }
    try {
      initFirebase();
      await ensureAuth();

      // Load opponent answers
      const ansRef = doc(db, 'rooms', roomCode, 'answers', `${them}_${round}`);
      const ansSnap = await getDoc(ansRef);
      if (!ansSnap.exists()) {
        card.textContent = `Waiting for ${capitalize(them)} to finish their questions…`;
        // Passive snapshot to auto-render when they appear
        onSnapshot(ansRef, (sn) => {
          if (!sn.exists()) return;
          oppIndices = sn.data()?.indices || [];
          oppAnswers = sn.data()?.answers || [];
          void renderQuestions();
        });
        return;
      }
      oppIndices = ansSnap.data()?.indices || [];
      oppAnswers = ansSnap.data()?.answers || [];

      await renderQuestions();
    } catch (err) {
      console.error('[MarkingRoom] start error', err);
      card.textContent = 'Could not load opponent answers.';
    }
  }

  async function renderQuestions() {
    // Get seeded questions for this round
    const seed = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'));
    const rounds = Array.isArray(seed.data()?.rounds) ? seed.data().rounds : [];
    const rObj = rounds.find(r => Number(r.round) === round) || {};
    questions = Array.isArray(rObj.questions) ? rObj.questions : [];

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
      h.textContent = `${i + 1}. ${q?.q || '(missing question)'}`;
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

    // Now wait until BOTH have submitted marking, then reveal my awarded score.
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
