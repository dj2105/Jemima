// src/views/FinalRoom.js
import { state } from "../state.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip } from "../components/ScoreStrip.js";

export function FinalRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  // Compute actual totals from stored answers vs correctIndex
  const actual = computeActualFromState();
  const perceived = state.perceivedScores || { Daniel: 0, Jaime: 0 };

  root.innerHTML = `
    <div class="h1">Final Scores</div>

    <div class="panel">
      <div class="p">Perceived (based on marking):</div>
      <div class="row" style="gap:16px; margin-top:10px">
        <div class="badge daniel">Daniel</div>
        <div class="h2" id="percD">${perceived.Daniel || 0}</div>
        <div class="badge jaime">Jaime</div>
        <div class="h2" id="percJ">${perceived.Jaime || 0}</div>
      </div>

      <div class="divider"></div>

      <div class="p">Actual (from picked answers):</div>
      <div class="row" style="gap:16px; margin-top:10px">
        <div class="badge daniel">Daniel</div>
        <div class="h2" id="actD">?</div>
        <div class="badge jaime">Jaime</div>
        <div class="h2" id="actJ">?</div>
      </div>

      <div class="gap"></div>
      <button id="reveal" class="btn full">Reveal actual scores</button>
    </div>

    <div class="gap"></div>
    <div class="panel">
      <div class="h2">Big Question Result</div>
      <div class="p">Closest numeric guess gets +3. Tie: both +3.</div>
      <div class="row" style="gap:16px; margin-top:10px">
        <div class="badge daniel">Daniel</div>
        <div class="h2">${prettyGuess(state.bigQuestionGuess?.Daniel)}</div>
        <div class="badge jaime">Jaime</div>
        <div class="h2">${prettyGuess(state.bigQuestionGuess?.Jaime)}</div>
      </div>
      <div class="p" id="bigOutcome">${bigOutcomeText()}</div>
    </div>
  `;

  // Chrome
  root.insertBefore(ScoreStrip(), root.firstChild);
  root.appendChild(RoleBadge());

  // Dramatic number flip
  root.querySelector("#reveal").addEventListener("click", () => {
    flipNumber(root.querySelector("#actD"), actual.Daniel, 600);
    flipNumber(root.querySelector("#actJ"), actual.Jaime, 600);
  });

  return root;
}

function computeActualFromState() {
  const rounds = [1,2,3,4,5];
  let d = 0, j = 0;
  for (const r of rounds) {
    const qs = state[`round${r}Questions`] || [];
    for (const q of qs) {
      if (typeof q.correctIndex !== "number") continue;
      if (state.answers.Daniel[q.id] === q.correctIndex) d += 1;
      if (state.answers.Jaime[q.id]  === q.correctIndex) j += 1;
    }
  }
  // Include +3 for Big Question if answer present and both guessed
  if (Number.isFinite(state.bigQuestionAnswer)) {
    const ans = state.bigQuestionAnswer;
    const dGuess = state.bigQuestionGuess?.Daniel;
    const jGuess = state.bigQuestionGuess?.Jaime;
    if (Number.isFinite(dGuess) && Number.isFinite(jGuess)) {
      const dd = Math.abs(dGuess - ans);
      const dj = Math.abs(jGuess - ans);
      if (dd < dj) d += 3;
      else if (dj < dd) j += 3;
      else { d += 3; j += 3; }
    }
  }
  return { Daniel: d, Jaime: j };
}

function bigOutcomeText() {
  const ans = state.bigQuestionAnswer;
  const dGuess = state.bigQuestionGuess?.Daniel;
  const jGuess = state.bigQuestionGuess?.Jaime;
  if (!Number.isFinite(ans) || !Number.isFinite(dGuess) || !Number.isFinite(jGuess)) {
    return "Awaiting guesses or final answer.";
  }
  const dd = Math.abs(dGuess - ans), dj = Math.abs(jGuess - ans);
  if (dd < dj) return `Daniel closest: +3 (answer: ${ans})`;
  if (dj < dd) return `Jaime closest: +3 (answer: ${ans})`;
  return `Tie: both +3 (answer: ${ans})`;
}

function flipNumber(el, value, ms=500) {
  el.textContent = "";
  const span = document.createElement("span");
  span.style.display = "inline-block";
  span.style.transition = `transform ${ms}ms`;
  span.style.transformOrigin = "50% 50%";
  span.textContent = value;
  el.appendChild(span);
  requestAnimationFrame(() => { span.style.transform = "rotateX(360deg)"; });
}

function prettyGuess(v) {
  return Number.isFinite(v) ? String(v) : "—";
}
