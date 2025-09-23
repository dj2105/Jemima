// src/components/ScoreStrip.js
import { state } from "../state.js";

export function ScoreStrip() {
  const div = document.createElement("div");
  div.className = "score-strip";

  const d = document.createElement("span");
  d.id = "scoreDaniel";
  d.textContent = state.perceivedScores?.Daniel || 0;

  const j = document.createElement("span");
  j.id = "scoreJaime";
  j.textContent = state.perceivedScores?.Jaime || 0;

  div.innerHTML = `Daniel: `;
  div.appendChild(d);
  div.append(" | Jaime: ");
  div.appendChild(j);

  return div;
}

export function updateScoreStrip(root) {
  const d = root.querySelector("#scoreDaniel");
  const j = root.querySelector("#scoreJaime");
  if (d) d.textContent = state.perceivedScores?.Daniel || 0;
  if (j) j.textContent = state.perceivedScores?.Jaime || 0;
}
