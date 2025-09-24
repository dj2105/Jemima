// /src/views/KeyRoom.js
// Host setup screen: paste keys/specs, save locally, generate a room code,
// show it big with a copy button, then GO to generation.

export default function KeyRoom(ctx = {}) {
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

  // Load any saved values
  const saved = JSON.parse(get('keyRoom', '{}') || '{}');

  // Root
  const root = document.createElement('div');
  root.className = 'wrap';

  // Panel
  const panel = document.createElement('section');
  panel.className = 'panel';
  root.appendChild(panel);

  const title = document.createElement('h2');
  title.className = 'panel-title accent-daniel';
  title.textContent = 'KEY ROOM';
  panel.appendChild(title);

  // Inputs
  const mkRow = (placeholder, value, multiline = false) => {
    const row = document.createElement('div');
    row.className = 'mt-4';
    const input = multiline ? document.createElement('textarea') : document.createElement('input');
    input.className = 'input-field';
    input.placeholder = placeholder;
    input.value = value || '';
    if (multiline) {
      input.style.height = '120px';
      input.style.padding = '12px 14px';
      input.style.resize = 'vertical';
    }
    row.appendChild(input);
    return { row, input };
  };

  const { row: rKey, input: iKey } = mkRow('Gemini API Key (required)', saved.geminiKey || '');
  const { row: rFb,  input: iFb  } = mkRow('Firebase config JSON (optional)', saved.firebaseConfig || '', true);
  const { row: rQs,  input: iQs  } = mkRow('Question JSON spec (optional)', saved.questionSpec || '', true);
  const { row: rJm,  input: iJm  } = mkRow('Jemima JSON spec (optional)', saved.jemimaSpec || '', true);

  panel.append(rKey, rFb, rQs, rJm);

  // Save + GO
  const rowBtns = document.createElement('div');
  rowBtns.className = 'btn-row mt-6';

  const btnSave = document.createElement('button');
  btnSave.className = 'btn btn-outline';
  btnSave.textContent = 'SAVE';
  btnSave.addEventListener('click', () => {
    persist();
  });

  const btnGo = document.createElement('button');
  btnGo.className = 'btn btn-go daniel';
  btnGo.textContent = 'GO';
  btnGo.addEventListener('click', () => {
    if (!persist(true)) return; // require key
    showRoomCode();
  });

  rowBtns.append(btnSave, btnGo);
  panel.appendChild(rowBtns);

  function persist(requireKey = false) {
    const geminiKey = (iKey.value || '').trim();
    const firebaseConfig = (iFb.value || '').trim();
    const questionSpec = (iQs.value || '').trim();
    const jemimaSpec = (iJm.value || '').trim();

    if (requireKey && !geminiKey) {
      iKey.focus();
      return false;
    }

    const payload = { geminiKey, firebaseConfig, questionSpec, jemimaSpec };
    set('keyRoom', JSON.stringify(payload));
    return true;
  }

  function makeCode(len = 4) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily confused chars
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function showRoomCode() {
    const code = makeCode(4);
    set('lastGameCode', code);

    // Replace panel content with the big code display + copy + proceed
    panel.innerHTML = '';

    const h = document.createElement('h2');
    h.className = 'panel-title accent-white';
    h.textContent = 'ROOM CODE';
    panel.appendChild(h);

    const card = document.createElement('div');
    card.className = 'card';
    card.style.textAlign = 'center';

    const codeBox = document.createElement('div');
    codeBox.style.fontWeight = '800';
    codeBox.style.fontSize = 'clamp(40px, 12vw, 120px)';
    codeBox.style.letterSpacing = '0.08em';
    codeBox.style.userSelect = 'all';
    codeBox.textContent = code;

    const note = document.createElement('div');
    note.className = 'note mt-3';
    note.textContent = 'Share this code with Jaime.';

    const copyRow = document.createElement('div');
    copyRow.className = 'btn-row';
    copyRow.style.justifyContent = 'center';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn btn-outline';
    btnCopy.textContent = 'COPY';
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code);
        btnCopy.textContent = 'COPIED';
        setTimeout(() => (btnCopy.textContent = 'COPY'), 1200);
      } catch {}
    });

    copyRow.appendChild(btnCopy);
    card.append(codeBox, note, copyRow);
    panel.appendChild(card);

    const row = document.createElement('div');
    row.className = 'btn-row mt-6';

    const btnNext = document.createElement('button');
    btnNext.className = 'btn btn-go daniel';
    btnNext.textContent = 'GO';
    btnNext.addEventListener('click', () => navigate('#/gen'));

    row.appendChild(btnNext);
    panel.appendChild(row);
  }

  return root;
}
