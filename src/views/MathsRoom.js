// /src/views/MathsRoom.js
// Final two maths questions (objective). Offline until submit; host advances to Final.

import {
  initFirebase, ensureAuth, db, doc, onSnapshot, setDoc, getDoc
} from '../lib/firebase.js';

export default function MathsRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const role = (localStorage.getItem('playerRole') || 'guest').toLowerCase(); // 'host' | 'guest'
  const oppRole = role === 'host' ? 'guest' : 'host';
  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Jemima’s Maths — Final Questions</h2>
    <p class="status" id="roomInfo"></p>

    <section id="mWrap" class="panel">
      <p class="status">Loading questions…</p>
    </section>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <button id="btnSubmit" class="primary">Submit Maths Answers</button>
      <button id="btnClear">Clear</button>
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
    </div>

    <div class="panel">
      <h3>Status</h3>
      <p class="status" id="mine">Your maths score: — / 2</p>
      <p class="status" id="opp">Opponent submitted: waiting…</p>
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

  // ---------- helpers ----------
  function escapeHTML(s) {
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }
  function parseIntSafe(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (!Number.isInteger(n)) return null;
    return n;
  }
  const lsKey = () => `maths_${role}_${code}`;
  const loadDraft = () => {
    try { const s = localStorage.getItem(lsKey()); if (!s) return [null, null]; const a = JSON.parse(s); return Array.isArray(a)&&a.length===2?a.map(v=>Number.isInteger(v)?v:null):[null,null]; }
    catch { return [null, null]; }
  };
  const saveDraft = (arr) => { try { localStorage.setItem(lsKey(), JSON.stringify(arr)); } catch {} };
  const clearDraft = () => { try { localStorage.removeItem(lsKey()); } catch {} };

  function renderUI(maths, range) {
    const [d1, d2] = loadDraft();
    const wrap = $('#mWrap');
    wrap.innerHTML = `
      <h3>Two questions. Answers must be whole numbers.</h3>

      <div class="panel">
        <p><strong>Q1.</strong> ${escapeHTML(maths.q1.prompt)}</p>
        <div class="row" style="gap:0.5rem;align-items:center;">
          <label for="a1">Your answer:</label>
          <input id="a1" type="number" step="1" inputmode="numeric" style="max-width:140px;" />
          <small class="status" id="a1s"></small>
        </div>
      </div>

      <div class="panel">
        <p><strong>Q2.</strong> ${escapeHTML(maths.q2.prompt)}</p>
        <div class="row" style="gap:0.5rem;align-items:center;">
          <label for="a2">Your answer:</label>
          <input id="a2" type="number" step="1" inputmode="numeric" style="max-width:140px;" />
          <small class="status" id="a2s"></small>
        </div>
      </div>

      <small class="status">${range ? `Allowed range: ${range.min}–${range.max}.` : ''}</small>
    `;

    const a1 = $('#a1'), a2 = $('#a2'), a1s = $('#a1s'), a2s = $('#a2s');
    if (d1 !== null) a1.value = String(d1);
    if (d2 !== null) a2.value = String(d2);

    function validateAndSave() {
      const v1 = parseIntSafe(a1.value);
      const v2 = parseIntSafe(a2.value);
      let ok = true;

      if (v1 === null) { a1s.textContent = 'Enter an integer'; ok = false; }
      else if (range && (v1 < range.min || v1 > range.max)) { a1s.textContent = 'Out of range'; ok = false; }
      else { a1s.textContent = '✓'; }

      if (v2 === null) { a2s.textContent = 'Enter an integer'; ok = false; }
      else if (range && (v2 < range.min || v2 > range.max)) { a2s.textContent = 'Out of range'; ok = false; }
      else { a2s.textContent = '✓'; }

      saveDraft([v1, v2]);
      return ok;
    }

    a1.addEventListener('input', validateAndSave);
    a2.addEventListener('input', validateAndSave);
    validateAndSave();

    // Wire buttons
    $('#btnSubmit').onclick = async () => {
      if (!validateAndSave()) { log('Please provide valid integers for both answers.', 'error'); return; }
      const [v1, v2] = loadDraft();
      if (v1 === null || v2 === null) { log('Please answer both questions.', 'error'); return; }

      try {
        await initFirebase();
        await ensureAuth();
      } catch (e) {
        log('Firebase not ready: ' + (e?.message || e), 'error');
        return;
      }

      // Score objectively vs seed
      const score = (Number(v1 === maths.q1.answer) + Number(v2 === maths.q2.answer));
      const playerRef = doc(db, 'rooms', code, 'players', role);
      try {
        await setDoc(playerRef, {
          mathsAnswers: [v1, v2],
          mathsScore: score,
          timestamps: { mathsSubmittedAt: new Date().toISOString() }
        }, { merge: true });
        $('#mine').textContent = `Your maths score: ${score} / 2`;
        log('✅ Maths answers submitted.');

        // Host may advance to final if both present (handled in listener below too)
        maybeAdvanceIfBothDone();
      } catch (e) {
        log('Submit failed: ' + (e?.message || e), 'error');
      }
    };

    $('#btnClear').onclick = () => {
      clearDraft();
      renderUI(maths, range);
      $('#mine').textContent = `Your maths score: — / 2`;
    };
  }

  // Host advances to final when both players have mathsAnswers
  async function advanceToFinal() {
    try {
      await setDoc(doc(db, 'rooms', code), {
        state: 'final',
        countdownT0: new Date(Date.now() + 1500)
      }, { merge: true });
      log('Advancing to Final…');
      navigate('#/final');
    } catch (e) {
      log('Advance failed: ' + (e?.message || e), 'error');
    }
  }

  let latestPlayers = { host: null, guest: null };
  function bothHaveMaths() {
    const h = latestPlayers.host, g = latestPlayers.guest;
    return Array.isArray(h?.mathsAnswers) && h.mathsAnswers.length === 2 &&
           Array.isArray(g?.mathsAnswers) && g.mathsAnswers.length === 2;
  }
  function maybeAdvanceIfBothDone() {
    if (role !== 'host') return;
    if (bothHaveMaths()) advanceToFinal();
  }

  // ---------- live listeners ----------
  let unsubRoom = null, unsubHost = null, unsubGuest = null;

  (async () => {
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      $('#mWrap').innerHTML = `<p class="status">Firebase error: ${e?.message || e}</p>`;
      return;
    }

    const roomRef = doc(db, 'rooms', code);

    // Room + seed
    unsubRoom = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        $('#mWrap').innerHTML = `<p class="status">Room not found.</p>`;
        return;
      }
      const data = snap.data() || {};

      // Follow FSM if earlier/later states appear
      if (data.state?.startsWith('countdown_r')) return navigate('#/countdown');
      if (data.state?.startsWith('q_r')) return navigate('#/questions');
      if (data.state?.startsWith('mark_r')) return navigate('#/marking');
      if (data.state === 'final') return navigate('#/final');

      if (data.state !== 'maths') {
        $('#mWrap').innerHTML = `<p class="status">Waiting for Maths to begin…</p>`;
        return;
      }

      const seed = data.seed || (await getDoc(roomRef).then(s => s.data()?.seed).catch(() => null));
      const maths = seed?.maths;
      if (!maths) {
        $('#mWrap').innerHTML = `<p class="status">Maths payload missing from seed.</p>`;
        return;
      }

      const jcfg = null; // Optional: if you want to store config range, you could read meta here.
      const range = data?.meta?.jmathsRange || null; // not set by default; harmless if null
      renderUI(maths, range);
    }, (err) => {
      console.error('[maths] room snapshot error', err);
      log('Sync error: ' + (err?.message || err), 'error');
    });

    // Players: to know when opponent has submitted & to auto-advance for host
    unsubHost = onSnapshot(doc(db, 'rooms', code, 'players', 'host'), (snap) => {
      latestPlayers.host = snap.exists() ? (snap.data() || {}) : {};
      const h = latestPlayers.host;
      if (Array.isArray(h?.mathsAnswers)) $('#mine').textContent = `Your maths score: ${Number.isInteger(h.mathsScore)?h.mathsScore:'—'} / 2`;
      if (role === 'guest') {
        $('#opp').textContent = Array.isArray(h?.mathsAnswers) ? 'Opponent submitted.' : 'Opponent submitted: waiting…';
      }
      maybeAdvanceIfBothDone();
    });
    unsubGuest = onSnapshot(doc(db, 'rooms', code, 'players', 'guest'), (snap) => {
      latestPlayers.guest = snap.exists() ? (snap.data() || {}) : {};
      const g = latestPlayers.guest;
      if (role === 'host') {
        $('#opp').textContent = Array.isArray(g?.mathsAnswers) ? 'Opponent submitted.' : 'Opponent submitted: waiting…';
      } else {
        $('#mine').textContent = Array.isArray(g?.mathsAnswers) ? `Your maths score: ${Number.isInteger(g.mathsScore)?g.mathsScore:'—'} / 2` : $('#mine').textContent;
      }
      maybeAdvanceIfBothDone();
    });
  })();

  el._destroy = () => {
    try { unsubRoom && unsubRoom(); } catch {}
    try { unsubHost && unsubHost(); } catch {}
    try { unsubGuest && unsubGuest(); } catch {}
  };

  return el;
}
