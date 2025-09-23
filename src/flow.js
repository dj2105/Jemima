// src/flow.js
import { state } from "./state.js";

/** 3→2→1 overlay, then navigate to the target hash */
export function countdownThen(hashTarget) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const h = document.createElement("h2");
  h.className = "countdown";
  overlay.appendChild(h);
  document.body.appendChild(overlay);

  let n = 3;
  h.textContent = String(n);
  const t = setInterval(() => {
    n -= 1;
    if (n <= 0) {
      clearInterval(t);
      document.body.removeChild(overlay);
      location.hash = hashTarget;
    } else {
      h.textContent = String(n);
    }
  }, 1000);
}

/** Move Question → Marking for the current round */
export function advanceToMarking() {
  state.phase = "marking";
  location.hash = `#marking${state.currentRound}`;
}

/** After Marking:
 *  - R1..R4 → Interlude (next round number)
 *  - R5     → Final
 */
export function advanceToNextRoundOrFinal() {
  const r = state.currentRound || 1;
  if (r < 5) {
    state.phase = "interlude";
    location.hash = `#interlude${r + 1}`;
  } else {
    state.phase = "final";
    location.hash = "#final";
  }
}

/** From an interlude, continue into its round (with questions) */
export function advanceFromInterludeToRound(round) {
  state.currentRound = round;
  state.phase = "question";
  location.hash = `#round${round}`;
}
