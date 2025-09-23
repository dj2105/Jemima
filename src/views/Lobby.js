import { setRoomCode, state } from '../state.js';
import { generateCode, validateCodeInput } from '../lib/codeFormat.js';
import { ensureFirebase, subscribeRoomStatus } from '../lib/firebase.js';
export function Lobby(){
  const wrap=document.createElement('div'); wrap.className='wrap'; wrap.innerHTML=`
    <div class="h1">Lobby</div>
    <div class="grid-2">
      <section class="panel">
        <div class="badge jaime">JAIME</div>
        <div class="row" style="gap:8px; margin-top:10px">
          <input id="code" class="input" maxlength="4" placeholder="CODE" />
          <button id="join" class="btn primary right">GO</button>
        </div>
        <div id="wait" class="p hidden">Waiting for host…</div>
      </section>
      <section class="panel">
        <div class="badge daniel">DANIEL</div>
        <div class="row" style="gap:8px; margin-top:10px">
          <button id="host" class="btn right">GO</button>
        </div>
      </section>
    </div>`;
  const code=wrap.querySelector('#code'); code.addEventListener('input',(e)=>{ e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/[O0]/g,'').slice(0,4); });
  wrap.querySelector("#host").addEventListener("click",()=>{ state.self="Daniel"; location.hash="#key"; });
  wrap.querySelector("#join").addEventListener("click",async()=>{
    const val=code.value.trim(); if(!validateCodeInput(val)){ alert("Enter a valid 4-char code"); return; }
    state.self="Jaime"; setRoomCode(val); await ensureFirebase(); const wait=wrap.querySelector("#wait"); wait.classList.remove("hidden");
    subscribeRoomStatus(val,(s)=>{ if(s.phase==="loading"&&s.round===1){ location.hash="#generation"; } if(s.phase==="countdown"&&s.round===1){ location.hash="#round1"; } });
  });
  return wrap;
}