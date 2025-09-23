// src/views/FinalRoom.js
import { state, computeActualScores, scoreBigQuestion } from "../state.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip } from "../components/ScoreStrip.js";

export function FinalRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  // compute final actuals (includes +3 for big question)
  computeActualScores();
  scoreBigQuestion();

  const p = state.perceivedScores;
  const a = state.actualScores;

  root.innerHTML = `
    <div class="h1">Final Scores</div>
    <div class="panel">
      <h3>Perceived (during game)</h3>
      <p>Daniel: <strong>${p.Daniel}</strong> &nbsp; | &nbsp;
         Jaime: <strong>${p.Jaime}</strong></p>
      <div class="divider"></div>
      <h3>Actual (reveal)</h3>
      <p>Daniel: <strong id="actualD">—</strong> &nbsp; | &nbsp;
         Jaime: <strong id="actualJ">—</strong></p>
    </div>
    <div class="gap"></div>
    <div class="panel">
      <h3>Big Question</h3>
      <p>Correct answer: <strong>${state.bigQuestionAnswer}</strong></p>
      <p>Daniel guessed: <strong>${state.bigQuestionGuesses.Daniel ?? "—"}</strong></p>
      <p>Jaime guessed: <strong>${state.bigQuestionGuesses.Jaime ?? "—"}</strong></p>
      <p class="subtext">Closest got +3 (tie: +3 both).</p>
    </div>
  `;

  root.insertBefore(ScoreStrip(), root.firstChild);
  root.appendChild(RoleBadge());

  // dramatic reveal (simple)
  setTimeout(() => {
    root.querySelector("#actualD").textContent = a.Daniel;
    root.querySelector("#actualJ").textContent = a.Jaime;
  }, 600);

  return root;
}
