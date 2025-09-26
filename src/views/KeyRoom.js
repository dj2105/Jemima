// /src/views/KeyRoom.js
// Next-level Key Room: two JSON specs with validate/save/load + API key.
// Returns a DOM element (like your other views).

import { initFirebase, ensureAuth, db, doc, setDoc, getDoc } from '../lib/firebase.js';

export default function KeyRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const el = document.createElement('section');
  el.className = 'panel';

  // --- helpers ---
  const lsGet = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const $ = (s) => el.querySelector(s);

  const code = (lsGet('lastGameCode', '') || '').toUpperCase();

  function setStatus(id, msg) {
    const node = $(id);
    if (node) node.textContent = msg;
  }

  function validateJSON(text, kind) {
    try {
      const obj = JSON.parse(text);
      if (kind === 'qcfg') {
        if (!obj.version || !String(obj.version).startsWith('qcfg')) throw new Error('Missing or invalid "version" (qcfg-*)');
        if (obj.sample_questions && obj.constraints && obj.constraints.examples_usage === undefined) {
          console.warn('Note: add constraints.examples_usage to forbid copying sample_questions.');
        }
      } else if (kind === 'jmaths') {
        if (!obj.version || !String(obj.version).startsWith('jmaths')) throw new Error('Missing or invalid "version" (jmaths-*)');
        if (!obj.beat_library) console.warn('Note: beat_library not found (optional, but recommended).');
      }
      return { ok: true, data: obj };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  async function saveSpec(kind) {
    const ta = kind === 'qcfg' ? $('#qcfgInput') : $('#jmathsInput');
    const statusId = kind === 'qcfg' ? '#qcfgStatus' : '#jmathsStatus';
    const parsed = validateJSON(ta.value.trim(), kind);
    if (!parsed.ok) {
      setStatus(statusId, `❌ Invalid JSON: ${parsed.error}`);
      return;
    }
    // Save locally
    lsSet(kind + 'Spec', ta.value.trim());

    try {
      await initFirebase();
      await ensureAuth();
      await setDoc(doc(db, 'rooms', code, 'seed', kind), { spec: parsed.data }, { merge: true });
      setStatus(statusId, '✅ Saved to Firestore');
    } catch (e) {
      setStatus(statusId, '❌ Save failed: ' + (e?.message || e));
    }
  }

  async function loadSpec(kind) {
    const ta = kind === 'qcfg' ? $('#qcfgInput') : $('#jmathsInput');
    const statusId = kind === 'qcfg' ? '#qcfgStatus' : '#jmathsStatus';
    try {
      await initFirebase();
      await ensureAuth();
      const snap = await getDoc(doc(db, 'rooms', code, 'seed', kind));
      if (snap.exists()) {
        ta.value = JSON.stringify(snap.data().spec, null, 2);
        setStatus(statusId, '📥 Loaded from Firestore');
      } else {
        setStatus(statusId, '⚠️ No saved spec in Firestore');
      }
    } catch (e) {
      setStatus(statusId, '❌ Load failed: ' + (e?.message || e));
    }
  }

  // --- render ---
  el.innerHTML = `
    <h2>Key Room — Configure Game</h2>
    <p class="status">Room code: <strong>${code || '—'}</strong></p>

    <section class="panel spec-panel">
      <h3>Quiz Questions Spec (qcfg-1)</h3>
      <textarea id="qcfgInput" rows="16" style="width:100%; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">${lsGet('qcfgSpec')}</textarea>
      <div class="row" style="gap:0.5rem; flex-wrap:wrap; align-items:center;">
        <button id="validateQcfg">Validate</button>
        <button id="saveQcfg" class="primary">Save</button>
        <button id="loadQcfg">Load</button>
        <span id="qcfgStatus" class="status">Not validated</span>
      </div>
    </section>

    <section class="panel spec-panel">
      <h3>Jemima Maths Spec (jmaths-1)</h3>
      <textarea id="jmathsInput" rows="16" style="width:100%; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;">${lsGet('jmathsSpec')}</textarea>
      <div class="row" style="gap:0.5rem; flex-wrap:wrap; align-items:center;">
        <button id="validateJmaths">Validate</button>
        <button id="saveJmaths" class="primary">Save</button>
        <button id="loadJmaths">Load</button>
        <span id="jmathsStatus" class="status">Not validated</span>
      </div>
    </section>

    <section class="panel">
      <h3>API Key</h3>
      <label for="geminiKey">Gemini API Key (stored locally)</label>
      <input id="geminiKey" type="password" style="width:100%" value="${lsGet('geminiKey')}"/>
      <div class="row" style="gap:0.5rem; align-items:center;">
        <button id="saveApiKey">Save Key</button>
        <span id="apiStatus" class="status"></span>
      </div>
    </section>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <a href="#/countdown" class="nav-link">Go to Countdown</a>
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
    </div>
  `;

  // --- wire events inside the component ---
  $('#validateQcfg').onclick = () => {
    const res = validateJSON($('#qcfgInput').value.trim(), 'qcfg');
    setStatus('#qcfgStatus', res.ok ? '✅ Valid qcfg spec' : `❌ ${res.error}`);
  };
  $('#saveQcfg').onclick = () => saveSpec('qcfg');
  $('#loadQcfg').onclick = () => loadSpec('qcfg');

  $('#validateJmaths').onclick = () => {
    const res = validateJSON($('#jmathsInput').value.trim(), 'jmaths');
    setStatus('#jmathsStatus', res.ok ? '✅ Valid jmaths spec' : `❌ ${res.error}`);
  };
  $('#saveJmaths').onclick = () => saveSpec('jmaths');
  $('#loadJmaths').onclick = () => loadSpec('jmaths');

  $('#saveApiKey').onclick = () => {
    const val = $('#geminiKey').value.trim();
    lsSet('geminiKey', val);
    setStatus('#apiStatus', val ? '✅ Key saved locally' : '❌ No key entered');
  };

  return el;
}
