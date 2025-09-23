// src/components/ScoreStrip.js
import { state } from "../state.js";

export function ScoreStrip() {
  const div = document.createElement("div");
  div.className = "score-strip";
  div.innerHTML = `
    Daniel: <span id="scoreDaniel">${state.perceivedScores.Daniel || 0}</span> |
    Jaime: <span id="scoreJaime">${state.perceivedScores.Jaime || 0}</span>
  `;
  return div;
}

// Optional helper to refresh numbers if they change
export function updateScoreStrip(root) {
  const d = root.querySelector("#scoreDaniel");
  const j = root.querySelector("#scoreJaime");
  if (d) d.textContent = state.perceivedScores.Daniel || 0;
  if (j) j.textContent = state.perceivedScores.Jaime || 0;
}
