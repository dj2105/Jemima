// /src/views/KeyRoom.js
// Host setup: enter keys/config, create a room code, then proceed to Generation.

import { initFirebase } from '../lib/firebase.js';

export default function KeyRoom(ctx = {}) {
  const navigate = (h) => (ctx && ctx.navigate ? ctx.navigate(h) : (location.hash = h));
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

  initFirebase(); // safe to call; no-ops if already initialised

  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('h2');
  title.className = 'panel-title accent-daniel';
  title.textContent = 'KEY ROOM';
  root.appendChild(title);

  const pane = document.createElement('div');
  pane.className = 'panel mt-4';
  root.appendChild(pane);

  // Gemini key
  const keyBox = textarea('Gemini API Key', get('geminiKey', ''));
  pane.appendChild(keyBox.wrap);

  // Optional config/specs
  const fbBox = textarea('Firebase config JSON (optional)', get('firebaseConfig', ''));
  pane.appendChild(fbBox.wrap);

  const qBox = textarea('Question JSON spec (optional)', get('questionSpec', ''));
  pane.appendChild(qBox.wrap);

  const jBox = textarea('Jemima JSON spec (optional)', get('jemimaSpec', ''));
  pane.appendChild(jBox.wrap);

  // Footer buttons
  const row = document.createElement('div');
  row.className = 'btn-row mt-4';

  const btnSave = document.createElement('button');
  btnSave.className = 'btn';
  btnSave.textContent = 'SAVE';
  btnSave.addEventListener('click', () => {
    set('geminiKey', keyBox.input.value.trim());
    set('firebaseConfig', fbBox.input.value.trim());
    set('questionSpec', qBox.input.value.trim());
    set('jemimaSpec', jBox.input.value.trim());
  });

  const btnGo = document.createElement('button');
  btnGo.className = 'btn btn-go daniel';
  btnGo.textContent = 'GO';
  btnGo.addEventListener('click', () => {
    // Create simple 4-char room code and persist + set host role
    const code = makeCode(4);
    set('lastGameCode', code);
    set('playerRole', 'host');            // <-- ensure host role
    // Show a quick room code screen then go straight to Generation
    navigate('#/gen');
  });

  row.append(btnSave, btnGo);
  pane.appendChild(row);

  return root;

  function textarea(label, value) {
    const wrap = document.createElement('div');
    wrap.className = 'field mt-3';
    const lab = document.createElement('div');
    lab.className = 'note';
    lab.textContent = label;
    const input = document.createElement('textarea');
    input.className = 'input-field';
    input.value = value;
    wrap.append(lab, input);
    return { wrap, input };
  }

  function makeCode(n = 4) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
}
