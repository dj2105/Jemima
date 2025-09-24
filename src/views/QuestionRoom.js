// /src/views/QuestionRoom.js
// Round screen: loads 3 questions for the given round from Firestore seeds,
// lets the current player answer, then saves answers to
//   rooms/{code}/answers/{player_round}  (player in {daniel|jaime})
//
// Fixes:
// - Falls back to localStorage for room code if state is empty.
// - Infers player role from localStorage ('playerRole' = host/guest → daniel/jaime).
// - Ensures Anonymous Auth before Firestore ops.

import {
  initFirebase, ensureAuth, db, doc, getDoc, setDoc
} from '../lib/firebase.js';
import { state } from '../state.js';

export default function QuestionRoom(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const round = Number(ctx.round || 1);

  // ---- Resolve room + player from state OR localStorage ----
  const ls = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

  const roomCode = (state.roomCode || ls('lastGameCode', '')).toUpperCase();
  if (!state.roomCode && roomCode) state.roomCode = roomCode;

  const roleRaw = (state.playerId || ls('playerRole', 'host')).toLowerCase();
  // Map to canonical ids
  const playerId = roleRaw === 'guest' ? 'jaime'
                  : roleRaw === 'jaime' ? 'jaime'
                  : 'daniel'; // default host→daniel

  if (!state.playerId) state.playerId = playerId;
  if (!state.scores) state.scores = { daniel: 0, jaime: 0 };

  // ---- UI scaffolding ----
  const root = document.createElement('div');
  root.className = 'wrap';

  const banner = document.createElement('div');
  banner.className = 'score-strip';
  banner.textContent = `Daniel ${state.scores.daniel || 0} | Jaime ${state.scores.jaime || 0}`;
  root.appendChild(banner);

  const title = document.createElement('div');
  title.className = 'panel-title accent-white mt-4';
  title.textContent = `ROUND ${round}`;
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

  // ---- Local state ----
  const answers = [null, null, null];

  btn.addEventListener('click', async () => {
    try {
      await saveAnswersToFirestore(roomCode, playerId, round, answers);
      navigate(`#/mark/${round}`);
    } catch (err) {
      card.textContent = 'Failed to save answers: ' + (err.message || err);
    }
  });

  // ---- Load questions ----
  void load();

  return root;

  async function load() {
    if (!roomCode) {
      card.textContent = 'Error: no room joined.';
      return;
    }

    try {
      initFirebase();
      await ensureAuth();

      const ref = doc(db, 'rooms', roomCode, 'seed', 'questions');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        card.textContent = 'Questions not found for this room.';
        return;
      }

      const data = snap.data() || {};
      const rounds = Array.isArray(data.rounds) ? data.rounds : [];
      const rObj = rounds.find((r) => Number(r.round) === round);

      if (!rObj || !Array.isArray(rObj.questions) || rObj.questions.length < 3) {
        card.textContent = `No questions available for round ${round}.`;
        return;
      }

      renderQuestions(rObj.questions.slice(0, 3));
    } catch (err) {
      card.textContent = 'Failed to load questions: ' + (err.message || err);
    }
  }

  function renderQuestions(qs) {
    card.innerHTML = '';

    qs.forEach((q, idx) => {
      const block = document.createElement('div');
      if (idx) block.className = 'mt-6';

      const qtext = document.createElement('div');
      qtext.style.fontWeight = '700';
      qtext.textContent = `${idx + 1}. ${q.q}`;
      block.appendChild(qtext);

      const opts = document.createElement('div');
      opts.className = 'mt-2';

      const b1 = optionButton(q.a1, () => choose(idx, 'a1', b1, b2));
      const b2 = optionButton(q.a2, () => choose(idx, 'a2', b1, b2));

      opts.append(b1, b2);
      block.appendChild(opts);
      card.appendChild(block);
    });
  }

  function optionButton(label, onClick) {
    const b = document.createElement('button');
    b.className = 'btn btn-opt';
    b.style.display = 'block';
    b.style.marginTop = '8px';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function choose(idx, val, b1, b2) {
    answers[idx] = val;
    b1.classList.remove('btn-active');
    b2.classList.remove('btn-active');
    if (val === 'a1') b1.classList.add('btn-active');
    if (val === 'a2') b2.classList.add('btn-active');

    btn.disabled = answers.some((a) => a === null);
  }
}

// ---- Firestore write helper ----
async function saveAnswersToFirestore(roomCode, playerId, round, answers) {
  initFirebase();
  await ensureAuth();
  const ref = doc(db, 'rooms', roomCode, 'answers', `${playerId}_${round}`);
  await setDoc(ref, { answers, ts: Date.now() });
}
