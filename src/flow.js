// src/flow.js
import { state } from "./state.js";

export function advanceToMarking() {
  state.phase = "marking";
  location.hash = `#marking${state.currentRound}`;
}

export function advanceToNextRoundOrFinal() {
  const r = state.currentRound || 1;
  if (r < 5) { state.phase = "interlude"; location.hash = `#interlude${r + 1}`; }
  else { state.phase = "final"; location.hash = "#final"; }
}

export function advanceFromInterludeToRound(round) {
  state.currentRound = round;
  state.phase = "question";
  location.hash = `#round${round}`;
}
