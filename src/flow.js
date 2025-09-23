// src/flow.js
import { state } from "./state.js";

export function countdownThen(hashTarget) {
  // simple in-place countdown overlay for 3 → 2 → 1
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  const h = document.createElement("h2");
  h.className = "countdown";
  overlay.appendChild(h);
  document.body.appendChild(overlay);

  let n = 3;
  h.textContent = n;
  const t = setInterval(() => {
    n -= 1;
    if (n <= 0) {
      clearInterval(t);
      document.body.removeChild(overlay);
      location.hash = hashTarget;
    } else {
      h.textContent = n;
    }
  }, 1000);
}

export function advanceToMarking() {
  state.phase = "marking";
  location.hash = `#marking${state.currentRound}`;
}

export function advanceToInterludeOrNextRound() {
  const r = state.currentRound;
  if (r <= 4) {
    // after marking round r, go to interlude r+1
    state.phase = "interlude";
    location.hash = `#interlude${r+1}`;
  } else {
    // after marking round 5 → final (but show big question input before this in QuestionRoom/FinalRoom)
    state.phase = "final";
    location.hash = "#final";
  }
}

export function advanceToNextRoundFromInterlude() {
  // starts the next round with a 3–2–1 countdown
  const next = state.currentRound + 1;
  state.currentRound = next;
  state.phase = "question";
  countdownThen(`#round${next}`);
}
