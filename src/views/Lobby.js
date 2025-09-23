// src/views/Lobby.js
import { setRoomCode, state } from '../state.js';
import { generateCode, validateCodeInput } from '../lib/codeFormat.js';
import { ensureFirebase, markJoined, subscribeRoomStatus } from '../lib/firebase.js';
import { countdownThen } from '../flow.js';

export function Lobby(){
  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = `
    <div class="h1">Jemima's Asking</div>
    <div class="grid-2">
      <section class="panel">
        <div class="badge jaime">JAIME</div>
        <h2 class="h2">Enter Code</h2>
        <input id="jaime-code" class="input code" maxlength="4" placeholder="____" />
        <div class="subtext">4 characters. A–Z or 1–9. Excludes 0 and O.</div>
        <div class="gap"></div>
        <button id="jaime-go" class="btn full jaime">Go</button>
        <div id="jaime-wait" class="p hidden">Waiting for host…</div>
      </section>

      <section class="panel">
        <div class="badge daniel">DANIEL</div>
        <h2 class="h2">Start Setup</h2>
        <p class="p">Go to the Key Room to paste your Gemini key, Firestore config, and optional JSON overrides.</p>
        <div class="gap"></div>
        <div class="row">
          <button id="gen-code" class="btn">Generate Code</button>
          <span id="code-out" class="code"></span>
        </div>
        <div class="gap"></div>
        <button id="daniel-go" class="btn full daniel">Go to Key Room</button>
      </section>
    </div>
  `;

  const codeInput = wrap.querySelector('#jaime-code');
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/[O0]/g,'')
      .slice(0,4);
  });

  wrap.querySelector('#gen-code').addEventListener('click', () => {
    const code = generateCode({ exclude: ['O','0'] });
    setRoomCode(code);
    wrap.querySelector('#code-out').textContent = code;
    navigator.clipboard?.writeText(code).catch(()=>{});
  });

  // Daniel → Key Room
  wrap.querySelector('#daniel-go').addEventListener('click', async () => {
    // Ensure we have a room code
    if (!state.room.code) {
      const code = generateCode({ exclude: ['O','0'] });
      setRoomCode(code);
      wrap.querySelector('#code-out').textContent = code;
    }
    state.self = "Daniel";
    await ensureFirebase();
    await markJoined(state.room.code, "Daniel");
    location.hash = "#key";
  });

  // Jaime → join + wait for countdown
  wrap.querySelector('#jaime-go').addEventListener('click', async () => {
    const val = codeInput.value.trim();
    if (!validateCodeInput(val)) {
      alert('Please enter a valid 4-character code (A–Z, 1–9; excludes 0 and O).');
      return;
    }
    setRoomCode(val);
    state.self = "Jaime";
    await ensureFirebase();
    await markJoined(val, "Jaime");

    const wait = wrap.querySelector('#jaime-wait');
    wait.classList.remove('hidden');

    // Subscribe to room status; when host starts countdown, follow
    const unsub = await subscribeRoomStatus(val, (s) => {
      if (s && s.phase === "countdown" && Number(s.round) === 1) {
        if (typeof unsub === "function") unsub();
        countdownThen("#round1");
      }
    });
  });

  return wrap;
}
