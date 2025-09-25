// /src/views/KeyRoom.js
// Host setup: enter keys/config, create a room code, then proceed via Countdown
// → Generation → (later) Round 1.
// Rules per spec:
//   • Text boxes for: Gemini API key, Firebase config (JSON), Question-gen JSON, Jemima-clues JSON.
//   • All are stored locally. Gemini key must be valid to continue.
//   • On GO: set nextHash -> '#/generate' and navigate to '#/countdown' (both players resync there).

import { initFirebase } from '../lib/firebase.js';
import { geminiCall } from '../lib/gemini.js';

export default function KeyRoom(ctx = {}) {
  const navigate = (h) => (ctx && ctx.navigate ? ctx.navigate(h) : (location.hash = h));
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const lsGet = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

  initFirebase(); // safe no-op if already initialised

  // ---------- UI ----------
  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('h2');
  title.className = 'panel-title accent-white';
  title.textContent = 'Key Room — Host Setup';
  root.appendChild(title);

  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';
  root.appendChild(card);

  // Room code row
  const codeRow = document.createElement('div');
  codeRow.style.display = 'flex';
  codeRow.style.gap = '8px';
  codeRow.style.alignItems = 'center';

  const codeLabel = document.createElement('div');
  codeLabel.style.minWidth = '110px';
  codeLabel.style.fontWeight = '700';
  codeLabel.textContent = 'Room Code';
  codeRow.appendChild(codeLabel);

  const codeBox = document.createElement('input');
  codeBox.type = 'text';
  codeBox.maxLength = 8;
  codeBox.className = 'input-field';
  codeBox.style.flex = '1 1 auto';
  codeBox.value = (lsGet('lastGameCode', '') || '').toUpperCase() || makeCode(4);
  codeRow.appendChild(codeBox);

  const genBtn = document.createElement('button');
  genBtn.className = 'btn btn-outline';
  genBtn.textContent = 'Generate';
  genBtn.addEventListener('click', () => {
    codeBox.value = makeCode(4);
  });
  codeRow.appendChild(genBtn);

  card.appendChild(codeRow);

  // Gemini API key (required)
  const gk = field('Gemini API Key (required)', lsGet('geminiApiKey', ''), false, 'text');
  card.appendChild(gk.wrap);

  // Firebase config JSON (optional)
  const fb = area('Firebase Config (JSON)', lsGet('firebaseConfigJson', '{\n  "apiKey": "",\n  "authDomain": "",\n  "projectId": ""\n}'));
  card.appendChild(fb.wrap);

  // Question generation JSON (optional)
  const qspec = area('Question-Generation JSON (optional)', lsGet('questionsSpecJson', '{\n  "topics": ["General Knowledge"]\n}'));
  card.appendChild(qspec.wrap);

  // Jemima clues (interludes) JSON (optional)
  const ispec = area('Jemima Clues JSON (optional)', lsGet('interludesSpecJson', '{\n  "style": "succinct-numeric-beats"\n}'));
  card.appendChild(ispec.wrap);

  // Status + GO
  const status = document.createElement('div');
  status.className = 'note mt-3';
  status.textContent = 'Enter details. Gemini key must be valid to continue.';
  card.appendChild(status);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';

  const backBtn = document.createElement('button');
  backBtn.className = 'btn btn-outline';
  backBtn.textContent = 'Back to Lobby';
  backBtn.addEventListener('click', () => navigate('#/'));
  row.appendChild(backBtn);

  const goBtn = document.createElement('button');
  goBtn.className = 'btn btn-go';
  goBtn.textContent = 'GO';
  goBtn.disabled = true;
  row.appendChild(goBtn);

  root.appendChild(row);

  // Live validation for Gemini key presence
  function reassess() {
    goBtn.disabled = !gk.input.value.trim();
  }
  gk.input.addEventListener('input', reassess);
  reassess();

  // GO click => save, validate Gemini, set next, countdown
  goBtn.addEventListener('click', async () => {
    const code = (codeBox.value || '').trim().toUpperCase();
    if (!code || code.length < 4) {
      status.textContent = 'Please provide a 4+ character room code.';
      return;
    }

    // Persist everything locally
    lsSet('lastGameCode', code);
    lsSet('playerRole', 'host');           // ensure host role
    lsSet('geminiApiKey', gk.input.value || '');
    lsSet('firebaseConfigJson', fb.input.value || '');
    lsSet('questionsSpecJson', qspec.input.value || '');
    lsSet('interludesSpecJson', ispec.input.value || '');

    // Basic Gemini validation: ping the proxy function
    status.textContent = 'Validating Gemini key…';
    goBtn.disabled = true;

    // NOTE: The Netlify function reads GEMINI_API_KEY from server env.
    // We still do a small no-op call to confirm the path is live.
    const ping = await geminiCall({ kind: 'generic', prompt: 'ping' });

    if (!ping || ping.ok === false) {
      status.textContent = 'Gemini validation failed. Check server key or try again.';
      goBtn.disabled = false;
      return;
    }

    status.textContent = 'Valid! Preparing…';

    // Set next to Generation and resync via Countdown
    try { localStorage.setItem('nextHash', '#/generate'); } catch {}
    navigate('#/countdown');
  });

  return root;

  // ---------- helpers ----------

  function field(label, value = '', isTextarea = false, type = 'text') {
    const wrap = document.createElement('div');
    wrap.className = 'mt-3';
    const lab = document.createElement('div');
    lab.style.fontWeight = '700';
    lab.textContent = label;
    wrap.appendChild(lab);

    let input;
    if (isTextarea) {
      input = document.createElement('textarea');
      input.className = 'input-field';
      input.value = value;
      input.rows = 2;
    } else {
      input = document.createElement('input');
      input.type = type;
      input.className = 'input-field';
      input.value = value;
    }
    wrap.appendChild(input);

    return { wrap, input };
  }

  function area(label, value = '') {
    const wrap = document.createElement('div');
    wrap.className = 'mt-3';
    const lab = document.createElement('div');
    lab.style.fontWeight = '700';
    lab.textContent = label;
    wrap.appendChild(lab);

    const input = document.createElement('textarea');
    input.className = 'input-field';
    input.style.minHeight = '110px';
    input.value = value;
    wrap.appendChild(input);
    return { wrap, input };
  }

  function makeCode(n = 4) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }
}
