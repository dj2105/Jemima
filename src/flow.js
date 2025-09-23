// src/flow.js
import { state } from "./state.js";

export function advanceToMarking() {
  state.phase = "marking";
  location.hash = `#marking${state.currentRound}`;
}

// Between rounds 1..4 we go to Interlude (n+1). After marking 5 → final.
export function advanceToNextRoundOrFinal() {
  const r = state.currentRound || 1;
  if (r < 5) {
    const next = r + 1;
    state.phase = "interlude";
    location.hash = `#interlude${next}`;
  } else {
    state.phase = "final";
    location.hash = "#final";
  }
}

// Called by Interlude “Continue”
export function advanceFromInterludeToRound(round) {
  state.currentRound = round;
  state.phase = "question";
  location.hash = `#round${round}`;
}
