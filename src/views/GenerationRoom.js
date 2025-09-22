import { loadLocal } from '../lib/localStore.js';
import { getCodeConfig, generateCode } from '../lib/codeFormat.js';

export function GenerationRoom(){
  const saved = loadLocal('keyroom') || {};
  const codeConf = getCodeConfig(saved.codeFormatJSON);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  const initCode = generateCode(codeConf);

  wrap.innerHTML = `
    <div class="h1">Generation Room</div>
    <div class="panel">
      <div class="h2">Generation Progress</div>
      <div class="counter">
        <div class="chip">Generated <strong id="gen">0</strong></div>
        <div class="chip">Verified <strong id="ver">0</strong></div>
        <div class="chip">Rejected <strong id="rej">0</strong></div>
      </div>
      <p class="p">Gemini pipeline attaches in PR #2. This screen is wired to show live counters and rejections by reason.</p>

      <div class="divider"></div>

      <div class="h2">Join Code</div>
      <div class="row" style="align-items:center; gap:12px">
        <span id="code" class="code" style="font-size:24px; font-weight:800">${initCode}</span>
        <button id="regen" class="copy">Regenerate</button>
        <button id="copy" class="copy">Copy</button>
      </div>
      <div class="subtext">Format from Key Room’s Code-format JSON. Default is alnum4 excluding O,0.</div>

      <div class="divider"></div>

      <div class="row" style="justify-content:flex-end; gap:12px">
        <button id="mock-join" class="btn jaime">Simulate Jaime Joined</button>
      </div>

      <div id="countdown" class="countdown" style="display:none">3</div>
    </div>
  `;

  const elCode = wrap.querySelector('#code');
  wrap.querySelector('#regen').addEventListener('click', () => {
    elCode.textContent = generateCode(codeConf);
  });

  wrap.querySelector('#copy').addEventListener('click', async () => {
    await navigator.clipboard?.writeText(elCode.textContent);
  });

  wrap.querySelector('#mock-join').addEventListener('click', () => {
    // PR #2 will listen for Jaime joining via Firestore; here we simulate the sync & run a 3s countdown.
    const cd = wrap.querySelector('#countdown');
    cd.style.display = 'block';
    let t = 3;
    cd.textContent = String(t);
    const iv = setInterval(() => {
      t--;
      cd.textContent = String(t);
      if (t <= 0){
        clearInterval(iv);
        // Next: navigate to Round 1 question room in PR #3
        alert('Round 1 starting (stub).');
      }
    }, 1000);
  });

  return wrap;
}