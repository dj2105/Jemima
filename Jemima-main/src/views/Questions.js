// /src/views/Questions.js
//
// Questions — fully local until the 3rd selection.
// • Shows 3 questions (one at a time) with TWO big choice buttons (A/B are not shown).
// • Counter "n / 3" at top of card. No helper text.
// • On each click: auto-advance. On 3rd click: write answers once.
// • After write: player waits; HOST flips state → "marking" when both have submitted.
// • Jemima’s Maths box pinned below (inverted scheme).
//
// Query: ?code=ABC&round=N
//
// Firestore reads:
//   rooms/{code}                 -> meta(hostUid,guestUid), answers.*, state
//   rooms/{code}/rounds/{round}  -> hostItems/guestItems
//
// Firestore writes (on 3rd selection):
//   answers.{role}.{round} = [ { chosen }, { chosen }, { chosen } ]
//   timestamps.updatedAt
//
// Navigation:
//   - When HOST detects both answers.* present, sets state:"marking" (idempotent).
//   - Both navigate to /marking?code=...&round=N

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

const qs = () => new URLSearchParams((location.hash.split("?")[1] || ""));
const clampCode = s => String(s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,3);
const roundTier = (r) => (r<=1 ? "easy" : r===2 ? "medium" : "hard"); // 1:e, 2:m, 3..5:h

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

function shuffle2(a, b) { return Math.random() < 0.5 ? [a, b] : [b, a]; }

export default {
  async mount(container) {
    await initFirebase();
    const me = await ensureAuth();

    const code  = clampCode(qs().get("code") || "");
    const round = parseInt(qs().get("round") || "1", 10) || 1;

    // Per-view ink hue
    const hue = Math.floor(Math.random()*360);
    document.documentElement.style.setProperty("--ink-h", String(hue));

    // Skeleton
    container.innerHTML = "";
    const root = el("div", { class:"view view-questions" });
    root.appendChild(el("h1", { class:"title" }, `Round ${round}`));

    const card = el("div", { class:"card" });
    const topRow = el("div", { class:"mono", style:"display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;" });
    const roomTag = el("div", {}, `Room ${code}`);
    const counter = el("div", { class:"mono" }, "1 / 3");
    topRow.appendChild(roomTag);
    topRow.appendChild(counter);
    card.appendChild(topRow);

    const qText = el("div", { class:"mono", style:"font-weight:600; white-space:pre-wrap; min-height:56px;" }, "");
    card.appendChild(qText);

    const btnWrap = el("div", { style:"display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap;" });
    const btn1 = el("button", { class:"btn big outline" }, "");
    const btn2 = el("button", { class:"btn big outline" }, "");
    btnWrap.appendChild(btn1);
    btnWrap.appendChild(btn2);
    card.appendChild(btnWrap);

    const waitMsg = el("div", { class:"mono", style:"text-align:center;opacity:.8;margin-top:12px;display:none;" }, "Waiting for opponent…");
    card.appendChild(waitMsg);

    root.appendChild(card);

    // Maths pinned
    const mathsMount = el("div", { class:"jemima-maths-pinned" });
    root.appendChild(mathsMount);

    container.appendChild(root);

    // Firestore refs
    const rRef  = roomRef(code);
    const r1Ref = doc(roundSubColRef(code), String(round));

    // Determine role
    const roomSnap0 = await getDoc(rRef);
    const room0 = roomSnap0.data() || {};
    const { hostUid, guestUid } = room0.meta || {};
    const myRole  = (hostUid === me.uid) ? "host" : (guestUid === me.uid) ? "guest" : "guest";
    const oppRole = myRole === "host" ? "guest" : "host";

    // Mount maths pane
    try { if (mountMathsPane && room0.maths) mountMathsPane(mathsMount, { maths: room0.maths, round, mode:"inline" }); }
    catch(e){ console.warn("[questions] MathsPane mount failed:", e); }

    // Get items; choose distractor by round tier; build 3 cards in memory
    const rd = (await getDoc(r1Ref)).data() || {};
    const myItems = (myRole === "host" ? rd.hostItems : rd.guestItems) || [];

    // Early exit if already answered (refresh flow): show wait UI, no buttons
    const existingAns = (((room0.answers||{})[myRole]||{})[round] || []);
    if (existingAns.length === 3) {
      btn1.style.display = "none";
      btn2.style.display = "none";
      counter.textContent = "3 / 3";
      const i0 = 2;
      const q0 = myItems[i0]?.question || "(already submitted)";
      qText.textContent = q0;
      waitMsg.style.display = "";
    }

    // Prepare runtime choices for 3 questions
    const tier = roundTier(round);
    const triplet = [0,1,2].map(i => {
      const it = myItems[i] || {};
      const correct = it.correct_answer || "";
      const distractors = (it.distractors || {});
      const wrong = distractors[tier] || distractors.medium || distractors.easy || distractors.hard || "";
      const [optA, optB] = shuffle2(correct, wrong);
      return { question: (it.question || ""), options: [optA, optB], correct };
    });

    let idx = 0;
    const chosen = []; // strings

    function renderIndex() {
      counter.textContent = `${Math.min(idx+1,3)} / 3`;
      const cur = triplet[idx];
      qText.textContent = cur?.question || "";
      btn1.textContent = cur?.options?.[0] || "";
      btn2.textContent = cur?.options?.[1] || "";
    }

    async function publishAnswers() {
      try {
        await updateDoc(rRef, {
          [`answers.${myRole}.${round}`]: chosen.slice(0,3).map(v => ({ chosen: v })),
          "timestamps.updatedAt": serverTimestamp()
        });
        // Switch to waiting
        btn1.style.display = "none";
        btn2.style.display = "none";
        waitMsg.style.display = "";
      } catch (e) {
        console.warn("[questions] publish failed:", e);
        // allow a retry attempt (user could click again on hidden buttons? keep minimal—do nothing)
      }
    }

    function onPick(text) {
      chosen[idx] = text;
      idx += 1;
      if (idx >= 3) {
        counter.textContent = "3 / 3";
        publishAnswers();
      } else {
        renderIndex();
      }
    }

    btn1.addEventListener("click", () => onPick(btn1.textContent));
    btn2.addEventListener("click", () => onPick(btn2.textContent));

    if (existingAns.length !== 3) {
      renderIndex();
    }

    // Watch room: HOST flips to marking once both are in
    const stop = onSnapshot(rRef, async (s) => {
      const d = s.data() || {};
      // Navigate if state already flipped (e.g., host moved us)
      if (d.state === "marking") {
        setTimeout(() => { location.hash = `#/marking?code=${code}&round=${round}`; }, 80);
        return;
      }

      if (myRole === "host") {
        const myDone  = Array.isArray(((d.answers||{})[myRole]  || {})[round]) && (((d.answers||{})[myRole]  || {})[round]).length === 3;
        const oppDone = Array.isArray(((d.answers||{})[oppRole] || {})[round]) && (((d.answers||{})[oppRole] || {})[round]).length === 3;
        if (myDone && oppDone && d.state !== "marking") {
          try {
            await updateDoc(rRef, { state:"marking", "timestamps.updatedAt": serverTimestamp() });
          } catch {}
        }
      }
    });

    // Unmount
    this.unmount = () => { try { stop(); } catch {} };
  },

  async unmount(){ /* no-op */ }
};