// /src/views/FinalRoom.js
// Final Room: reveal Perceived vs Actual totals and declare winner.
// Perceived = sum of awards shown after each marking round (stored locally).
// Actual = objective correctness across all 5 rounds + Jemima bonus.
// This screen is client-side; it reads Firestore seeds + answers to compute truth.

import { initFirebase, db, doc, getDoc } from '../lib/firebase.js';

export default function FinalRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

  const roomCode = (get('lastGameCode', '') || '').toUpperCase();

  const root = document.createElement('div');
  root.className = 'wrap';

  const box = document.createElement('div');
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';
  box.style.textAlign = 'center';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'Final Room — Truth vs Perception';
  box.appendChild(title);

  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';
  card.textContent = 'Computing final scores…';
  box.appendChild(card);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'Play Again';
  btn.addEventListener('click', () => navigate('#/'));
  row.appendChild(btn);

  box.appendChild(row);
  root.appendChild(box);

  void compute();

  return root;

  async function compute() {
    if (!roomCode) {
      card.textContent = 'Missing room code.';
      return;
    }
    try {
      initFirebase();
      // Load seeds
      const seedSnap = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'questions'));
      if (!seedSnap.exists()) {
        card.textContent = 'No seeded questions found.';
        return;
      }
      const rounds = Array.isArray(seedSnap.data()?.rounds) ? seedSnap.data().rounds : [];

      // Helper to compute correct total for one player
      async function correctTotalFor(player) {
        let total = 0;
        for (let r = 1; r <= 5; r++) {
          const aSnap = await getDoc(doc(db, 'rooms', roomCode, 'answers', `${player}_${r}`));
          if (!aSnap.exists()) continue;
          const indices = Array.isArray(aSnap.data()?.indices) ? aSnap.data().indices : [];
          const answers = Array.isArray(aSnap.data()?.answers) ? aSnap.data().answers : [];
          const rObj = rounds.find(rr => Number(rr.round) === r);
          const qArr = Array.isArray(rObj?.questions) ? rObj.questions : [];
          for (let i = 0; i < Math.min(3, indices.length, answers.length); i++) {
            const q = qArr[indices[i]] || null;
            const picked = answers[i];
            if (q && picked && picked === q.correct) total++;
          }
        }
        return total;
      }

      const actualDanielBase = await correctTotalFor('daniel');
      const actualJaimeBase  = await correctTotalFor('jaime');

      const jemD = Number(get('jemimaBonusDaniel', '0')) || 0;
      const jemJ = Number(get('jemimaBonusJaime',  '0')) || 0;

      const actualDaniel = actualDanielBase + jemD;
      const actualJaime  = actualJaimeBase  + jemJ;

      const perceivedDaniel = Number(get('perceived_daniel', '0')) || 0;
      const perceivedJaime  = Number(get('perceived_jaime',  '0')) || 0;

      // Render
      const lines = [
        'Perceived Scores (based on opponent marking):',
        `• Daniel: ${perceivedDaniel}`,
        `• Jaime: ${perceivedJaime}`,
        '',
        'Actual Scores (objective correctness + Jemima bonus):',
        `• Daniel: ${actualDaniel}  (quiz ${actualDanielBase} + Jemima +${jemD})`,
        `• Jaime: ${actualJaime}   (quiz ${actualJaimeBase} + Jemima +${jemJ})`,
        '',
        'Discrepancy:',
        `• Daniel: ${formatDelta(actualDaniel - perceivedDaniel)}`,
        `• Jaime: ${formatDelta(actualJaime - perceivedJaime)}`,
      ];

      card.innerHTML = '';
      const h1 = document.createElement('div');
      h1.style.fontWeight = '700';
      h1.style.marginBottom = '8px';
      h1.textContent = 'Results';
      card.appendChild(h1);

      lines.forEach((t) => {
        const d = document.createElement('div');
        d.textContent = t;
        card.appendChild(d);
      });

      // Winner
      const outcome = document.createElement('div');
      outcome.className = 'panel-title accent-white mt-4';
      if (actualDaniel > actualJaime) outcome.textContent = 'Winner: Daniel 🎉';
      else if (actualJaime > actualDaniel) outcome.textContent = 'Winner: Jaime 🎉';
      else outcome.textContent = 'It’s a Tie!';
      card.appendChild(outcome);

      const jemima = document.createElement('div');
      jemima.className = 'mt-2';
      jemima.textContent = 'Jemima: “Lovely memory work! Numbers well wrangled.”';
      card.appendChild(jemima);
    } catch (e) {
      console.error('[FinalRoom] compute error', e);
      card.textContent = 'Could not compute final scores.';
    }
  }
}

function formatDelta(n) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n}`;
}
