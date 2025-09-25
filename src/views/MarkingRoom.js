// /src/views/MarkingRoom.js
// Round N — Mark Opponent.
// - Waits for opponent answers (answers/{host|guest}_r{round}).
// - Lets the player mark each of the opponent's answers as Correct/Incorrect.
// - Saves to marking/{host|guest}_r{round} with an array of booleans.
// - When both players have submitted marks, shows how many the opponent awarded you,
//   then advances everyone to the next phase via Countdown.

import {
  initFirebase, ensureAuth, db, doc, collection,
  getDoc, setDoc, onSnapshot
} from '../lib/firebase.js';

export default function MarkingRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  // ---- helpers ----
  const get = (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const set = (k, v)       => { try { localStorage.setItem(k, v); } catch {} };

  const roomCode = (get('lastGameCode','') || '').toUpperCase();
  const roleRaw  = (get('playerRole','host') || '').toLowerCase();
  const isHost   = roleRaw === 'host' || roleRaw === 'daniel';
  const round    = Number(ctx.round || 1);

  const myKey    = isHost ? 'host' : 'guest';
  const oppKey   = isHost ? 'guest' : 'host';

  // ---- UI scaffold ----
  const root = document.createElement('div');
  root.className = 'wrap';

  const title = document.createElement('h2');
  title.className = 'panel-title accent-white';
  title.textContent = `ROUND ${round} — MARK OPPONENT`;
  root.appendChild(title);

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'left';
  root.appendChild(card);

  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  row.appendChild(btn);
  root.appendChild(row);

  // ---- local state ----
  let oppAnswers = null;        // array like ['a1','a2','a2'] (their selections)
  let myMarks    = [null,null,null]; // booleans you choose (true=Correct, false=Incorrect)
  let mySubmitted = false;
  let oppSubmitted = false;
  let myAnswers = null;         // your own answers, to read how many opp awarded you

  // ---- start ----
  void start();
  return root;

  async function start() {
    if (!roomCode) {
      card.textContent = 'Error: no room joined.';
      return;
    }

    try {
      initFirebase();
      await ensureAuth();

      // Load my own answers (so later we can show how many the opponent awarded me)
      const myAnsRef = doc(collection(db, 'rooms'), roomCode, 'answers', `${myKey}_r${round}`);
      const myAnsSnap = await getDoc(myAnsRef);
      myAnswers = myAnsSnap.exists() ? (myAnsSnap.data()?.answers || null) : null;

      // Watch opponent answers
      const oppAnsRef = doc(collection(db, 'rooms'), roomCode, 'answers', `${oppKey}_r${round}`);
      onSnapshot(oppAnsRef, (snap) => {
        if (!snap.exists()) {
          renderWaiting(`Waiting for ${isHost ? 'Jaime' : 'Daniel'} to submit answers...`);
          return;
        }
        const d = snap.data() || {};
        const arr = Array.isArray(d.answers) ? d.answers : null;
        if (!arr || arr.length < 3) {
          renderWaiting(`Waiting for ${isHost ? 'Jaime' : 'Daniel'} to submit answers...`);
          return;
        }
        oppAnswers = arr.slice(0,3);
        renderMarkingUI();
      });

      // Watch marking docs (mine + opponent's)
      const myMarkRef  = doc(collection(db,'rooms'), roomCode, 'marking', `${myKey}_r${round}`);
      const oppMarkRef = doc(collection(db,'rooms'), roomCode, 'marking', `${oppKey}_r${round}`);

      onSnapshot(myMarkRef, (snap) => {
        mySubmitted = snap.exists() && (snap.data()?.complete === true);
        maybeShowResults();
      });
      onSnapshot(oppMarkRef, (snap) => {
        oppSubmitted = snap.exists() && (snap.data()?.complete === true);
        maybeShowResults();
      });

      // GO handler — save my marks
      btn.addEventListener('click', async () => {
        if (myMarks.some(x => x === null)) return;
        btn.disabled = true;
        try {
          await setDoc(myMarkRef, {
            markedBy: myKey,
            round,
            marks: myMarks,
            complete: true,
            ts: Date.now()
          }, { merge: true });

          // After submitting, show waiting-for-opponent UI
          renderWaiting(`Waiting for ${isHost ? 'Jaime' : 'Daniel'} to score you...`);
        } catch (e) {
          card.textContent = 'Could not submit marks. Please try again.';
          console.error('[Marking] submit error', e);
          btn.disabled = false;
        }
      });

    } catch (e) {
      console.error('[Marking] init error', e);
      card.textContent = 'Could not initialise marking.';
    }
  }

  // ---- UI renderers ----
  function renderWaiting(msg) {
    card.innerHTML = '';
    const d = document.createElement('div');
    d.textContent = msg;
    card.appendChild(d);
    btn.disabled = true;
  }

  function renderMarkingUI() {
    card.innerHTML = '';

    const note = document.createElement('div');
    note.className = 'note';
    note.textContent = `Mark ${isHost ? 'Jaime' : 'Daniel'}’s answers:`;
    card.appendChild(note);

    myMarks = [null,null,null];

    oppAnswers.slice(0,3).forEach((ans, idx) => {
      const block = document.createElement('div');
      block.className = 'mt-4';

      const qlabel = document.createElement('div');
      qlabel.style.fontWeight = '700';
      qlabel.style.marginBottom = '8px';
      qlabel.textContent = `${idx + 1}. Opponent chose: ${String(ans).toUpperCase()}`;
      block.appendChild(qlabel);

      const btnCorrect = document.createElement('button');
      btnCorrect.className = 'btn btn-outline';
      btnCorrect.textContent = 'CORRECT';
      const btnWrong = document.createElement('button');
      btnWrong.className = 'btn btn-outline';
      btnWrong.textContent = 'INCORRECT';
      btnWrong.style.marginLeft = '8px';

      btnCorrect.addEventListener('click', () => choose(idx, true, btnCorrect, btnWrong));
      btnWrong.addEventListener('click', () => choose(idx, false, btnCorrect, btnWrong));

      block.appendChild(btnCorrect);
      block.appendChild(btnWrong);
      card.appendChild(block);
    });

    // Reset GO until three choices are made
    btn.disabled = true;
  }

  function choose(idx, val, a, b) {
    myMarks[idx] = val;
    if (val) {
      a.classList.add('selected');
      b.classList.remove('selected');
    } else {
      b.classList.add('selected');
      a.classList.remove('selected');
    }
    if (myMarks.every(v => v !== null)) btn.disabled = false;
  }

  // ---- When both have submitted, show result you received and advance ----
  async function maybeShowResults() {
    if (!mySubmitted || !oppSubmitted) return;

    // Read how many marks the opponent awarded to me
    const oppMarkRef = doc(collection(db,'rooms'), roomCode, 'marking', `${oppKey}_r${round}`);
    const oppSnap = await getDoc(oppMarkRef);
    const theirMarks = oppSnap.exists() ? (oppSnap.data()?.marks || []) : [];
    const correctTotal = (Array.isArray(theirMarks) ? theirMarks : []).slice(0,3)
      .reduce((n, v) => n + (v === true ? 1 : 0), 0);

    card.innerHTML = '';
    const big = document.createElement('div');
    big.style.fontSize = '22px';
    big.style.fontWeight = '800';
    big.style.marginBottom = '8px';
    big.textContent = `You were awarded ${correctTotal} / 3`;
    card.appendChild(big);

    const tiny = document.createElement('div');
    tiny.className = 'note';
    tiny.textContent = 'Next round will begin shortly…';
    card.appendChild(tiny);

    btn.disabled = true;

    // Decide next destination: rounds 1–4 → next round; round 5 → final (or Jemima quiz)
    if (round < 5) {
      set('nextHash', `#/q/${round + 1}`);
      navigate('#/countdown');
    } else {
      // End of Round 5 — jump to Final (adjust if you have a distinct Jemima quiz route)
      set('nextHash', '#/final');
      navigate('#/countdown');
    }
  }
}
