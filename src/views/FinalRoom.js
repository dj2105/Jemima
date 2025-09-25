// /src/views/FinalRoom.js
// Final reveal: Perceived scores (opponent-awarded) vs Actual scores (objective + maths). Announces winner.

import {
  initFirebase, ensureAuth, db, doc, onSnapshot, getDoc
} from '../lib/firebase.js';

export default function FinalRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const role = (localStorage.getItem('playerRole') || 'guest').toLowerCase();
  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Final Room</h2>
    <p class="status" id="roomInfo"></p>

    <section class="panel" id="reveal">
      <p class="status">Loading final scores…</p>
    </section>

    <div class="panel" id="winnerPanel" style="text-align:center"></div>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
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

  function escapeHTML(s) {
    return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  }
  function sum(arr) { return (arr || []).reduce((a,b) => a + (Number(b)||0), 0); }
  function countTrue(arr) { return (arr || []).reduce((a,b)=> a + (b === true ? 1 : 0), 0); }

  // Compute objective correctness per player over rounds 1–5
  function actualFromSeed(seed, playerAnswers, isHost) {
    if (!seed?.rounds || !Array.isArray(seed.rounds)) return { perRound:[0,0,0,0,0], total:0 };
    const perRound = [];
    for (let r = 1; r <= 5; r++) {
      const round = seed.rounds[r-1];
      if (!round) { perRound.push(0); continue; }
      const qs = isHost ? round.hostQ : round.guestQ;       // which 3 Qs apply to this player
      const ans = playerAnswers?.[`r${r}`];                 // [0/1,0/1,0/1]
      if (!Array.isArray(ans) || ans.length !== 3) { perRound.push(0); continue; }
      let correct = 0;
      for (let i = 0; i < 3; i++) {
        const my = ans[i];
        const truth = qs?.[i]?.correct;
        if ((my === 0 || my === 1) && (truth === 0 || truth === 1) && my === truth) correct++;
      }
      perRound.push(correct);
    }
    return { perRound, total: sum(perRound) };
  }

  function perceivedFromOpponentMarks(opponentDoc) {
    const vals = [];
    for (let r = 1; r <= 5; r++) {
      const arr = opponentDoc?.marks?.[`r${r}`];
      vals.push(Array.isArray(arr) ? countTrue(arr) : 0);
    }
    return { perRound: vals, total: sum(vals) };
  }

  function render(seed, hostDoc, guestDoc) {
    // Compute all tallies
    const hostActual = actualFromSeed(seed, hostDoc?.answers, true);
    const guestActual = actualFromSeed(seed, guestDoc?.answers, false);

    const hostMaths = Number.isInteger(hostDoc?.mathsScore) ? hostDoc.mathsScore : 0;
    const guestMaths = Number.isInteger(guestDoc?.mathsScore) ? guestDoc.mathsScore : 0;

    const hostActualTotal = hostActual.total + hostMaths;   // /17
    const guestActualTotal = guestActual.total + guestMaths;

    const hostPerceived = perceivedFromOpponentMarks(guestDoc);
    const guestPerceived = perceivedFromOpponentMarks(hostDoc);

    // Winner logic
    let winner = '';
    if (hostActualTotal > guestActualTotal) winner = 'Host wins!';
    else if (guestActualTotal > hostActualTotal) winner = 'Guest wins!';
    else winner = 'It’s a tie!';

    // Build tables
    const table = (name, perc, act, maths) => `
      <div class="panel" style="flex:1; min-width:280px;">
        <h3>${name}</h3>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; border-bottom:1px solid var(--line); padding:4px 0;">Round</th>
              <th style="text-align:right; border-bottom:1px solid var(--line); padding:4px 0;">Perceived</th>
              <th style="text-align:right; border-bottom:1px solid var(--line); padding:4px 0;">Actual</th>
            </tr>
          </thead>
          <tbody>
            ${[1,2,3,4,5].map(i => `
              <tr>
                <td style="padding:4px 0;">${i}</td>
                <td style="text-align:right;">${perc.perRound[i-1]} / 3</td>
                <td style="text-align:right;">${act.perRound[i-1]} / 3</td>
              </tr>
            `).join('')}
            <tr>
              <td style="padding-top:6px; border-top:1px solid var(--line);"><em>Maths</em></td>
              <td style="text-align:right; border-top:1px solid var(--line);">—</td>
              <td style="text-align:right; border-top:1px solid var(--line);">${maths} / 2</td>
            </tr>
            <tr>
              <td style="padding-top:6px; border-top:2px solid var(--line); font-weight:700;">Totals</td>
              <td style="text-align:right; border-top:2px solid var(--line); font-weight:700;">${perc.total} / 15</td>
              <td style="text-align:right; border-top:2px solid var(--line); font-weight:700;">${act.total + maths} / 17</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    $('#reveal').innerHTML = `
      <h3>Perceived vs Actual</h3>
      <p class="status">Perceived = what your opponent awarded you. Actual = objectively correct answers + maths.</p>
      <div class="row" style="gap:1rem; flex-wrap:wrap;">
        ${table('Host', hostPerceived, hostActual, hostMaths)}
        ${table('Guest', guestPerceived, guestActual, guestMaths)}
      </div>
    `;

    const drama = (()=>{
      const hostDelta = hostPerceived.total - (hostActual.total + hostMaths);
      const guestDelta = guestPerceived.total - (guestActual.total + guestMaths);
      function line(name, delta) {
        if (delta === 0) return `${name}’s opponent was spot on.`;
        if (delta > 0) return `${name} felt flattered (+${delta}).`;
        return `${name} was judged harshly (${delta}).`;
        }
      return `${line('Host', hostDelta)} ${line('Guest', guestDelta)}`;
    })();

    const closer = (winner === 'It’s a tie!')
      ? 'A perfect balance — Jemima approves.' 
      : 'Well played. Jemima tips her hat.';

    $('#winnerPanel').innerHTML = `
      <h3>${escapeHTML(winner)}</h3>
      <p class="status">${escapeHTML(drama)}</p>
      <p class="status">${escapeHTML(closer)}</p>
    `;
  }

  // Live data
  let unsub = null, hostDoc = null, guestDoc = null, seed = null;

  (async () => {
    try {
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      $('#reveal').innerHTML = `<p class="status">Firebase error: ${e?.message || e}</p>`;
      return;
    }

    const roomRef = doc(db, 'rooms', code);

    unsub = onSnapshot(roomRef, async (snap) => {
      if (!snap.exists()) {
        $('#reveal').innerHTML = `<p class="status">Room not found.</p>`;
        return;
      }
      const data = snap.data() || {};

      // Follow FSM if not yet final
      if (data.state?.startsWith('countdown_r')) return navigate('#/countdown');
      if (data.state?.startsWith('q_r')) return navigate('#/questions');
      if (data.state?.startsWith('mark_r')) return navigate('#/marking');
      if (data.state?.startsWith('interlude_r')) return navigate('#/interlude');
      if (data.state !== 'final') {
        $('#reveal').innerHTML = `<p class="status">Waiting for Final…</p>`;
        return;
      }

      seed = data.seed || seed || (await getDoc(roomRef).then(s => s.data()?.seed).catch(() => null));
      if (!seed) {
        $('#reveal').innerHTML = `<p class="status">Seed missing. Cannot compute actual scores.</p>`;
        return;
      }

      // Load player docs (once each and on changes)
      const [hSnap, gSnap] = await Promise.all([
        getDoc(doc(db, 'rooms', code, 'players', 'host')),
        getDoc(doc(db, 'rooms', code, 'players', 'guest')),
      ]);
      hostDoc = hSnap.exists() ? (hSnap.data() || {}) : {};
      guestDoc = gSnap.exists() ? (gSnap.data() || {}) : {};

      render(seed, hostDoc, guestDoc);

      // Also subscribe to players for late-arriving data
      onSnapshot(doc(db, 'rooms', code, 'players', 'host'), (s) => {
        hostDoc = s.exists() ? (s.data() || {}) : {};
        render(seed, hostDoc, guestDoc);
      });
      onSnapshot(doc(db, 'rooms', code, 'players', 'guest'), (s) => {
        guestDoc = s.exists() ? (s.data() || {}) : {};
        render(seed, hostDoc, guestDoc);
      });
    }, (err) => {
      console.error('[final] snapshot error', err);
      log('Sync error: ' + (err?.message || err), 'error');
    });
  })();

  el._destroy = () => { try { unsub && unsub(); } catch {} };

  return el;
}
