import { state } from "./state.js";

// New explicit helpers
export function advanceToMarking() {
  state.phase = "marking";
  location.hash = `#marking${state.currentRound}`;
}

export function advanceToNextRoundOrFinal() {
  if ((state.currentRound || 1) < 5) {
    state.currentRound += 1;
    state.phase = "question";
    location.hash = `#round${state.currentRound}`;
  } else {
    state.phase = "final";
    location.hash = "#final";
  }
}

// Back-compat wrapper (if anything still calls advanceFlow)
export function advanceFlow() {
  const phase = state.phase || "question";
  if (phase === "question") return advanceToMarking();
  if (phase === "marking")  return advanceToNextRoundOrFinal();
}
