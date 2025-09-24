// /src/views/JemimaQuiz.js
// Two numeric questions based on Jemima interludes.
// Reads from Firestore seeds (rooms/{code}/seed/maths).
// Stores bonus scores in localStorage for FinalResults.

import { initFirebase, db, doc, getDoc } from '../lib/firebase.js';
import { state } from '../state.js';

export default function JemimaQuiz(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));

  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'Jemima Quiz — Two Questions';
  root.appendChild(title);

  const form = document.createElement('div');
  form.className = 'card mt-4';
  form.style.textAlign = 'left';
  root.appendChild(form);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  row.appendChild(btn);
  root.appendChild(row);

  const inputs = [];

  btn.addEventListener('click', () => {
    computeScores();
  });

  // Load questions async
  void load();

  return root;

  async function load() {
    initFirebase();
    if (!state.roomCode) {
      form.textContent = 'Error: no room joined.';
      return;
    }

    try {
      const ref = doc(db, 'rooms', state.roomCode, 'seed', 'maths');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        form.textContent = 'No Jemima maths questions found.';
        return;
      }
      const data = snap.data();
      const qs = Array.isArray(data.questions) ? data.questions.slice(0, 2) : [];

      if (!qs.length) {
        form.textContent = 'Empty Jemima maths data.';
        return;
      }

      renderQuestions(qs);
    } catch (err) {
      form.textContent = 'Failed to load Jemima maths: ' + (err.message || err);
    }
  }

  function renderQuestions(qs) {
    form.innerHTML = '';
    qs.forEach((q, i) => {
      const block = document.createElement('div');
      block.className = i ? 'mt-6' : '';

      const label = document.createElement('div');
      label.style.fontWeight = '700';
      label.textContent = `Q${i + 1}. ${q.prompt || ''}`;

      const hint = document.createElement('div');
      hint.className = 'note mt-2';
      hint.textContent = q.units ? `Answer in ${q.units}` : 'Enter whole number';

      const input = document.createElement('input');
      input.className = 'input-field mt-3';
      input.placeholder = 'Enter whole number…';
      input.inputMode = 'numeric';
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^\d-]/g, '');
        checkReady();
      });

      inputs.push({ el: input, correct: q.answer });

      block.append(label, hint, input);
      form.appendChild(block);
    });
  }

  function checkReady() {
    btn.disabled = !inputs.every(({ el }) => el.value.trim() !== '');
  }

  function computeScores() {
    let danielBonus = 0;
    let jaimeBonus = 0;

    inputs.forEach((inp, idx) => {
      const correct = Number(inp.correct);
      const dVal = Number(inp.el.value || NaN);

      // Demo opponent answer: small random offset
      const jVal = correct + (Math.floor(Math.random() * 3) - 1);

      const dExact = Number.isFinite(dVal) && dVal === correct;
      const jExact = Number.isFinite(jVal) && jVal === correct;

      if (dExact && jExact) {
        danielBonus += 2;
        jaimeBonus += 2;
        return;
      }
      if (dExact) { danielBonus += 2; return; }
      if (jExact) { jaimeBonus += 2; return; }

      // Neither exact → closest gets +1 (tie → both +1)
      const dDiff = Number.isFinite(dVal) ? Math.abs(dVal - correct) : Infinity;
      const jDiff = Number.isFinite(jVal) ? Math.abs(jVal - correct) : Infinity;

      if (dDiff < jDiff) danielBonus += 1;
      else if (jDiff < dDiff) jaimeBonus += 1;
      else { danielBonus += 1; jaimeBonus += 1; }
    });

    try {
      localStorage.setItem('jemimaBonusDaniel', String(danielBonus));
      localStorage.setItem('jemimaBonusJaime', String(jaimeBonus));
    } catch {}

    root.innerHTML = '';
    const hold = document.createElement('div');
    hold.className = 'center-stage';
    const msg = document.createElement('div');
    msg.className = 'panel-title accent-white';
    msg.textContent = `Scored. Bonus — Daniel: +${danielBonus}, Jaime: +${jaimeBonus}`;
    hold.appendChild(msg);
    root.appendChild(hold);

    setTimeout(() => navigate('#/final'), 2000);
  }
}
