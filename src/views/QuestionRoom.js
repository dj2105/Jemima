// /src/views/QuestionRoom.js
// Shows 3 questions for the given round. Options are 2-choice.
// Reads from Firestore seeds (rooms/{code}/seed/questions).
// Saves answers under rooms/{code}/answers/{player_round}.

import { initFirebase, db, doc, getDoc } from '../lib/firebase.js';
import { saveAnswers, state } from '../state.js';

export default function QuestionRoom(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const round = ctx.round || 1;

  // Root UI
  const root = document.createElement('div');
  root.className = 'wrap';

  const header = document.createElement('div');
  header.className = 'score-strip';
  header.textContent = `Daniel ${state.scores.daniel} | Jaime ${state.scores.jaime}`;
  root.appendChild(header);

  const title = document.createElement('div');
  title.className = 'panel-title accent-white mt-4';
  title.textContent = `Round ${round}`;
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

  // State
  const answers = [null, null, null];

  btn.addEventListener('click', async () => {
    await saveAnswers(round, answers);
    navigate(`#/mark/${round}`);
  });

  // Async: load questions for this round
  void load();

  return root;

  async function load() {
    initFirebase();
    if (!state.roomCode) {
      card.textContent = 'Error: no room joined.';
      return;
    }

    try {
      const ref = doc(db, 'rooms', state.roomCode, 'seed', 'questions');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        card.textContent = 'Questions not found in Firestore.';
        return;
      }
      const data = snap.data();
      const rounds = data.rounds || [];
      const rObj = rounds.find((r) => Number(r.round) === Number(round));
      if (!rObj) {
        card.textContent = `No questions for round ${round}.`;
        return;
      }

      renderQuestions(rObj.questions || []);
    } catch (err) {
      card.textContent = 'Failed to load questions: ' + (err.message || err);
    }
  }

  function renderQuestions(qs) {
    card.innerHTML = '';
    qs.slice(0, 3).forEach((q, idx) => {
      const block = document.createElement('div');
      block.className = idx ? 'mt-6' : '';

      const qtext = document.createElement('div');
      qtext.style.fontWeight = '700';
      qtext.textContent = `${idx + 1}. ${q.q}`;

      const opts = document.createElement('div');
      opts.className = 'mt-2';

      const b1 = mkBtn(q.a1, () => choose(idx, 'a1', b1, b2));
      const b2 = mkBtn(q.a2, () => choose(idx, 'a2', b1, b2));

      opts.append(b1, b2);
      block.append(qtext, opts);
      card.appendChild(block);
    });
  }

  function mkBtn(label, onClick) {
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

    btn.disabled = !answers.every((a) => a !== null);
  }
}
