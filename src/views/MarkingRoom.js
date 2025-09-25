// /src/views/MarkingRoom.js
// Offline Marking phase for the current round (mark_rN).
// - Renders opponent's 3 questions + their chosen answers.
// - Saves draft marks to localStorage as the user clicks.
// - On Submit, writes a single atomic doc to Firestore and shows awards.
// - When both players have submitted, Host advances to Interlude (r1–r4) or Maths (after r5).

import {
  initFirebase, ensureAuth, db, doc, onSnapshot, setDoc, getDoc
} from '../lib/firebase.js';

export default function MarkingRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const role = (localStorage.getItem('playerRole') || 'guest').toLowerCase(); // 'host' | 'guest'
  const oppRole = role === 'host' ? 'guest' : 'host';
  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Round — Marking</h2>
    <p class="status" id="roomInfo"></p>

    <section id="mWrap" class="panel">
      <p class="status">Loading opponent’s answers…</p>
    </section>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <button id="btnSubmit" class="primary">Submit Marks</button>
      <button id="btnClear">Clear</button>
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
    </div>

    <div class="panel">
      <h3>Round Awards</h3>
      <p class="status" id="awardsMine">You awarded: — / 3</p>
      <p class="status" id="awardsForMe">You were awarded: waiting for opponent…</p>
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

  // ------------- helpers -------------
  const lsKey = (round) => `marks_r${round}_${role}`;
  const loadDraft = (round) => {
    try {
      const s = localStorage.getItem(lsKey(round));
      if (!s) return [null, null, null];
      const arr = JSON.parse(s);
      if (!Array.isArray(arr) || arr.length !== 3) return [null, null, null];
      return arr.map(v => (v === true || v === false) ? v : null);
    } catch { return [null, null, null]; }
  };
  const saveDraft = (round, arr) => { try { localStorage.setItem(lsKey(round), JSON.stringify(arr)); } catch {} };
  const clearDraft = (round) => { try { localStorage.removeItem(lsKey(round)); } catch {} };

  function escapeHTML(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  function parseRoundFromState(state) {
    let m = /^mark_r(\d+)$/.exec(state || '');
    if (m) return parseInt(m[1], 10);
    m = /^q_r(\d+)$/.exec(state || '');
    if (m) return parseInt(m[1], 10);
    return null;
  }

  function countTrue(arr) { return arr.filter(v => v === true).length; }

  // ------------- rendering -------------
  function renderMarking(opponentQs, opponentAnswers, round) {
    const draft = loadDraft(round);
    const wrap = $('#mWrap');
    wrap.innerHTML = '';

    if (!opponentQs || opponentQs.length !== 3) {
      wrap.innerHTML = `<p class="status">Opponent questions missing for this round.</p>`;
      return;
    }
    if (!opponentAnswers || opponentAnswers.length !== 3) {
      wrap.innerHTML = `<p class="status">Opponent hasn’t submitted answers yet. Wait…</p>`;
      return;
    }

    opponentQs.forEach((item, idx) => {
      const chosen = opponentAnswers[idx]; // 0 or 1
      const chosenLabel = chosen === 0 ? 'A' : (chosen === 1 ? 'B' : '—');

      const card = document.createElement('div');
      card.className = 'panel';
      card.innerHTML = `
        <h3>Q${idx + 1}</h3>
        <p style="margin-top:0.25rem;">${escapeHTML(item.q)}</p>

        <div class="row" style="gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
          <div style="min-width:48px;text-align:center;font-weight:700;">A</div>
          <div style="flex:1;min-width:160px;">${escapeHTML(item.a1)}</div>
          <div class="status">${chosenLabel === 'A' ? '← Opponent chose this' : ''}</div>
        </div>

        <div class="row" style="gap:0.5rem; margin-top:0.5rem; flex-wrap:wrap;">
          <div style="min-width:48px;text-align:center;font-weight:700;">B</div>
          <div style="flex:1;min-width:160px;">${escapeHTML(item.a2)}</div>
          <div class="status">${chosenLabel === 'B' ? '← Opponent chose this' : ''}</div>
        </div>

        <div class="row" style="gap:0.5rem; margin-top:0.75rem; flex-wrap:wrap;">
          <button class="mk" data-i="${idx}" data-v="true">Mark Correct</button>
          <button class="mk" data-i="${idx}" data-v="false">Mark Incorrect</button>
          <div class="status" id="mk-${idx}">${draft[idx] === null ? 'No mark yet' : (draft[idx] ? 'Marked: Correct' : 'Marked: Incorrect')}</div>
        </div>
      `;
      wrap.appendChild(card);
    });

    function updateUI() {
      for (let i = 0; i < 3; i++) {
        const lab = document.getElementById(`mk-${i}`);
        lab && (lab.textContent = draft[i] === null ? 'No mark yet' : (draft[i] ? 'Marked: Correct' : 'Marked: Incorrect'));
      }
      // Also update "You awarded" preview
      $('#awardsMine').textContent = `You awarded: ${countTrue(draft)}/3`;
    }

    wrap.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.classList.contains('mk')) return;
      const i = parseInt(t.getAttribute('data-i'), 10);
      const v = t.getAttribute('data-v') === 'true';
      if (Number.isInteger(i)) {
        draft[i] = v;
        saveDraft(round, draft);
        updateUI();
      }
    });

    updateUI();
  }

  // ------------- submit -------------
  async function submitMarks(round) {
    const draft = loadDraft(round);
    if (draft.some(v => v !== true && v !== false)) {
      log('Please mark all three answers before submitting.', 'error');
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
      marks: { [`r${round}`]: draft },
      awardsGiven: { [`r${round}`]: countTrue(draft) },
      timestamps: { [`r${round}_marked`]: new Date().toISOString() }
    };
    try {
      await setDoc(playerRef, payload, { merge: true });
      log('✅ Marks submitted.');
      // After submit, we remain in this screen so we can show both awards.
      $('#awardsMine').textContent = `You awarded: ${countTrue(draft)}/3`;
    } catch (e) {
      log('Submit failed: ' + (e?.message || e), 'error');
    }
  }

  // ------------- host auto-advance once both submitted -------------
  async function maybeAdvance(state, round, hostHasControl, playersData) {
    if (!hostHasControl) return;
    // Both marks present?
    const hostMarks = playersData.host?.marks?.[`r${round}`];
    const guestMarks = playersData.guest?.marks?.[`r${round}`];
    if (!Array.isArray(hostMarks) || hostMarks.length !== 3) return;
    if (!Array.isArray(guestMarks) || guestMarks.length !== 3) return;

    // Decide next state
    let nextState, nextInfo;
    if (round <= 4) {
      nextState = `interlude_r${round}`;
      nextInfo = 'Interlude';
    } else {
      nextState = 'maths';
      nextInfo = 'Jemima Maths';
    }
    try {
      await setDoc(doc(db, 'rooms', code), {
        state: nextState,
        countdownT0: new Date(Date.now() + 3500)
      }, { merge: true });
      log(`Host advanced to ${nextInfo}.`);
    } catch (e) {
      log('Advance failed: ' + (e?.message || e), 'error');
    }
  }

  // ------------- live room + players + seed -------------
  let unsubRoom = null, unsubHost = null, unsubGuest = null;

  (async () => {
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      log('Firebase error: ' + (e?.message || e), 'error');
      return;
    }

    const roomRef = doc(db, 'rooms', code);
    let currentRound = null;
    let players = { host: {}, guest: {} };
    let seedCache = null;

    function recomputeUI(roomData) {
      const state = roomData?.state || '';
      const r = parseRoundFromState(state);
      if (!r) {
        $('#mWrap').innerHTML = `<p class="status">Waiting for marking round to start…</p>`;
        return;
      }
      currentRound = r;

      // Load opponent questions & answers
      if (!seedCache || !Array.isArray(seedCache.rounds) || seedCache.rounds.length < r) {
        $('#mWrap').innerHTML = `<p class="status">Seed missing or incomplete for this round.</p>`;
        return;
      }
      const entry = seedCache.rounds[r - 1];
      const oppQs = role === 'host' ? entry.guestQ : entry.hostQ;

      const oppAnswers = players[oppRole]?.answers?.[`r${r}`];
      renderMarking(oppQs, oppAnswers, r);

      // Update awards panel
      const mine = loadDraft(r);
      $('#awardsMine').textContent = `You awarded: ${countTrue(mine)}/3`;

      const oppMarksForMe = players[oppRole]?.marks?.[`r${r}`];
      if (Array.isArray(oppMarksForMe) && oppMarksForMe.length === 3) {
        $('#awardsForMe').textContent = `You were awarded: ${countTrue(oppMarksForMe)}/3`;
      } else {
        $('#awardsForMe').textContent = `You were awarded: waiting for opponent…`;
      }

      // Host auto-advance when both submitted
      const hostHasControl = role === 'host';
      maybeAdvance(state, r, hostHasControl, players);
    }

    unsubRoom = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        $('#mWrap').innerHTML = `<p class="status">Room not found.</p>`;
        return;
      }
      const data = snap.data() || {};
      // Transition follow
      if (data.state?.startsWith('countdown_r')) return navigate('#/countdown');
      if (data.state?.startsWith('interlude_r')) return navigate('#/interlude');
      if (data.state === 'maths') return navigate('#/maths');
      if (data.state === 'final') return navigate('#/final');

      // If still in q_rN and we are Host, flip to mark_rN once
      const rFromQ = /^q_r(\d+)$/.exec(data.state || '');
      if (rFromQ && role === 'host') {
        try {
          await setDoc(roomRef, { state: `mark_r${parseInt(rFromQ[1], 10)}` }, { merge: true });
        } catch (e) {
          log('Failed to enter Marking: ' + (e?.message || e), 'error');
        }
      }

      // Cache seed (lazy)
      seedCache = data.seed || seedCache || (await getDoc(roomRef).then(s => s.data()?.seed).catch(() => null));

      // Recompute UI with latest info
      recomputeUI(data);
    }, (err) => {
      console.error('[marking] room snapshot error', err);
      log('Sync error: ' + (err?.message || err), 'error');
    });

    // Players listeners (to know when answers/marks arrive)
    unsubHost = onSnapshot(doc(db, 'rooms', code, 'players', 'host'), (snap) => {
      players.host = snap.exists() ? (snap.data() || {}) : {};
      const rd = (document.getElementById('mWrap') && currentRound) ? currentRound : null;
      if (rd) recomputeUI((seedCache && { state: `mark_r${rd}` }) || {});
    });
    unsubGuest = onSnapshot(doc(db, 'rooms', code, 'players', 'guest'), (snap) => {
      players.guest = snap.exists() ? (snap.data() || {}) : {};
      const rd = (document.getElementById('mWrap') && currentRound) ? currentRound : null;
      if (rd) recomputeUI((seedCache && { state: `mark_r${rd}` }) || {});
    });

    // Wire buttons after Firebase init
    $('#btnSubmit').onclick = () => {
      const rd = currentRound || 1;
      submitMarks(rd);
    };
    $('#btnClear').onclick = () => {
      const rd = currentRound || 1;
      clearDraft(rd);
      // Re-render using whatever opponent data we currently have
      const entry = seedCache?.rounds?.[rd - 1];
      const oppQs = role === 'host' ? entry?.guestQ : entry?.hostQ;
      const oppAnswers = (role === 'host' ? players.guest : players.host)?.answers?.[`r${rd}`];
      renderMarking(oppQs, oppAnswers, rd);
      $('#awardsMine').textContent = `You awarded: 0/3`;
    };
  })();

  // Cleanup
  el._destroy = () => {
    try { unsubRoom && unsubRoom(); } catch {}
    try { unsubHost && unsubHost(); } catch {}
    try { unsubGuest && unsubGuest(); } catch {}
  };

  return el;
}
