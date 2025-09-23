// src/views/Interlude.js
import { state } from "../state.js";
import { getInterludeSample } from "../lib/jemima.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip } from "../components/ScoreStrip.js";
import { advanceToNextRoundFromInterlude } from "../flow.js";

export function Interlude() {
  const r = state.currentRound + 1; // interlude after round r-1 → interlude r
  const root = document.createElement("div");
  root.className = "wrap";

  root.innerHTML = `
    <div class="h1">Interlude ${r}: Jemima Maths</div>
    <div class="panel" id="storyBox"><p>Loading…</p></div>
    <div class="panel" id="quizBox" style="margin-top:12px"></div>
    <div class="gap"></div>
    <button id="continueBtn" class="btn hidden">Continue to Round ${r}</button>
  `;

  root.insertBefore(ScoreStrip(), root.firstChild);
  root.appendChild(RoleBadge());

  const storyBox = root.querySelector("#storyBox");
  const quizBox = root.querySelector("#quizBox");
  const cont = root.querySelector("#continueBtn");

  (async () => {
    if (!state.interludes[r]) {
      // load a local sample; later we’ll call Gemini & store result
      state.interludes[r] = await getInterludeSample().catch(() => null);
    }
    const data = state.interludes[r];
    if (!data) {
      storyBox.innerHTML = `<p class="error-inline">Couldn’t load interlude. You can continue.</p>`;
      cont.classList.remove("hidden");
      return;
    }

    storyBox.innerHTML = `
      <div class="subtext">${data.location}</div>
      <ol>
        ${data.beats.map(b => `<li>${b}</li>`).join("")}
      </ol>
    `;

    // two numeric inputs with unit hints already in text
    quizBox.innerHTML = `
      <div>
        <label>${data.questions[0]}</label>
        <input type="number" id="a0" class="input" style="text-transform:none; letter-spacing:0" />
      </div>
      <div class="gap"></div>
      <div>
        <label>${data.questions[1]}</label>
        <input type="number" id="a1" class="input" style="text-transform:none; letter-spacing:0" />
      </div>
      <div class="gap"></div>
      <button id="checkBtn" class="btn">Check answers</button>
      <div id="result" class="p"></div>
    `;

    quizBox.querySelector("#checkBtn").addEventListener("click", () => {
      const a0 = parseInt(quizBox.querySelector("#a0").value, 10);
      const a1 = parseInt(quizBox.querySelector("#a1").value, 10);
      const ok0 = Number.isInteger(a0) && a0 === data.answers[0];
      const ok1 = Number.isInteger(a1) && a1 === data.answers[1];
      quizBox.querySelector("#result").innerHTML =
        `Q1: ${ok0 ? "✅" : `❌ (correct: ${data.answers[0]})`} &nbsp; ` +
        `Q2: ${ok1 ? "✅" : `❌ (correct: ${data.answers[1]})`}`;
      cont.classList.remove("hidden");
    });
  })();

  cont.addEventListener("click", () => {
    advanceToNextRoundFromInterlude();
  });

  return root;
}
