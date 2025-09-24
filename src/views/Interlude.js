// /src/views/Interlude.js
// After each round (1–4): shows Jemima passage beats.
// Reads from Firestore seeds (rooms/{code}/seed/interludes).

import { initFirebase, db, doc, getDoc } from '../lib/firebase.js';
import { state } from '../state.js';

export default function Interlude(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const round = ctx.round || 1;

  const root = document.createElement('div');
  root.className = 'wrap';

  const h = document.createElement('div');
  h.className = 'panel-title accent-white';
  h.textContent = `Jemima Interlude ${round}`;
  root.appendChild(h);

  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';
  card.textContent = 'Loading Jemima’s beats…';
  root.appendChild(card);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';

  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'READY';
  btn.disabled = true;
  row.appendChild(btn);
  root.appendChild(row);

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'WAITING…';
    const hold = document.createElement('div');
    hold.className = 'note mt-3';
    hold.textContent = 'Jemima is stretching her whiskers…';
    root.appendChild(hold);

    setTimeout(() => navigate('#/countdown'), 2000);
  });

  // Async load from Firestore
  void load();

  return root;

  async function load() {
    initFirebase();
    if (!state.roomCode) {
      card.textContent = 'Error: no room joined.';
      return;
    }

    try {
      const ref = doc(db, 'rooms', state.roomCode, 'seed', 'interludes');
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        card.textContent = 'No Jemima passages found.';
        return;
      }
      const data = snap.data();
      const passages = Array.isArray(data.passages) ? data.passages : [];
      const item = passages.find((p) => Number(p.round) === Number(round));

      if (!item) {
        card.textContent = `No passage for round ${round}.`;
        return;
      }

      renderBeats(item.beats || []);
      btn.disabled = false;
    } catch (err) {
      card.textContent = 'Failed to load Jemima passage: ' + (err.message || err);
    }
  }

  function renderBeats(beats) {
    card.innerHTML = '';
    beats.forEach((line, i) => {
      const p = document.createElement('div');
      p.style.margin = i ? '10px 0 0 0' : '0';
      p.textContent = `• ${line}`;
      card.appendChild(p);
    });
  }
}
