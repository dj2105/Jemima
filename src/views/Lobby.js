// /src/views/Lobby.js
// Pure UI for the Lobby screen (JAIME / DANIEL / REJOIN).
// Stores room code + role in localStorage for later screens.

export default function Lobby(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const get = (k, d = '') => {
    try { return localStorage.getItem(k) || d; } catch { return d; }
  };
  const set = (k, v) => {
    try { localStorage.setItem(k, v); } catch {}
  };

  const lastCode = get('lastGameCode', '').toUpperCase();

  const root = document.createElement('div');
  root.className = 'wrap';

  // ---------- JAIME (Join) ----------
  const pJoin = document.createElement('section');
  pJoin.className = 'panel';

  const hJoin = document.createElement('h2');
  hJoin.className = 'panel-title accent-jaime';
  hJoin.textContent = 'JAIME';
  pJoin.appendChild(hJoin);

  const rowJoin = document.createElement('div');
  rowJoin.className = 'input-row mt-4';

  const inputCode = document.createElement('input');
  inputCode.className = 'input-field uppercase';
  inputCode.placeholder = 'ENTER CODE';
  inputCode.autocomplete = 'off';
  inputCode.maxLength = 6;
  inputCode.value = '';
  inputCode.style.textTransform = 'uppercase';
  inputCode.addEventListener('input', () => {
    inputCode.value = inputCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  const btnJoin = document.createElement('button');
  btnJoin.className = 'btn btn-go jaime';
  btnJoin.textContent = 'GO';
  btnJoin.addEventListener('click', () => {
    const code = (inputCode.value || '').trim().toUpperCase();
    if (!code || code.length < 4) {
      inputCode.focus(); inputCode.select?.(); return;
    }
    set('lastGameCode', code);
    set('playerRole', 'guest');       // <-- important
    navigate(`#/join/${code}`);
  });

  rowJoin.append(inputCode, btnJoin);
  pJoin.append(rowJoin);

  // ---------- DANIEL (Host) ----------
  const pHost = document.createElement('section');
  pHost.className = 'panel';

  const hHost = document.createElement('h2');
  hHost.className = 'panel-title accent-daniel';
  hHost.innerHTML = `DANIEL <span class="badge">HOST</span>`;
  pHost.appendChild(hHost);

  const btnHostRow = document.createElement('div');
  btnHostRow.className = 'btn-row';

  const btnHost = document.createElement('button');
  btnHost.className = 'btn btn-go daniel';
  btnHost.textContent = 'GO';
  btnHost.addEventListener('click', () => {
    set('playerRole', 'host');        // <-- important
    navigate('#/key');
  });

  btnHostRow.append(btnHost);
  pHost.append(btnHostRow);

  // ---------- REJOIN ----------
  const pRejoin = document.createElement('section');
  pRejoin.className = 'panel';

  const hRe = document.createElement('h2');
  hRe.className = 'panel-title accent-white';
  hRe.textContent = 'REJOIN';
  pRejoin.appendChild(hRe);

  const rowRe = document.createElement('div');
  rowRe.className = 'input-row mt-4';

  const codeBox = document.createElement('input');
  codeBox.className = 'input-field';
  codeBox.placeholder = 'LAST CODE';
  codeBox.value = lastCode;
  codeBox.style.textTransform = 'uppercase';
  codeBox.addEventListener('input', () => {
    codeBox.value = codeBox.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  const btnRe = document.createElement('button');
  btnRe.className = 'btn btn-go';
  btnRe.textContent = 'GO';
  btnRe.disabled = !lastCode;
  btnRe.addEventListener('click', () => {
    const code = (codeBox.value || '').trim().toUpperCase();
    if (!code || code.length < 4) return;
    set('lastGameCode', code);
    // do NOT override playerRole here; we reuse whatever was last set
    navigate(`#/rejoin/${code}`);
  });

  rowRe.append(codeBox, btnRe);
  pRejoin.append(rowRe);

  // ---------- Assemble ----------
  root.append(pJoin, pHost, pRejoin);
  return root;
}
