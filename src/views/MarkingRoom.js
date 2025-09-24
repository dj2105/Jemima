// /src/views/MarkingRoom.js
// Lets player mark opponent’s answers for the round.
// Saves marking under rooms/{code}/marking/{player_round}.
// Waits for opponent’s marking before revealing score.

import { initFirebase, db, doc, getDoc } from '../lib/firebase.js';
import { saveMarking, onOpponentMarking, state } from '../state.js';

export default function MarkingRoom(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const round = ctx.round || 1;

  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = `Marking Round ${round}`;
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

  const marks = [];

  btn.addEventListener('click', async () => {
    await saveMarking(round, marks);
    // Show waiting message
    root.innerHTML = '';
    const hold = document.createElement('div');
    hold.className = 'center-stage';
    const msg = document.createElement('div');
    msg.className = 'panel-title accent-white';
    msg.textContent = `${oppName()} scored you… waiting for reveal.`;
    hold.appendChild(msg);
    root.appendChild(hold);
  });

  // Subscribe to opponent’s marking → when both done, compute reveal
  onOpponentMarking(round, (data) => {
    if (marks.length && data?.marks) {
      revealScores(data.marks);
    }
  });

  // Async: load opponent answers
  void load();

  return root;

  async function load() {
    initFirebase();
    if (!state.roomCode) {
      card.textContent = 'Error: no room joined.';
      return;
    }

    try {
      // Get opponent’s answers
      const opp = oppName();
      const ref = doc(db, 'rooms', state.roomCode, 'answers', `${opp}_${round}`);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        card.textContent = 'Opponent answers not found.';
        return;
      }
      const data = snap.data();
      renderAnswers(data.answers || []);
    } catch (err) {
      card.textContent = 'Failed to load opponent answers: ' + (err.message || err);
    }
  }

  function renderAnswers(ans) {
    card.innerHTML = '';
    ans.forEach((a, idx) => {
      const block = document.createElement('div');
      block.className = idx ? 'mt-6' : '';

      const qtext = document.createElement('div');
      qtext.style.fontWeight = '700';
      qtext.textContent = `Q${idx + 1}: Opponent chose ${a}`;
      block.appendChild(qtext);

      const opts = document.createElement('div');
      opts.className = 'mt-2';

      const b1 = mkBtn('Correct', () => choose(idx, true, b1, b2));
      const b2 = mkBtn('Incorrect', () => choose(idx, false, b1, b2));

      opts.append(b1, b2);
      block.appendChild(opts);
      card.appendChild(block);
    });
  }

  function mkBtn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'btn btn-opt';
    b.style.marginRight = '10px';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function choose(idx, val, b1, b2) {
    marks[idx] = val;
    b1.classList.remove('btn-active');
    b2.classList.remove('btn-active');
    if (val === true) b1.classList.add('btn-active');
    if (val === false) b2.classList.add('btn-active');
    btn.disabled = marks.length < 3 || marks.some((m) => m === undefined);
  }

  function revealScores(oppMarks) {
    root.innerHTML = '';
    const hold = document.createElement('div');
    hold.className = 'center-stage';
    const total = marks.filter((m) => m === true).length;
    const msg = document.createElement('div');
    msg.className = 'panel-title accent-white';
    msg.textContent = `Round ${round} — You scored ${total}/3`;
    hold.appendChild(msg);
    root.appendChild(hold);

    setTimeout(() => {
      if (round < 5) {
        if (round < 5) navigate(`#/interlude/${round}`);
      } else {
        navigate('#/jemima');
      }
    }, 4000);
  }

  function oppName() {
    return state.playerId === 'daniel' ? 'jaime' : 'daniel';
  }
}
