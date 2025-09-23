// src/flow.js
import { state } from "./state.js";

/** Move from Question → Marking for the current round */
export function advanceToMarking() {
  state.phase = "marking";
  location.hash = `#marking${state.currentRound}`;
}

/**
 * After MARKING:
 * - Rounds 1..4 → go to Interlude for the *next* round (2..5)
 * - Round 5      → go to Final
 */
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

/** Called by Interlude “Continue” to start the next round’s questions */
export function advanceFromInterludeToRound(round) {
  state.currentRound = round;
  state.phase = "question";
  location.hash = `#round${round}`;
}
