// /src/views/Interlude.js
// Jemima’s Maths Interludes after rounds 1–4.
// Shows the passage with vital numbers. Host can start the next synced countdown.

import {
  initFirebase, ensureAuth, db, doc, onSnapshot, setDoc, getDoc
} from '../lib/firebase.js';

export default function Interlude(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const role = (localStorage.getItem('playerRole') || 'guest').toLowerCase(); // 'host' | 'guest'
  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Interlude</h2>
    <p class="status" id="roomInfo"></p>

    <section id="passagePanel" class="panel">
      <p class="status">Loading passage…</p>
    </section>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <button id="btnStartNext" class="primary" style="display:none">Start Next Countdown</button>
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
    </div>

    <div class="log" id="log"></div>
  `;

  const $ = (s) => el.querySelector(s);
  const log = (msg, kind = 'info') => {
    const d = document.createElement('div');
    d.className = `logline ${kind}`;
    d.textContent = msg;
    $('#log').appendChild(d);
  };

  $('#roomInfo').textContent = code ? `Room ${code} • You are ${role}` : 'No room code — go back to Lobby';
  if (!code) return el;

  function parseInterludeRound(state) {
    const m = /^interlude_r(\d+)$/.exec(state || '');
    return m ? parseInt(m[1], 10) : null;
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  async function startNextCountdown(n) {
    // Host-only: interlude_rN -> countdown_r(N+1)
    const next = `countdown_r${Math.min(n + 1, 5)}`;
    try {
      await setDoc(doc(db, 'rooms', code), {
        state: next,
        countdownT0: new Date(Date.now() + 3500)
      }, { merge: true });
      log(`Advancing to ${next}…`);
      navigate('#/countdown');
    } catch (e) {
      log('Failed to start next countdown: ' + (e?.message || e), 'error');
    }
  }

  let unsub = null;

  (async () => {
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      $('#passagePanel').innerHTML = `<p class="status">Firebase error: ${e?.message || e}</p>`;
      return;
    }

    const roomRef = doc(db, 'rooms', code);
    unsub = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        $('#passagePanel').innerHTML = `<p class="status">Room not found.</p>`;
        return;
      }
      const data = snap.data() || {};
      const state = data.state || '';

      // Follow FSM if host already moved on
      if (state.startsWith('countdown_r')) return navigate('#/countdown');
      if (state.startsWith('q_r')) return navigate('#/questions');
      if (state.startsWith('mark_r')) return navigate('#/marking');
      if (state === 'maths') return navigate('#/maths');
      if (state === 'final') return navigate('#/final');

      const n = parseInterludeRound(state);
      if (!n) {
        $('#passagePanel').innerHTML = `<p class="status">Waiting for Interlude to begin…</p>`;
        $('#btnStartNext').style.display = 'none';
        return;
      }

      // Read seed (from snapshot or fetch once)
      const seed = data.seed || (await getDoc(roomRef).then(s => s.data()?.seed).catch(() => null));
      const inter = Array.isArray(seed?.interludes) ? seed.interludes[n - 1] : null;

      if (!inter) {
        $('#passagePanel').innerHTML = `<p class="status">Interlude ${n} is missing from the seed.</p>`;
        $('#btnStartNext').style.display = 'none';
        return;
      }

      $('#passagePanel').innerHTML = `
        <h3>Interlude ${n} of 4</h3>
        <p style="white-space:pre-wrap; margin-top:0.5rem;">${escapeHTML(inter.passage)}</p>
        <small class="status">Tip: you won’t be asked questions yet — just remember the numbers.</small>
      `;

      // Host sees button to start the next countdown
      if (role === 'host') {
        $('#btnStartNext').style.display = 'inline-block';
        $('#btnStartNext').onclick = () => startNextCountdown(n);
      } else {
        $('#btnStartNext').style.display = 'none';
      }
    }, (err) => {
      console.error('[interlude] snapshot error', err);
      log('Sync error: ' + (err?.message || err), 'error');
    });
  })();

  el._destroy = () => { try { unsub && unsub(); } catch {} };

  return el;
}
