// /src/views/QuestionRoom.js
// Question Room: shows 3 questions for the current round.
// Host (Daniel) sees Q1–Q3; Guest (Jaime) sees Q4–Q6 from the seeded 6 per round.
// Persists local answers to Firestore and advances to Marking.

import { initFirebase, ensureAuth, db, doc, collection, getDoc, setDoc } from '../lib/firebase.js';

export default function QuestionRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  // helpers
  const lsGet = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

  const roomCode = (lsGet('lastGameCode','') || '').toUpperCase();
  const roleRaw  = (lsGet('playerRole','host') || '').toLowerCase();
  const isHost   = roleRaw === 'host' || roleRaw === 'daniel';
  const round    = Number(ctx.round || 1);

  // UI
  const root = document.createElement('div');
  root.className = 'wrap';

  const header = document.createElement('h2');
  header.className = 'panel-title accent-white';
  header.textContent = `ROUND ${round}`;
  root.appendChild(header);

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'left';
  root.appendChild(card);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  btn.addEventListener('click', async () => {
    // persist answers and move to marking
    try {
      await saveAnswers();
    } catch (e) {
      console.error('[QuestionRoom] saveAnswers', e);
    }
    navigate(`#/mark/${round}`);
  });
  row.appendChild(btn);
  root.appendChild(row);

  // state
  let answers = [null, null, null];
  let questions = [];

  // start
  void load();

  return root;

  // --------- logic ----------

  async function load() {
    try {
      initFirebase();
      await ensureAuth();

      if (!roomCode) {
        card.textContent = 'Missing room code. Return to Lobby.';
        return;
      }

      const ref = doc(collection(db,'rooms'), roomCode, 'seed', 'questions');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        card.textContent = 'Questions not found yet. Please wait for the host.';
        return;
      }
      const seed = snap.data() || {};
      const rounds = Array.isArray(seed.rounds) ? seed.rounds : [];
      const thisRound = rounds.find(r => Number(r.round) === round) || { questions: [] };
      questions = Array.isArray(thisRound.questions) ? thisRound.questions : [];

      // role split: host gets first 3, guest gets last 3 (when available)
      let subset;
      if (questions.length >= 6) {
        subset = isHost ? questions.slice(0,3) : questions.slice(3,6);
      } else {
        subset = questions.slice(0,3);
      }

      renderQuestions(subset);
    } catch (e) {
      console.error('[QuestionRoom] load error', e);
      card.textContent = 'Could not load questions.';
    }
  }

  function renderQuestions(list) {
    card.innerHTML = '';
    answers = [null, null, null];

    if (!list.length) {
      const d = document.createElement('div');
      d.textContent = 'No questions available for this round.';
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

      // two options
      const optA = makeOptionButton(q?.a1 || 'A', () => choose(idx, 'a1', optA, optB, block));
      const optB = makeOptionButton(q?.a2 || 'B', () => choose(idx, 'a2', optA, optB, block));

      block.appendChild(optA);
      block.appendChild(optB);
      card.appendChild(block);
    });
  }

  function makeOptionButton(label, onClick) {
    const b = document.createElement('button');
    b.className = 'btn btn-outline option';
    b.style.marginRight = '8px';
    b.textContent = String(label).toUpperCase();
    b.addEventListener('click', onClick);
    return b;
  }

  function choose(idx, key, a, b, container) {
    // invert selected
    a.classList.add('selected');
    b.classList.remove('selected');
    // ensure .selected styles invert colours (in styles.css)
    answers[idx] = key;
    if (answers.filter(Boolean).length === 3) btn.disabled = false;
  }

  async function saveAnswers() {
    if (!roomCode) return;
    const payload = {
      role: isHost ? 'host' : 'guest',
      round,
      answers,
      at: Date.now()
    };
    const answersRef = doc(collection(db, 'rooms'), roomCode, 'answers', `${isHost ? 'host' : 'guest'}_r${round}`);
    await setDoc(answersRef, payload, { merge: true });
  }
}
