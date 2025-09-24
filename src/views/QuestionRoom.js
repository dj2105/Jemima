// /src/views/QuestionRoom.js
// Role-based question subsets per round.
// Daniel → first 3 items (0,1,2); Jaime → second 3 (3,4,5).
// Falls back to first 3 if fewer than 6 exist.
// Saves: rooms/{code}/answers/{player_round} = { indices:[...], answers:[...], ts }

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
  const me = roleRaw === 'guest' || roleRaw === 'jaime' ? 'jaime' : 'daniel';
  if (!state.playerId) state.playerId = me;
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

  // local state
  let servedIndices = [0, 1, 2];
  const answers = [null, null, null]; // 'a1' | 'a2'

  btn.addEventListener('click', async () => {
    try {
      await saveAnswers(roomCode, me, round, servedIndices, answers);
      navigate(`#/mark/${round}`);
    } catch (err) {
      toast(`Failed to save answers: ${(err && err.message) || err}`);
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

      // Determine subset by role.
      // Prefer 6+ questions → split 3/3. Fallback → first 3 for both.
      if (rObj.questions.length >= 6) {
        servedIndices = (me === 'daniel') ? [0, 1, 2] : [3, 4, 5];
      } else {
        servedIndices = [0, 1, 2];
      }

      // Build the three question blocks for our subset
      const subset = servedIndices.map((i) => rObj.questions[i]).filter(Boolean);
      renderQuestions(subset);
    } catch (err) {
      card.textContent = 'Failed to load questions: ' + ((err && err.message) || err);
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

      const b1 = optionButton(q.a1);
      const b2 = optionButton(q.a2);

      b1.addEventListener('click', () => choose(idx, 'a1', b1, b2));
      b2.addEventListener('click', () => choose(idx, 'a2', b1, b2));

      opts.append(b1, b2);
      block.appendChild(opts);
      card.appendChild(block);
    });
  }

  function optionButton(label) {
    const b = document.createElement('button');
    b.className = 'btn btn-opt';
    b.style.display = 'block';
    b.style.marginTop = '8px';
    b.textContent = label;

    // Inline invert style when active (works even without CSS support)
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

    // Set initial (inactive)
    b._setActive(false);
    return b;
  }

  function choose(idx, val, b1, b2) {
    answers[idx] = val;
    // toggle visuals
    b1._setActive(val === 'a1');
    b2._setActive(val === 'a2');

    // Enable GO only when all 3 answered
    btn.disabled = answers.some((a) => a === null);
  }
}

// ---- Firestore write helper ----
async function saveAnswers(roomCode, playerId, round, indices, answers) {
  initFirebase();
  await ensureAuth();
  const ref = doc(db, 'rooms', roomCode, 'answers', `${playerId}_${round}`);
  await setDoc(ref, { indices, answers, ts: Date.now() });
}

// (Optional) tiny toast helper
function toast(msg) {
  try {
    console.warn(msg);
  } catch {}
}
