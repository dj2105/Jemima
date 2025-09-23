import { state, setRoomCode } from '../state.js';
import { generateCode, validateCodeInput } from '../lib/codeFormat.js';

export function Lobby(){
  const wrap = document.createElement('div');
  wrap.className = 'wrap';

  // restore saved role (default Daniel)
  const savedRole = localStorage.getItem('ja_role');
  state.self = savedRole === 'Jaime' ? 'Jaime' : 'Daniel';

  wrap.innerHTML = `
    <div class="h1">Jemima's Asking</div>

    <div class="panel" style="margin-bottom:1rem">
      <div class="row" style="gap:16px; align-items:center; flex-wrap:wrap">
        <strong>Select your role:</strong>
        <label class="row" style="gap:8px; align-items:center">
          <input type="radio" name="role" value="Daniel" ${state.self==='Daniel'?'checked':''}/>
          Daniel
        </label>
        <label class="row" style="gap:8px; align-items:center">
          <input type="radio" name="role" value="Jaime" ${state.self==='Jaime'?'checked':''}/>
          Jaime
        </label>
      </div>
    </div>

    <div class="grid-2">
      <section class="panel">
        <div class="badge jaime">JAIME</div>
        <h2 class="h2">Enter Code</h2>
        <input id="jaime-code" class="input code" maxlength="4" placeholder="____" />
        <div class="subtext">4 characters. A–Z or 1–9. Excludes 0 and O.</div>
        <div class="gap"></div>
        <button id="jaime-go" class="btn full jaime">Go</button>
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

  // role selection
  wrap.querySelectorAll('input[name="role"]').forEach(r => {
    r.addEventListener('change', (e) => {
      state.self = e.target.value === 'Jaime' ? 'Jaime' : 'Daniel';
      localStorage.setItem('ja_role', state.self);
    });
  });

  // normalise Jaime code input
  const codeInput = wrap.querySelector('#jaime-code');
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/[O0]/g, '')  // exclude O and 0
      .slice(0,4);
  });

  // Jaime → must enter valid code, role must be Jaime
  wrap.querySelector('#jaime-go').addEventListener('click', () => {
    if (state.self !== 'Jaime') {
      alert('Switch role to Jaime (top of screen) to join as Jaime.');
      return;
    }
    const val = codeInput.value.trim();
    if (!validateCodeInput(val)) {
      alert('Please enter a valid 4-character code (A–Z, 1–9; excludes 0 and O).');
      return;
    }
    setRoomCode(val);
    location.hash = "#generation";
  });

  // Daniel → can generate a code, then proceed to Key Room
  wrap.querySelector('#gen-code').addEventListener('click', () => {
    const code = generateCode({ exclude: ['O','0'] });
    wrap.querySelector('#code-out').textContent = code;
    setRoomCode(code);
    navigator.clipboard?.writeText(code).catch(()=>{});
  });

  wrap.querySelector('#daniel-go').addEventListener('click', () => {
    if (state.self !== 'Daniel') {
      alert('Switch role to Daniel (top of screen) to set up the game.');
      return;
    }
    location.hash = "#key";
  });

  return wrap;
}
