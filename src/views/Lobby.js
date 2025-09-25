// /src/views/Lobby.js
// Real lobby: pick role (Host/Guest), create or join a room code, then move on.

import {
  initFirebase, ensureAuth, db, doc, setDoc
} from '../lib/firebase.js';

export default function Lobby(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const el = document.createElement('section');
  el.className = 'panel';

  el.innerHTML = `
    <h2>Lobby</h2>
    <p class="status">Choose your role. The Host creates a room code; the Guest joins using that code.</p>

    <div class="panel" id="hostPanel">
      <h3>Host</h3>
      <p>Generate a new room and share the code with your opponent.</p>
      <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
        <button id="btnMakeCode" class="primary">Create Room Code</button>
        <input id="hostCode" type="text" placeholder="CODE" maxlength="5" inputmode="latin" style="max-width:120px;" />
        <button id="btnHostGo">Go to Key Room</button>
      </div>
      <small class="status" id="hostStatus"></small>
    </div>

    <div class="panel" id="guestPanel">
      <h3>Guest</h3>
      <p>Enter the room code you received from the Host.</p>
      <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
        <input id="guestCode" type="text" placeholder="ENTER CODE" maxlength="5" inputmode="latin" style="max-width:160px;" />
        <button id="btnGuestJoin">Join</button>
      </div>
      <small class="status" id="guestStatus"></small>
    </div>

    <div class="panel">
      <h3>Tips</h3>
      <ul>
        <li>Use two browsers/devices for Host and Guest.</li>
        <li>Codes are 4–5 letters (A–Z). Not case sensitive.</li>
        <li>You can paste a known code into either box and press the button.</li>
      </ul>
    </div>
  `;

  const $ = (sel) => el.querySelector(sel);

  // --- Helpers ---
  function randCode(len = 4 + Math.floor(Math.random() * 2)) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to reduce confusion
    let s = '';
    for (let i = 0; i < len; i++) s += A[Math.floor(Math.random() * A.length)];
    return s;
  }

  function normCode(raw) {
    const s = (raw || '').toUpperCase().replace(/[^A-Z]/g, '');
    return s.slice(0, 5);
  }

  function saveRole(role) {
    try { localStorage.setItem('playerRole', role); } catch {}
  }

  function saveCode(code) {
    try { localStorage.setItem('lastGameCode', code); } catch {}
  }

  // Prefill if present
  try {
    const last = localStorage.getItem('lastGameCode');
    if (last) {
      $('#hostCode').value = last;
      $('#guestCode').value = last;
    }
  } catch {}

  // --- Host flow ---
  $('#btnMakeCode').addEventListener('click', () => {
    const code = randCode();
    $('#hostCode').value = code;
    $('#hostStatus').textContent = `Room code created: ${code}`;
  });

  $('#btnHostGo').addEventListener('click', async () => {
    const code = normCode($('#hostCode').value);
    if (!code || code.length < 4) {
      $('#hostStatus').textContent = 'Please create or enter a valid 4–5 letter code.';
      return;
    }
    saveRole('host');
    saveCode(code);
    $('#hostStatus').textContent = `You are Host. Room: ${code}`;

    // Stamp host UID
    try {
      const { auth } = await initFirebase();
      await ensureAuth();
      await setDoc(doc(db, 'rooms', code), {
        meta: { hostUid: auth.currentUser.uid }
      }, { merge: true });
    } catch (e) {
      console.error('[Lobby] Failed to stamp hostUid', e);
    }

    navigate('#/keyroom');
  });

  // --- Guest flow ---
  $('#btnGuestJoin').addEventListener('click', async () => {
    const code = normCode($('#guestCode').value);
    if (!code || code.length < 4) {
      $('#guestStatus').textContent = 'Please enter a valid 4–5 letter code.';
      return;
    }
    saveRole('guest');
    saveCode(code);
    $('#guestStatus').textContent = `Joined room: ${code}. Waiting for Host…`;

    // Stamp guest UID
    try {
      const { auth } = await initFirebase();
      await ensureAuth();
      await setDoc(doc(db, 'rooms', code), {
        meta: { guestUid: auth.currentUser.uid }
      }, { merge: true });
    } catch (e) {
      console.error('[Lobby] Failed to stamp guestUid', e);
    }

    alert(`Guest ready. Room: ${code}. Wait for Host to start.`);
  });

  return el;
}
