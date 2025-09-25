// /src/views/Lobby.js
// Lobby: choose role and enter/join code. Minimal logic; no Firebase here.
// - JAIME (guest): enters host's code, stores role+code, and goes to Countdown.
//   Generation screen will set nextHash; otherwise Countdown falls back sensibly.
// - DANIEL (host): sets role and goes to Key Room to enter keys and seed content.
// - REJOIN: keeps previous role, just restores code and jumps to /rejoin/<code>.

export default function Lobby(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const get = (k, d = '') => { try { return localStorage.getItem(k) || d; } catch { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'Jemima’s Asking — Lobby';
  root.appendChild(title);

  // --- Join as JAIME ---
  const pJoin = document.createElement('div');
  pJoin.className = 'panel panel-soft mt-4';
  const hJoin = document.createElement('div');
  hJoin.className = 'accent-blue';
  hJoin.textContent = 'JAIME — Join a Game';
  pJoin.appendChild(hJoin);

  const rowJoin = document.createElement('div');
  rowJoin.className = 'btn-row mt-3';

  const codeInput = document.createElement('input');
  codeInput.className = 'input-field uppercase tracking';
  codeInput.placeholder = 'ENTER CODE';
  codeInput.maxLength = 10;
  codeInput.autocomplete = 'off';
  codeInput.inputMode = 'latin';
  codeInput.value = get('lastGameCode','');
  rowJoin.appendChild(codeInput);

  const btnJoin = document.createElement('button');
  btnJoin.className = 'btn';
  btnJoin.textContent = 'GO';
  rowJoin.appendChild(btnJoin);

  // Pressing Enter triggers GO
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoin.click();
  });

  btnJoin.addEventListener('click', (e) => {
    e.preventDefault();
    const code = (codeInput.value || '').trim().toUpperCase();
    if (!code || code.length < 4) return;
    set('lastGameCode', code);
    set('playerRole', 'jaime'); // guest
    // Guest waits at Countdown; Generation/Marking/Interlude set nextHash
    navigate('#/countdown');
  });

  pJoin.appendChild(rowJoin);

  // --- Host (DANIEL) ---
  const pHost = document.createElement('div');
  pHost.className = 'panel panel-soft mt-4';
  const hHost = document.createElement('div');
  hHost.className = 'accent-yellow';
  hHost.textContent = 'DANIEL — Host a Game';
  pHost.appendChild(hHost);

  const rowHost = document.createElement('div');
  rowHost.className = 'btn-row mt-3';

  const btnHost = document.createElement('button');
  btnHost.className = 'btn btn-go';
  btnHost.textContent = 'HOST';
  rowHost.appendChild(btnHost);
  pHost.appendChild(rowHost);

  btnHost.addEventListener('click', (e) => {
    e.preventDefault();
    set('playerRole', 'daniel'); // host
    // Host chooses/enters keys in Key Room, then proceeds to Generation
    navigate('#/key');
  });

  // --- Rejoin (either role) ---
  const pRejoin = document.createElement('div');
  pRejoin.className = 'panel panel-soft mt-4';
  const hRe = document.createElement('div');
  hRe.className = 'accent-white';
  hRe.textContent = 'Rejoin';
  pRejoin.appendChild(hRe);

  const rowRe = document.createElement('div');
  rowRe.className = 'btn-row mt-3';

  const codeBox = document.createElement('input');
  codeBox.className = 'input-field uppercase tracking';
  codeBox.placeholder = 'ENTER CODE';
  codeBox.maxLength = 10;
  codeBox.value = get('lastGameCode','');
  rowRe.appendChild(codeBox);

  const btnRe = document.createElement('button');
  btnRe.className = 'btn';
  btnRe.textContent = 'REJOIN';
  rowRe.appendChild(btnRe);

  btnRe.addEventListener('click', (e) => {
    e.preventDefault();
    const code = (codeBox.value || '').trim().toUpperCase();
    if (!code || code.length < 4) return;
    set('lastGameCode', code);
    // Do NOT override role on rejoin; router will bounce us to Lobby if invalid
    navigate(`#/rejoin/${code}`);
  });

  pRejoin.appendChild(rowRe);

  // Assemble
  root.append(pJoin, pHost, pRejoin);
  return root;
}
