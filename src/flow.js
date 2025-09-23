import { state } from "./state.js";

export function advanceFlow() {
  const r = state.currentRound || 1;
  const phase = state.phase || "question";

  if (phase === "question") {
    state.phase = "marking";
    location.hash = `#marking${r}`;
    return;
  }

  if (phase === "marking") {
    if (r < 5) {
      state.currentRound = r + 1;
      state.phase = "question";
      location.hash = `#round${state.currentRound}`;
    } else {
      state.phase = "final";
      location.hash = "#final";
    }
    return;
  }
}
