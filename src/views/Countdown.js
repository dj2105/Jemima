// /src/views/Countdown.js
// Synced countdown between phases. Host advances at T0; guest follows.

import {
  initFirebase, ensureAuth, db, doc, onSnapshot, setDoc
} from '../lib/firebase.js';

export default function Countdown(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Get Ready…</h2>
    <p class="status" id="roomInfo"></p>

    <div class="panel" style="text-align:center">
      <div id="big" style="font-size:4rem; font-weight:800; letter-spacing:0.02em">--</div>
      <div id="sub" class="status">Synchronising…</div>
    </div>

    <div class="panel">
      <small class="status">If you see this for a long time, ensure the Host reached this screen.</small>
      <p><a href="#/lobby" class="nav-link">Back to Lobby</a></p>
    </div>
  `;

  const $ = (s) => el.querySelector(s);
  const role = (localStorage.getItem('playerRole') || 'guest').toLowerCase();
  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();

  $('#roomInfo').textContent = code ? `Room ${code} • You are ${role}` : 'No room code — go back to Lobby';

  if (!code) return el;

  let unsub = null;
  let tickHandle = null;

  function clearTick() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }

  function parseRoundFromState(state) {
    const m = /^countdown_r(\d+)$/.exec(state || '');
    return m ? parseInt(m[1], 10) : null;
  }

  async function advanceAfterCountdown(state) {
    // Host-only: move countdown_rN -> q_rN
    const n = parseRoundFromState(state);
    if (!n) return;
    const nextState = `q_r${n}`;
    try {
      await setDoc(doc(db, 'rooms', code), { state: nextState }, { merge: true });
    } catch (e) {
      console.error('[countdown] advance failed:', e);
      $('#sub').textContent = 'Advance failed. Check connection.';
    }
  }

  function startTick(deadlineMs, state) {
    clearTick();
    $('#sub').textContent = 'Starting shortly…';
    tickHandle = setInterval(async () => {
      const diff = Math.max(0, deadlineMs - Date.now());
      const secs = Math.ceil(diff / 1000);
      $('#big').textContent = String(secs);
      if (diff <= 0) {
        clearTick();
        if (role === 'host') {
          $('#sub').textContent = 'Advancing…';
          await advanceAfterCountdown(state);
        } else {
          $('#sub').textContent = 'Waiting for host…';
        }
      }
    }, 100);
  }

  // Live room listener
  (async () => {
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      $('#sub').textContent = 'Firebase error: ' + (e?.message || e);
      return;
    }

    const roomRef = doc(db, 'rooms', code);
    unsub = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) {
        $('#sub').textContent = 'Room not found.';
        $('#big').textContent = '--';
        return;
      }
      const data = snap.data() || {};
      const state = data.state || '';
      const r = parseRoundFromState(state);

      if (!state) {
        $('#sub').textContent = 'Waiting for host to set state…';
        $('#big').textContent = '--';
        clearTick();
        return;
      }

      // If host already advanced us past countdown, follow the state machine.
      if (!state.startsWith('countdown_r')) {
        // For now we only expect q_r1 after this screen.
        if (state.startsWith('q_r')) navigate('#/questions');
        else if (state.startsWith('mark_r')) navigate('#/marking');
        else if (state.startsWith('interlude_r')) navigate('#/interlude');
        else if (state === 'maths') navigate('#/maths');
        else if (state === 'final') navigate('#/final');
        else $('#sub').textContent = `State: ${state}`;
        return;
      }

      // In countdown state
      if (!data.countdownT0) {
        $('#sub').textContent = 'Waiting for host to start countdown…';
        $('#big').textContent = '--';
        clearTick();
        return;
      }

      // Firestore Timestamp or Date
      const t0 = data.countdownT0.toDate ? data.countdownT0.toDate().getTime() : new Date(data.countdownT0).getTime();
      if (!Number.isFinite(t0)) {
        $('#sub').textContent = 'Invalid countdown timestamp.';
        $('#big').textContent = '--';
        clearTick();
        return;
      }

      // We show a 3–4 second countdown based on the shared T0
      startTick(t0, state);
      $('#sub').textContent = r ? `Round ${r} begins when timer hits 0` : 'Starting…';
    }, (err) => {
      console.error('[countdown] snapshot error', err);
      $('#sub').textContent = 'Sync error: ' + (err?.message || err);
    });
  })();

  // Cleanup when view is replaced
  el._destroy = () => {
    try { unsub && unsub(); } catch {}
    clearTick();
  };

  return el;
}
