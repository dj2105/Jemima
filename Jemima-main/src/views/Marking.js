// /src/views/Marking.js
//
// Marking view — timed, two-button verdicts (✓ / ✕), auto-submits at 30s.
// Scoring model implemented upstream (ScoreStrip): marker gets +1 if verdict matches truth,
// -1 if wrong, 0 if unmarked (treated here as "unknown").
//
// Behaviour:
// • Shows opponent’s 3 questions and ONLY the opponent’s chosen answer (bold).
// • Two centred buttons per item: ✓ (“right”), ✕ (“wrong”).
// • 30s BIG timer badge (top-right of the card). Clock is anchored to room.marking.startAt.
//   - If missing, host sets it on mount. Everyone counts down from there.
//   - When 0s: any unselected are auto-filled as "unknown"; we write marking & ack.
// • Submit early if all 3 are decided; otherwise auto-submit on 0s.
// • Host flips state → "award" when (a) both acks exist OR (b) global timer reached 0s.
//
// Data written:
//   marking.{role}.{round} = ["right"|"wrong"|"unknown", x3]
//   markingAck.{role}.{round} = true
//
// Navigation:
//   • On host flip to "award", both clients route to /award?code=...&round=...
//
// Visuals: Courier font, centred verdict pair, timer badge at top-right, maths pane pinned.

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

const VERDICT = { RIGHT: "right", WRONG: "wrong", UNKNOWN: "unknown" };
const MARKING_WINDOW_MS = 30_000;

export default {
  async mount(container){
    await initFirebase();
    const me = await ensureAuth();

    const code  = clampCode(hp().get("code") || "");
    const round = parseInt(hp().get("round") || "1", 10) || 1;

    // Per-view ink hue
    const hue = Math.floor(Math.random()*360);
    document.documentElement.style.setProperty("--ink-h", String(hue));

    // Structure
    container.innerHTML = "";
    const root = el("div", { class:"view view-marking" });
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

    // Maths pinned
    const mathsMount = el("div", { class:"jemima-maths-pinned" });
    root.appendChild(mathsMount);

    const rRef  = roomRef(code);
    const r1Ref = doc(roundSubColRef(code), String(round));

    // Resolve role and opponent
    const roomSnap = await getDoc(rRef);
    const roomData0 = roomSnap.data() || {};
    const { hostUid, guestUid } = roomData0.meta || {};
    const myRole  = (hostUid === me.uid) ? "host" : (guestUid === me.uid) ? "guest" : "guest";
    const oppRole = myRole === "host" ? "guest" : "host";

    // Mount maths if present
    try { if (mountMathsPane && roomData0.maths) mountMathsPane(mathsMount, { maths: roomData0.maths, round, mode:"inline" }); }
    catch(e){ console.warn("[marking] MathsPane mount failed:", e); }

    // Load round data & opponent answers
    const rd = (await getDoc(r1Ref)).data() || {};
    const oppItems   = (oppRole === "host" ? rd.hostItems : rd.guestItems) || [];
    const oppAnswers = (((roomData0.answers||{})[oppRole]||{})[round]||[]).map(a => a?.chosen || "");

    // Local state
    let marks = [null, null, null]; // "right" | "wrong" | "unknown"
    let published = false;
    let stopRoomWatch = null;
    let tickHandle = null;
    let markingStartAt = Number((roomData0.marking && roomData0.marking.startAt) || 0);

    // Host ensures marking.startAt
    if (!markingStartAt && myRole === "host") {
      try {
        markingStartAt = Date.now();
        await updateDoc(rRef, { "marking.startAt": markingStartAt, "timestamps.updatedAt": serverTimestamp(), state: "marking" });
      } catch (e) { /* non-fatal; guest may pick up later */ }
    }

    // Render a single row
    function renderRow(i, qText, chosen){
      const row = el("div", { class:"mark-row" });

      const q = el("div", { class:"q mono" }, `${i+1}. ${qText || "(missing question)"}`);
      const a = el("div", { class:"a mono" }, chosen || "(no answer recorded)");
      row.appendChild(q);
      row.appendChild(a);

      const pair = el("div", { class:"verdict-row" });
      const bTick  = el("button", { class:"btn outline choice-tick" }, "✓");
      const bCross = el("button", { class:"btn outline choice-cross" }, "✕");

      const updateStyles = () => {
        bTick.classList.toggle("active",  marks[i] === VERDICT.RIGHT);
        bCross.classList.toggle("active", marks[i] === VERDICT.WRONG);
      };

      bTick.addEventListener("click",  () => { marks[i] = VERDICT.RIGHT;  updateStyles(); maybeSubmitIfComplete(); });
      bCross.addEventListener("click", () => { marks[i] = VERDICT.WRONG;  updateStyles(); maybeSubmitIfComplete(); });

      pair.appendChild(bTick);
      pair.appendChild(bCross);
      row.appendChild(pair);
      return row;
    }

    // Build list
    list.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const q = oppItems[i]?.question || "";
      const chosen = oppAnswers[i] || "";
      list.appendChild(renderRow(i, q, chosen));
    }

    // Submit logic
    const publish = async () => {
      if (published) return;
      published = true;

      // Fill any still-null with "unknown"
      marks = marks.map(v => (v === VERDICT.RIGHT || v === VERDICT.WRONG) ? v : VERDICT.UNKNOWN);

      const patch = {};
      patch[`marking.${myRole}.${round}`]    = marks.slice();
      patch[`markingAck.${myRole}.${round}`] = true;
      patch["timestamps.updatedAt"] = serverTimestamp();

      try {
        await updateDoc(rRef, patch);
      } catch (e) {
        console.warn("[marking] publish failed:", e);
        published = false; // allow retry by timer or further user action
      }
    };

    function maybeSubmitIfComplete(){
      if (!marks.includes(null)) publish(); // all 3 decided -> publish immediately
    }

    // Room watcher: flip to award on both acks OR when global timer hits 0
    stopRoomWatch = onSnapshot(rRef, async s => {
      const d = s.data() || {};
      // (Re-)fetch startAt if it arrives late
      if (!markingStartAt && d.marking?.startAt) {
        markingStartAt = Number(d.marking.startAt);
      }

      // if state has already changed, follow it
      if (d.state === "award") {
        setTimeout(()=> location.hash = `#/award?code=${code}&round=${round}`, 80);
        return;
      }

      // Host-only: manage transition
      if (myRole === "host") {
        const myAck  = !!(((d.markingAck||{})[myRole]  || {})[round]);
        const oppAck = !!(((d.markingAck||{})[oppRole] || {})[round]);

        // Compute if timer elapsed (guard if startAt unknown)
        const now = Date.now();
        const elapsed = (markingStartAt && (now - markingStartAt >= MARKING_WINDOW_MS));

        if ((myAck && oppAck) || elapsed) {
          try {
            await updateDoc(rRef, { state: "award", "timestamps.updatedAt": serverTimestamp() });
          } catch (e) { /* harmless retry on next tick */ }
        }
      }
    });

    // Timer tick (visual + auto-submit at 0)
    tickHandle = setInterval(async () => {
      const now = Date.now();
      let remainMs;

      if (!markingStartAt) {
        // No anchor yet — display waiting tick
        timerBadge.textContent = "—";
        return;
      }

      remainMs = Math.max(0, (markingStartAt + MARKING_WINDOW_MS) - now);
      const sec = Math.ceil(remainMs / 1000);
      timerBadge.textContent = String(sec);

      if (remainMs <= 0) {
        clearInterval(tickHandle); tickHandle = null;
        // Auto-publish if we haven't
        await publish();
        // Host will flip to award via snapshot watcher; guests will follow
      }
    }, 200);

    // Unmount
    this.unmount = () => {
      try { stopRoomWatch && stopRoomWatch(); } catch {}
      if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
    };
  },

  async unmount(){ /* router may call instance.unmount */ }