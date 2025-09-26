// /src/views/KeyRoom.js
import { initFirebase, ensureAuth, db, doc, setDoc, getDoc } from '../lib/firebase.js';

export default function KeyRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const lsGet = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const code = (lsGet('lastGameCode', '') || '').toUpperCase();

  // --- helpers ---
  function validateJSON(text, type) {
    try {
      const obj = JSON.parse(text);
      if (type === 'qcfg') {
        if (!obj.version || !obj.version.startsWith('qcfg')) throw new Error('Missing or invalid version');
        if (!obj.topic_catalogue && !obj.topic_catalogue && !obj.topicCatalog) {
          console.warn('No topic catalogue found');
        }
      }
      if (type === 'jmaths') {
        if (!obj.version || !obj.version.startsWith('jmaths')) throw new Error('Missing or invalid version');
        if (!obj.beat_library) console.warn('No beat_library found');
      }
      return { ok: true, data: obj };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function saveSpec(type) {
    const el = document.getElementById(type + 'Input');
    const statusEl = document.getElementById(type + 'Status');
    const parsed = validateJSON(el.value.trim(), type);
    if (!parsed.ok) {
      statusEl.textContent = `❌ Invalid JSON: ${parsed.error}`;
      return;
    }
    lsSet(type + 'Spec', el.value.trim());
    await initFirebase();
    await ensureAuth();
    await setDoc(doc(db, 'rooms', code, 'seed', type), { spec: parsed.data }, { merge: true });
    statusEl.textContent = '✅ Saved to Firestore';
  }

  async function loadSpec(type) {
    await initFirebase();
    await ensureAuth();
    const snap = await getDoc(doc(db, 'rooms', code, 'seed', type));
    if (snap.exists()) {
      document.getElementById(type + 'Input').value = JSON.stringify(snap.data().spec, null, 2);
      document.getElementById(type + 'Status').textContent = '📥 Loaded from Firestore';
    } else {
      document.getElementById(type + 'Status').textContent = '⚠️ No saved spec in Firestore';
    }
  }

  // --- render ---
  return `
    <main class="wrap">
      <h2>Key Room — Configure Game</h2>
      <p>Room code: <strong>${code}</strong></p>

      <section class="spec-panel">
        <h3>Quiz Questions Spec (qcfg)</h3>
        <textarea id="qcfgInput" rows="16" style="width:100%">${lsGet('qcfgSpec')}</textarea>
        <div class="controls">
          <button id="validateQcfg">Validate</button>
          <button id="saveQcfg">Save</button>
          <button id="loadQcfg">Load</button>
          <span id="qcfgStatus">Not validated</span>
        </div>
      </section>

      <section class="spec-panel">
        <h3>Jemima Maths Spec (jmaths)</h3>
        <textarea id="jmathsInput" rows="16" style="width:100%">${lsGet('jmathsSpec')}</textarea>
        <div class="controls">
          <button id="validateJmaths">Validate</button>
          <button id="saveJmaths">Save</button>
          <button id="loadJmaths">Load</button>
          <span id="jmathsStatus">Not validated</span>
        </div>
      </section>

      <section class="spec-panel">
        <h3>API & Config</h3>
        <label>Gemini API Key</label><br>
        <input id="geminiKey" type="password" style="width:100%" value="${lsGet('geminiKey')}"><br>
        <button id="saveApiKey">Save Key</button>
        <span id="apiStatus"></span>
      </section>
    </main>
  `;
}

// --- event delegation ---
document.addEventListener('click', async (e) => {
  if (!e.target) return;
  switch (e.target.id) {
    case 'validateQcfg':
      {
        const el = document.getElementById('qcfgInput');
        const statusEl = document.getElementById('qcfgStatus');
        const res = JSON.parse(el.value || '{}');
        if (res.version && res.version.startsWith('qcfg')) {
          statusEl.textContent = '✅ Valid qcfg spec';
        } else {
          statusEl.textContent = '❌ Invalid qcfg spec';
        }
      }
      break;
    case 'saveQcfg': await saveSpec('qcfg'); break;
    case 'loadQcfg': await loadSpec('qcfg'); break;
    case 'validateJmaths':
      {
        const el = document.getElementById('jmathsInput');
        const statusEl = document.getElementById('jmathsStatus');
        const res = JSON.parse(el.value || '{}');
        if (res.version && res.version.startsWith('jmaths')) {
          statusEl.textContent = '✅ Valid jmaths spec';
        } else {
          statusEl.textContent = '❌ Invalid jmaths spec';
        }
      }
      break;
    case 'saveJmaths': await saveSpec('jmaths'); break;
    case 'loadJmaths': await loadSpec('jmaths'); break;
    case 'saveApiKey':
      {
        const val = document.getElementById('geminiKey').value.trim();
        localStorage.setItem('geminiKey', val);
        document.getElementById('apiStatus').textContent = val ? '✅ Key saved locally' : '❌ No key entered';
      }
      break;
  }
});
