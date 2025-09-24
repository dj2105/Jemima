// /src/views/FinalResults.js
// Shows combined scores and declares winner.
// Quiz scores come from state; Jemima bonus from localStorage.

import { state } from '../state.js';

export default function FinalResults(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));

  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'Final Results';
  root.appendChild(title);

  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';
  root.appendChild(card);

  // --- Load stored bonus ---
  let bonusDaniel = 0, bonusJaime = 0;
  try {
    bonusDaniel = Number(localStorage.getItem('jemimaBonusDaniel') || 0);
    bonusJaime = Number(localStorage.getItem('jemimaBonusJaime') || 0);
  } catch {}

  const totalDaniel = (state.scores.daniel || 0) + bonusDaniel;
  const totalJaime  = (state.scores.jaime || 0) + bonusJaime;

  const list = document.createElement('ul');
  list.style.listStyle = 'none';
  list.style.padding = '0';
  list.style.margin = '0';

  function li(label, val) {
    const li = document.createElement('li');
    li.style.margin = '8px 0';
    li.textContent = `${label}: ${val}`;
    return li;
  }

  list.append(
    li('Daniel base score', state.scores.daniel),
    li('Jaime base score', state.scores.jaime),
    li('Daniel Jemima bonus', bonusDaniel),
    li('Jaime Jemima bonus', bonusJaime),
    li('Daniel total', totalDaniel),
    li('Jaime total', totalJaime)
  );

  card.appendChild(list);

  const outcome = document.createElement('div');
  outcome.className = 'panel-title accent-white mt-6';
  if (totalDaniel > totalJaime) outcome.textContent = 'Winner: Daniel 🎉';
  else if (totalJaime > totalDaniel) outcome.textContent = 'Winner: Jaime 🎉';
  else outcome.textContent = 'It’s a Tie!';
  card.appendChild(outcome);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'Play Again';
  btn.addEventListener('click', () => navigate('#/'));
  row.appendChild(btn);
  root.appendChild(row);

  return root;
}
