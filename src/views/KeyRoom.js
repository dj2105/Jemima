import { state, setRoomCode } from "../state.js"; import { generateCode } from "../lib/codeFormat.js"; import { ensureFirebase, setRoomStatus } from "../lib/firebase.js";
export function KeyRoom(){
  const root=document.createElement("div"); root.className="center-abs"; root.innerHTML=`
    <div><div class="h1">Host Setup</div><div class="row" style="justify-content:flex-end"><button id="start" class="btn primary right">GO</button></div></div>`;
  root.querySelector("#start").addEventListener("click", async ()=>{
    const code=generateCode({exclude:["O","0"]}); setRoomCode(code); await ensureFirebase(); await setRoomStatus(code,{phase:"loading",round:1});
    const box=document.createElement("div"); box.className="center-abs"; box.innerHTML=`<div><div class="code-big">${code}</div><div class="row" style="justify-content:center;margin-top:10px"><button id="copy" class="btn inline">COPY</button></div></div>`;
    document.body.innerHTML=""; document.body.appendChild(box); box.querySelector("#copy").addEventListener("click",async()=>{ try{ await navigator.clipboard.writeText(code);}catch{} });
    setTimeout(()=>{ location.hash="#generation"; },800);
  }); return root;
}