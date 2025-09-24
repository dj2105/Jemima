// /src/views/MarkingRoom.js
// Mark the opponent's 3 answers (role-based split):
// - Daniel answers indices [0,1,2]; Jaime answers [3,4,5].
// - This screen shows the opponent's 3 answers (pulled from their saved {indices, answers}).
// - You choose Correct / Incorrect for each. When done, we write:
//     rooms/{code}/marking/{me}_{round} = { marks:[true|false], ts }
// - When both players have submitted marking, we reveal *your own* correct total (truth from seeds),
//   wait 4s, then move on: rounds 1–4 → interlude/:round, round 5 → jemima.

import {
  initFirebase, ensureAuth, db, doc, getDoc, setDoc, onSnapshot
} from '../lib/firebase.js';
import { state } from '../state.js';

export default function MarkingRoom(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const round = Number(ctx.round || 1);

  // identity
  const ls = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const roomCode = (state.roomCode || ls('lastGameCode', '')).toUpperCase();
  if (!state.roomCode && roomCode) state.roomCode = roomCode;

  const roleRaw = (state.playerId || ls('playerRole', 'host')).toLowerCase();
  const me   = (roleRaw === 'guest' || roleRaw === 'jaime') ? 'jaime' : 'daniel';
  const them = me === 'daniel' ? 'jaime' : 'daniel';
  if (!state.playerId) state.playerId = me;
  if (!state.scores) state.scores = { daniel: 0, jaime: 0 };

  // ui
  const root = document.createElement('div');
  root.className = 'wrap';

  const banner = document.createElement('div');
  banner.className = 'score-strip';
  banner.textContent = `Daniel ${state.scores.daniel || 0} | Jaime ${state.scores.jaime || 0}`;
  root.appendChild(banner);

  const title = document.createElement('div');
  title.className = 'panel-title accent-white mt-4';
  title.textContent = `ROUND ${round} — MARK OPPONENT`;
  root.appendChild(title);

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
  root.appendChild(note);

  // state
  const marks = [null, null, null]; // true|false
  let oppIndices = [];
  let oppAnswers = [];
  let questionsForOpp = []; // [{q, a1, a2, correct}, ... length 3]
  let myAnswers = [];       // for reveal calc
  let myIndices = [];

  btn.addEventListener('click', async () => {
    try {
      await submitMarks(marks);
      btn.disabled = true;
      note.textContent = 'Submitted. Waiting for opponent…';
    } catch (e) {
      note.textContent = 'Failed to submit: ' + (e.message || e);
    }
  });

  // start
  void init();

  return root;

  async function init() {
    if (!roomCode) {
      card.textContent = 'Error: no room joined.';
      return;
    }
    initFirebase();
    await ensureAuth();

    try {
      // load seeds for this round
      const seedSnap = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'));
      if (!seedSnap.exists()) {
        card.textContent = 'No question seeds found.';
        return;
      }
      const allRounds = (seedSnap.data()?.rounds) || [];
      const rObj = allRounds.find((r) => Number(r.round) === round);
      if (!rObj || !Array.isArray(rObj.questions) || rObj.questions.length < 3) {
        card.textContent = `No questions for round ${round}.`;
        return;
      }
      const qArr = rObj.questions;

      // load both answers docs (mine + theirs)
      const mySnap  = await getDoc(doc(db, 'rooms', roomCode, 'answers', `${me}_${round}`));
      const oppSnap = await getDoc(doc(db, 'rooms', roomCode, 'answers', `${them}_${round}`));
      if (!oppSnap.exists()) {
        card.textContent = `Waiting for ${capitalise(them)} to submit answers…`;
        // also watch for their answers then re-render once available
        onSnapshot(doc(db, 'rooms', roomCode, 'answers', `${them}_${round}`), (sn) => {
          if (sn.exists()) { location.reload(); }
        });
        return;
      }

      // opponent data to mark
      oppIndices = (oppSnap.data()?.indices) || [];
      oppAnswers = (oppSnap.data()?.answers) || [];
      if (oppIndices.length < 3 || oppAnswers.length < 3) {
        card.textContent = 'Opponent answers incomplete.';
        return;
      }
      questionsForOpp = oppIndices.map((i) => qArr[i]).filter(Boolean);
      if (questionsForOpp.length < 3) {
        card.textContent = 'Seed mismatch for opponent indices.';
        return;
      }

      // my data for later reveal (if missing, still allow marking)
      if (mySnap.exists()) {
        myIndices = (mySnap.data()?.indices) || [];
        myAnswers = (mySnap.data()?.answers) || [];
      }

      renderBlocks(questionsForOpp, oppAnswers);

      // watch both marking docs; when both in, reveal, then proceed
      watchMarkingAndReveal();
    } catch (err) {
      card.textContent = 'Failed to load marking: ' + (err.message || err);
    }
  }

  function renderBlocks(qs3, oppAns3) {
    card.innerHTML = '';
    qs3.forEach((q, i) => {
      const block = document.createElement('div');
      if (i) block.className = 'mt-6';

      const qtext = document.createElement('div');
      qtext.style.fontWeight = '700';
      qtext.textContent = `${i + 1}. ${q.q}`;
      block.appendChild(qtext);

      const picked = oppAns3[i]; // 'a1' | 'a2'
      const pickedLabel = picked === 'a1' ? q.a1 : q.a2;

      const pickRow = document.createElement('div');
      pickRow.className = 'note mt-1';
      pickRow.textContent = `Opponent chose: ${pickedLabel}`;
      block.appendChild(pickRow);

      const btns = document.createElement('div');
      btns.className = 'mt-2';

      const bC = choiceBtn('Correct');
      const bI = choiceBtn('Incorrect');

      bC.addEventListener('click', () => choose(i, true, bC, bI));
      bI.addEventListener('click', () => choose(i, false, bC, bI));

      btns.append(bC, bI);
      block.appendChild(btns);

      card.appendChild(block);
    });
  }

  function choiceBtn(label) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.marginRight = '8px';
    b.textContent = label;

    b._setActive = (on) => {
      if (on) {
        b.style.background = '#fff';
        b.style.color = '#000';
        b.style.borderColor = '#fff';
      } else {
        b.style.background = 'transparent';
        b.style.color = '#fff';
        b.style.borderColor = '#fff';
      }
    };
    b._setActive(false);
    return b;
  }

  function choose(idx, val, bc, bi) {
    marks[idx] = val;
    bc._setActive(val === true);
    bi._setActive(val === false);

    btn.disabled = marks.some((m) => m === null);
  }

  async function submitMarks(marksArr) {
    await setDoc(doc(db, 'rooms', roomCode, 'marking', `${me}_${round}`), {
      marks: marksArr,
      ts: Date.now()
    });
  }

  function watchMarkingAndReveal() {
    let meDone = false;
    let themDone = false;

    const meRef = doc(db, 'rooms', roomCode, 'marking', `${me}_${round}`);
    const thRef = doc(db, 'rooms', roomCode, 'marking', `${them}_${round}`);

    const maybeReveal = async () => {
      if (!(meDone && themDone)) return;

      // Compute my true correct total (independent of opponent's marking)
      const seedSnap = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'));
      const allRounds = (seedSnap.data()?.rounds) || [];
      const rObj = allRounds.find((r) => Number(r.round) === round);
      const qArr = rObj?.questions || [];

      // Load my answers (if not already)
      if (!myAnswers.length || !myIndices.length) {
        const mySnap = await getDoc(doc(db, 'rooms', roomCode, 'answers', `${me}_${round}`));
        if (mySnap.exists()) {
          myIndices = (mySnap.data()?.indices) || [];
          myAnswers = (mySnap.data()?.answers) || [];
        }
      }

      const myQs = myIndices.map((i) => qArr[i]).filter(Boolean);
      let myCorrect = 0;
      for (let i = 0; i < Math.min(3, myQs.length, myAnswers.length); i++) {
        const q = myQs[i];
        const picked = myAnswers[i]; // 'a1' | 'a2'
        if (picked === q?.correct) myCorrect++;
      }

      // Reveal
      card.innerHTML = '';
      const reveal = document.createElement('div');
      reveal.className = 'panel-title accent-white';
      reveal.textContent = `You got ${myCorrect}/3 correct`;
      card.appendChild(reveal);

      // bump local banner score
      try {
        state.scores[me] = (state.scores[me] || 0) + myCorrect;
        banner.textContent = `Daniel ${state.scores.daniel || 0} | Jaime ${state.scores.jaime || 0}`;
      } catch {}

      // proceed after 4s
      setTimeout(() => {
        if (round < 5) navigate(`#/interlude/${round}`);
        else navigate('#/jemima');
      }, 4000);
    };

    onSnapshot(meRef, (sn) => {
      meDone = sn.exists();
      if (meDone) note.textContent = `${capitalise(me)} scored them.`;
      maybeReveal();
    });
    onSnapshot(thRef, (sn) => {
      themDone = sn.exists();
      if (themDone) note.textContent = `${capitalise(them)} scored you.`;
      maybeReveal();
    });
  }
}

function capitalise(s = '') { return s.charAt(0).toUpperCase() + s.slice(1); }
