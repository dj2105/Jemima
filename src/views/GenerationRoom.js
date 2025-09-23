import { state, setRoundQuestions } from "../state.js"; import { ensureFirebase, setRoomStatus } from "../lib/firebase.js";
export function GenerationRoom(){
  const root=document.createElement("div"); root.className="center-abs"; root.innerHTML=`<div><div class="h1">Loading…</div><div class="progress"><div class="bar" id="bar"></div></div><div id="meta" class="p">Preparing questions…</div></div>`;
  if (state.self==="Daniel"){
    const make=(r)=>(i)=>({id:`r${r}q${i+1}`,question:`Round ${r} — Question ${i+1}`,options:["Very long example option A that may wrap elegantly","Very long example option B that may wrap elegantly"],correctIndex:i%2});
    const all=[1,2,3,4,5].map(r=>Array.from({length:3},(_,i)=>make(r)(i))); [1,2,3,4,5].forEach((r,idx)=>setRoundQuestions(r,all[idx]));
  }
  const bar=root.querySelector("#bar"); let p=0; const t=setInterval(()=>{ p=Math.min(100, p + (Math.random()*20)); bar.style.width=p.toFixed(0)+"%"; if(p>=100){ clearInterval(t); ensureFirebase().then(()=> setRoomStatus(state.room.code,{phase:"countdown",round:1})); location.hash="#round1"; } },450);
  return root;
}