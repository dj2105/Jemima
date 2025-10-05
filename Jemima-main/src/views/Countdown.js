// /src/views/Award.js
//
// Award view — shows *your* three answers for the round with ✓/✕ truth indicators.
// • 30s bold timer (top-right of card). On 0s, host advances automatically.
// • Displays each question, your chosen answer (bold), and a ✓ (correct) or ✕ (incorrect).
// • No totals shown here; the persistent ScoreStrip handles running scores.
// • Flow after timeout:
//     - Rounds 1–4: host sets room.round = round+1, arms a 3s auto countdown, state:"countdown".
//     - Round 5: host sets state:"maths" (no countdown), strip remains visible.
//
// Inputs: ?code=ABC&round=N
//
// Firestore reads:
//   rooms/{code}  -> meta(hostUid,guestUid), answers, state, round, maths (for strip consistency)
//   rooms/{code}/rounds/{round} -> hostItems/guestItems (to compute truth)
//
// Writes (host only on timeout or if both clients already arrived here):
//   - Rounds <5:  countdown.startAt = now + 3000, state:"countdown", round: round+1
//   - Round ==5:  state:"maths"
//
// Visual: Courier, minimal card, timer badge, maths pane pinned below (same as other views)

import {
  initFirebase, ensureAuth,
  roomRef, roundSubColRef, doc,
  getDoc, updateDoc, onSnapshot, serverTimestamp
} from "../lib/firebase.js";

import * as MathsPaneMod from "../lib/MathsPane.js";
const mountMathsPane =
  (typeof MathsPaneMod?.default === "function" ? MathsPaneMod.default :
   typeof MathsPaneMod?.mount === "function" ? MathsPaneMod.mount :
   typeof MathsPaneMod?.default?.mount === "function" ? MathsPaneMod.default.mount :
   null);

const clampCode = s => String(s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,3);
const hp = () => new URLSearchParams((location.hash.split("?")[1]||""));

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c =>
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return n;
}

const AWARD_WINDOW_MS = 30_000;

function same(a,b){ return String(a||"").trim() === String(b||"").trim(); }

export default {
  async mount(container){
    await initFirebase();
    const me = await ensureAuth();

    const qs = hp();
    const code  = clampCode(qs.get("code") || "");
    const round = parseInt(qs.get("round") || "1", 10) || 1;

    // per-view ink hue
    const hue = Math.floor(Math.random()*360);
    document.documentElement.style.setProperty("--ink-h", String(hue));

    // Skeleton
    container.innerHTML = "";
    const root = el("div", { class:"view view-award" });
    root.appendChild(el("h1", { class:"title" }, `Round ${round}`));

    const card = el("div", { class:"card" });
    const timerBadge = el("div", { class:"timer-badge mono" }, "30");
    card.appendChild(timerBadge);

    const tag = el("div", { class:"mono", style:"text-align:center;margin-bottom:8px;" }, `Room ${code}`);
    card.appendChild(tag);

    const list = el("div", { class:"qa-list" });
    card.appendChild(list);

    container.appendChild(root);
    root.appendChild(card);

    // Maths pinned (for consistency across views)
    const mathsMount = el("div", { class:"jemima-maths-pinned" });
    root.appendChild(mathsMount);

    // Refs
    const rRef  = roomRef(code);
    const r1Ref = doc(roundSubColRef(code), String(round));

    // Room + role
    const roomSnap = await getDoc(rRef);
    const roomData0 = roomSnap.data() || {};
    const { hostUid, guestUid } = roomData0.meta || {};
    const myRole  = (hostUid === me.uid) ? "host" : (guestUid === me.uid) ? "guest" : "guest";
    const oppRole = myRole === "host" ? "guest" : "host";

    try { if (mountMathsPane && roomData0.maths) mountMathsPane(mathsMount, { maths: roomData0.maths, round, mode:"inline" }); }
    catch(e){ console.warn("[award] MathsPane mount failed:", e); }

    // Round data + my answers
    const rd = (await getDoc(r1Ref)).data() || {};
    const myItems = (myRole === "host" ? rd.hostItems : rd.guestItems) || [];
    const myAns   = (((roomData0.answers||{})[myRole]||{})[round]||[]).map(a => a?.chosen || "");

    // Build list with ✓/✕ truth
    list.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const q = myItems[i]?.question || "(missing question)";
      const chosen = myAns[i] || "(no answer)";
      const correct = myItems[i]?.correct_answer || "";
      const truth = correct && same(chosen, correct);

      const row = el("div", { class:"mark-row" });
      const qEl = el("div", { class:"q mono" }, `${i+1}. ${q}`);
      const aEl = el("div", { class:"a mono" }, chosen);

      // truth badge inline at end of answer line
      const badge = el("span", {
        class: "mono",
        style: `margin-left:8px; font-weight:700; ${truth ? "color:var(--ok);" : "color:var(--bad);"}`
      }, truth ? "✓" : "✕");
      aEl.appendChild(badge);

      // If wrong, also show the correct answer beneath (subtle)
      if (!truth && correct) {
        const corr = el("div", { class:"mono small", style:"margin-top:4px;opacity:.8" }, `Correct: ${correct}`);
        row.appendChild(qEl); row.appendChild(aEl); row.appendChild(corr);
      } else {
        row.appendChild(qEl); row.appendChild(aEl);
      }
      list.appendChild(row);
    }

    // Watch room to follow state changes
    const stop = onSnapshot(rRef, s => {
      const d = s.data() || {};
      if (d.state === "countdown") {
        const nextRound = Number(d.round || round + 1);
        setTimeout(()=> location.hash = `#/countdown?code=${code}&round=${nextRound}`, 100);
      } else if (d.state === "maths") {
        setTimeout(()=> location.hash = `#/maths?code=${code}`, 100);
      }
    });

    // Timer (30s). Host drives next phase.
    const startAt = Date.now();
    const tick = setInterval(async () => {
      const remain = Math.max(0, (startAt + AWARD_WINDOW_MS) - Date.now());
      const sec = Math.ceil(remain / 1000);
      timerBadge.textContent = String(sec);

      if (remain <= 0) {
        clearInterval(tick);

        if (myRole === "host") {
          try {
            if (round >= 5) {
              // Final award -> maths
              await updateDoc(rRef, {
                state: "maths",
                "timestamps.updatedAt": serverTimestamp()
              });
            } else {
              // Arm a 3s automatic countdown for next round
              const nextRound = round + 1;
              const startTs = Date.now() + 3000;
              await updateDoc(rRef, {
                state: "countdown",
                round: nextRound,
                countdown: { startAt: startTs },
                "timestamps.updatedAt": serverTimestamp()
              });
            }
          } catch (e) {
            console.warn("[award] host flip failed:", e);
          }
        }
      }
    }, 200);

    this.unmount = () => { try { stop(); } catch{} try { clearInterval(tick); } catch{} };
  },

  async unmount(){ /* no-op */ }
};