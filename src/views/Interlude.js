// /src/views/Interlude.js
// After each round (1–4): shows Jemima passage beats (numbers to remember).
// When the player taps READY, we set nextHash to the next Questions round
// and send both players through the Countdown to stay in sync.

import { initFirebase, db, doc, getDoc } from '../lib/firebase.js';

export default function Interlude(ctx = {}) {
  const navigate = ctx.navigate || ((h) => (location.hash = h));
  const lsGet = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const round = Number(ctx.round || 1);
  const roomCode = (lsGet('lastGameCode','') || '').toUpperCase();

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
    // Next: advance to next Questions round (round+1)
    const nextRound = Math.min(5, round + 1);
    lsSet('nextHash', `#/round/${nextRound}`);
    navigate('#/countdown');
  });

  // load passage
  void load();

  return root;

  async function load() {
    try {
      initFirebase();
      // No auth required for reading public data in many setups; if needed, add ensureAuth()

      const snap = await getDoc(doc(db, 'rooms', roomCode, 'seed', 'interludes'));
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
