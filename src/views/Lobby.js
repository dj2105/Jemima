import { setRoomCode } from '../state.js';
import { generateCode, validateCodeInput } from '../lib/codeFormat.js';

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

  // Normalise input
  const codeInput = wrap.querySelector('#jaime-code');
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,4);
  });

  // Jaime join
  wrap.querySelector('#jaime-go').addEventListener('click', () => {
    const val = codeInput.value.trim();
    if (!validateCodeInput(val)) {
      alert('Please enter a valid 4-character code (A–Z, 1–9; excludes 0 and O).');
      return;
    }
    setRoomCode(val);
    location.hash = "#generation";
  });

  // Daniel setup
  wrap.querySelector('#daniel-go').addEventListener('click', () => {
    location.hash = "#key";
  });

  // Generate code
  wrap.querySelector('#gen-code').addEventListener('click', () => {
    const code = generateCode({ exclude: ['O','0'] });
    const out = wrap.querySelector('#code-out');
    out.textContent = code;
    navigator.clipboard?.writeText(code).catch(()=>{});
  });

  return wrap;
}
