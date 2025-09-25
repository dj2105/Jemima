// /src/views/FinalRoom.js
// Final results screen (safe placeholder).
// If rooms/{code}/results exists, display totals; otherwise show a simple message.

import {
  initFirebase, ensureAuth, db, doc, collection, getDoc, onSnapshot
} from '../lib/firebase.js';

export default function FinalRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const roomCode = (get('lastGameCode', '') || '').toUpperCase();

  const root = document.createElement('div');
  root.className = 'center-stage';

  const box = document.createElement('div');
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';
  box.style.textAlign = 'center';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'FINAL RESULTS';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'left';

  const line = (t) => {
    const d = document.createElement('div');
    d.className = 'mt-2';
    d.textContent = t;
    return d;
  };

  const lRoom = line(roomCode ? `Room: ${roomCode}` : 'Room: (none)');
  const lDaniel = line('Daniel total: —');
  const lJaime  = line('Jaime total: —');
  const lJemima = line('Jemima bonus: —');
  const lNote   = line('Waiting for results…');

  card.append(lRoom, lDaniel, lJaime, lJemima, lNote);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'LOBBY';
  btn.addEventListener('click', () => navigate('#/'));
  row.appendChild(btn);

  box.append(title, card, row);
  root.appendChild(box);

  // Load any existing results (non-fatal if missing)
  void start();

  return root;

  async function start() {
    if (!roomCode) return;
    try {
      initFirebase();
      await ensureAuth();
    } catch {
      /* ignore – just show static UI */
    }

    const ref = doc(collection(db, 'rooms'), roomCode, 'meta', 'results'); // try meta/results
    const alt = doc(collection(db, 'rooms'), roomCode, 'results', 'final'); // or results/final

    // helper to update UI from a data object
    const apply = (d) => {
      if (!d) return;
      const dan = d.danielTotal ?? d.daniel ?? d.hostTotal ?? null;
      const jai = d.jaimeTotal  ?? d.jaime  ?? d.guestTotal ?? null;
      const jem = d.jemimaBonus ?? d.jemima ?? null;

      if (dan != null) lDaniel.textContent = `Daniel total: ${dan}`;
      if (jai != null) lJaime.textContent  = `Jaime total: ${jai}`;
      if (jem != null) lJemima.textContent = `Jemima bonus: ${jem}`;
      lNote.textContent = 'Done.';
    };

    // prefer a realtime doc if it exists
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        apply(snap.data() || {});
        onSnapshot(ref, s => s.exists() && apply(s.data() || {}));
        return;
      }
    } catch {}

    try {
      const snap2 = await getDoc(alt);
      if (snap2.exists()) {
        apply(snap2.data() || {});
        onSnapshot(alt, s => s.exists() && apply(s.data() || {}));
        return;
      }
    } catch {}

    // If neither exists, just leave the placeholder text.
  }
}
