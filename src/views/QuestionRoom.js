// /src/views/QuestionRoom.js
// Offline Questions phase for the current round (q_rN).
// - Renders 3 A/B questions for the active player (host → hostQ, guest → guestQ).
// - Saves draft answers to localStorage as the user clicks.
// - On Submit, writes a single atomic doc to Firestore and navigates locally to #/marking.

import {
  initFirebase, ensureAuth, db, doc, onSnapshot, setDoc, getDoc
} from '../lib/firebase.js';

export default function QuestionRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const role = (localStorage.getItem('playerRole') || 'guest').toLowerCase();
  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Round — Questions</h2>
    <p class="status" id="roomInfo"></p>

    <section id="qWrap" class="panel"></section>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <button id="btnSubmit" class="primary">Submit Answers</button>
      <button id="btnClear">Clear</button>
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
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
  const lsKey = (round) => `answers_r${round}_${role}`;
  const loadDraft = (round) => {
    try {
      const s = localStorage.getItem(lsKey(round));
      if (!s) return [null, null, null];
      const arr = JSON.parse(s);
      if (!Array.isArray(arr) || arr.length !== 3) return [null, null, null];
      return arr.map(v => (v === 0 || v === 1) ? v : null);
    } catch { return [null, null, null]; }
  };
  const saveDraft = (round, arr) => {
    try { localStorage.setItem(lsKey(round), JSON.stringify(arr)); } catch {}
  };
  const clearDraft = (round) => {
    try { localStorage.removeItem(lsKey(round)); } catch {}
  };

  function parseRoundFromState(state) {
    const m = /^q_r(\d+)$/.exec(state || '');
    return m ? parseInt(m[1], 10) : null;
  }

  // ---------- rendering ----------
  function renderQuestions(questions, round) {
    // questions: array of 3 items { q, a1, a2, correct }
    const draft = loadDraft(round);
    const wrap = $('#qWrap');
    wrap.innerHTML = '';
    if (!questions || questions.length !== 3) {
      wrap.innerHTML = `<p class="status">No questions for this round. Host should (re)generate the seed.</p>`;
      return;
    }

    questions.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'panel';
      card.innerHTML = `
        <h3>Q${idx + 1}</h3>
        <p style="margin-top:0.25rem;">${escapeHTML(item.q)}</p>
        <div class="row" style="gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
          <button data-i="${idx}" data-v="0" class="opt">A</button>
          <div style="flex:1;min-width:160px;"><span class="status">A:</span> ${escapeHTML(item.a1)}</div>
        </div>
        <div class="row" style="gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
          <button data-i="${idx}" data-v="1" class="opt">B</button>
          <div style="flex:1;min-width:160px;"><span class="status">B:</span> ${escapeHTML(item.a2)}</div>
        </div>
        <div class="status" id="sel-${idx}">${draft[idx] === null ? 'No selection' : `Selected: ${draft[idx] === 0 ? 'A' : 'B'}`}</div>
      `;
      wrap.appendChild(card);
    });

    // highlight selections + wire clicks
    function updateUI() {
      for (let i = 0; i < 3; i++) {
        const lab = document.getElementById(`sel-${i}`);
        lab && (lab.textContent = (draft[i] === null ? 'No selection' : `Selected: ${draft[i] === 0 ? 'A' : 'B'}`));
      }
      wrap.querySelectorAll('button.opt').forEach(btn => {
        const i = parseInt(btn.getAttribute('data-i'), 10);
        const v = parseInt(btn.getAttribute('data-v'), 10);
        const active = draft[i] === v;
        btn.style.outline = active ? '2px solid var(--accent-yellow)' : 'none';
      });
    }

    wrap.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.classList.contains('opt')) return;
      const i = parseInt(t.getAttribute('data-i'), 10);
      const v = parseInt(t.getAttribute('data-v'), 10);
      if (Number.isInteger(i) && (v === 0 || v === 1)) {
        draft[i] = v;
        saveDraft(round, draft);
        updateUI();
      }
    });

    updateUI();
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  // ---------- submit ----------
  async function submitAnswers(round) {
    const draft = loadDraft(round);
    if (draft.some(v => v !== 0 && v !== 1)) {
      log('Please answer all three questions before submitting.', 'error');
      return;
    }
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      log('Firebase not ready: ' + (e?.message || e), 'error');
      return;
    }

    const playerRef = doc(db, 'rooms', code, 'players', role);
    const payload = {
      answers: { [`r${round}`]: draft },
      timestamps: { [`r${round}`]: new Date().toISOString() }
    };
    try {
      await setDoc(playerRef, payload, { merge: true });
      log('✅ Answers submitted.');
      // Keep this phase offline: do NOT change room.state here.
      // Navigate locally to Marking.
      navigate('#/marking');
    } catch (e) {
      log('Submit failed: ' + (e?.message || e), 'error');
    }
  }

  // ---------- live room & seed fetch ----------
  let unsub = null;

  (async () => {
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      log('Firebase error: ' + (e?.message || e), 'error');
      return;
    }

    const roomRef = doc(db, 'rooms', code);
    unsub = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        $('#qWrap').innerHTML = `<p class="status">Room not found.</p>`;
        return;
      }
      const data = snap.data() || {};
      const state = data.state || '';

      // Follow FSM if host accidentally advanced
      if (!state.startsWith('q_r')) {
        if (state.startsWith('mark_r')) return navigate('#/marking');
        if (state.startsWith('countdown_r')) return navigate('#/countdown');
        if (state.startsWith('interlude_r')) return navigate('#/interlude');
        if (state === 'maths') return navigate('#/maths');
        if (state === 'final') return navigate('#/final');
        // Otherwise stay; host may not have advanced yet.
      }

      const round = parseRoundFromState(state) || inferRoundFromClient(); // fallback if needed
      if (!round) {
        $('#qWrap').innerHTML = `<p class="status">Waiting for host to start Questions…</p>`;
        return;
      }

      // Ensure we have a draft in storage
      const existing = loadDraft(round);
      if (!existing || existing.length !== 3) saveDraft(round, [null, null, null]);

      // Load seed once (no heavy polling)
      const seed = data.seed || (await getDoc(roomRef).then(s => s.data()?.seed).catch(() => null));
      if (!seed) {
        $('#qWrap').innerHTML = `<p class="status">Seed missing. Host should generate in Key Room.</p>`;
        return;
      }
      if (!Array.isArray(seed.rounds) || seed.rounds.length < round) {
        $('#qWrap').innerHTML = `<p class="status">Seed does not include this round.</p>`;
        return;
      }

      const roundEntry = seed.rounds[round - 1];
      const myQs = role === 'host' ? roundEntry.hostQ : roundEntry.guestQ;
      renderQuestions(myQs, round);

      // Wire buttons with the known round
      $('#btnSubmit').onclick = () => submitAnswers(round);
      $('#btnClear').onclick = () => { clearDraft(round); renderQuestions(myQs, round); };
    }, (err) => {
      console.error('[questions] snapshot error', err);
      log('Sync error: ' + (err?.message || err), 'error');
    });
  })();

  function inferRoundFromClient() {
    // Optional fallback if state is missing; look for last saved round and add 1
    const keys = Object.keys(localStorage).filter(k => k.startsWith('answers_r') && k.endsWith(`_${role}`));
    const nums = keys.map(k => parseInt((k.match(/answers_r(\d+)_/) || [])[1], 10)).filter(n => Number.isInteger(n));
    const maxDone = nums.length ? Math.max(...nums) : 0;
    return Math.min(maxDone + 1, 5) || null;
  }

  // Cleanup
  el._destroy = () => { try { unsub && unsub(); } catch {} };

  return el;
}
