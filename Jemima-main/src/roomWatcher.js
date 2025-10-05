// /src/roomWatcher.js
// Central watcher that maps room.state -> route safely.
// - Debounces transient/undefined states (no spurious hops to Lobby)
// - Only navigates when target route actually changes
// - Understands all phases: seeding, countdown, questions, marking, interlude, award, final
// - Works as a "view" at #/watcher?code=XYZ OR as a helper you can call from other views

import {
  initFirebase, ensureAuth, roomRef, onSnapshot,
} from "./lib/firebase.js";

// --- tiny DOM helper for the standalone #/watcher view ---
function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach(c =>
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return n;
}

const clampCode = s => String(s||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,3);
function getHashParams(){
  const raw = window.location.hash || "";
  return new URLSearchParams(raw.split("?")[1] || "");
}
function getQueryCode(){ return clampCode(getHashParams().get("code") || ""); }
function pathFor(state, code, round){
  const r = round || 1;
  switch (String(state||"").toLowerCase()) {
    case "seeding":    return `#/seeding?code=${code}`;
    case "countdown":  return `#/countdown?code=${code}&round=${r}`;
    case "questions":  return `#/questions?code=${code}&round=${r}`;
    case "marking":    return `#/marking?code=${code}&round=${r}`;
    case "interlude":  return `#/interlude?code=${code}&round=${r}`;
    case "award":      return `#/award?code=${code}&round=${r}`;
    case "final":      return `#/final?code=${code}`;
    case "lobby":      return `#/lobby`;
    default:           return null; // unknown/transition → hold
  }
}

// Avoid routing loops
function sameRoute(a, b){ return String(a||"") === String(b||""); }

// Public API if you want to start watching from any view
export function startRoomWatcher(code, { onState } = {}) {
  const c = clampCode(code);
  let unknownSince = 0;
  let lastPushed = null;

  const stop = onSnapshot(roomRef(c), (snap) => {
    const d = snap.data() || {};
    const state = d.state;
    const round = d.round || 1;

    if (typeof onState === "function") {
      try { onState({ state, round, room: d }); } catch {}
    }

    const target = pathFor(state, c, round);

    if (target) {
      unknownSince = 0;
      // Only navigate if different from current hash
      if (!sameRoute(target, window.location.hash)) {
        // Prevent flapping between same targets
        if (lastPushed !== target) {
          lastPushed = target;
          // console.debug("[watcher] →", target, "| state:", state, "round:", round);
          window.location.hash = target;
        }
      }
      return;
    }

    // Unknown/transitionary state: wait a bit before sending to lobby
    if (!unknownSince) unknownSince = Date.now();
    const elapsed = Date.now() - unknownSince;

    // If the room is genuinely empty/missing state for >1.5s, send to lobby
    if (elapsed > 1500) {
      const safe = "#/lobby";
      if (!sameRoute(safe, window.location.hash)) {
        lastPushed = safe;
        window.location.hash = safe;
      }
    }
  }, (err) => {
    console.warn("[watcher] snapshot error:", err?.message || err);
  });

  return () => { try { stop(); } catch {} };
}

// --- Default export as a minimal "view" for #/watcher?code=XYZ ---
export default {
  async mount(container){
    await initFirebase();
    await ensureAuth();

    const code = getQueryCode();
    container.innerHTML = "";
    const card = el("div", { class: "card" }, [
      el("h1", { class: "title" }, "Loading…"),
      el("div", { class: "mono" }, `Room ${code}`),
      el("div", { class: "mono", id: "wstatus" }, "Waiting for room state…")
    ]);
    container.appendChild(card);

    const statusEl = card.querySelector("#wstatus");
    this._stop = startRoomWatcher(code, {
      onState: ({ state, round }) => {
        statusEl.textContent = state
          ? `State: ${state} • Round ${round || 1}`
          : "Waiting for room state…";
      }
    });
  },
  async unmount(){
    if (this._stop) this._stop();
  }
};
