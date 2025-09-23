// src/views/Interlude.js
import { state } from "../state.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip } from "../components/ScoreStrip.js";
import { generateJemima, validateJemima } from "../lib/jemima.js";
import { advanceFromInterludeToRound } from "../flow.js";

export function Interlude() {
  // Hash is like #interlude3 → this interlude precedes Round 3
  const nextRound = parseInt((location.hash || "").replace("#interlude", ""), 10) || 2;

  const root = document.createElement("div");
  root.className = "wrap";
  root.innerHTML = `
    <div class="h1">Jemima’s Maths — Interlude before Round ${nextRound}</div>

    <div id="storyPanel" class="panel">
      <div class="p">Generating a tiny whimsical story and two questions…</div>
    </div>

    <div class="gap"></div>
    <div id="qPanel" class="panel hidden"></div>

    <div class="gap"></div>
    <button id="contBtn" class="btn full hidden">Continue to Round ${nextRound}</button>
  `;

  // Consistent chrome
  root.insertBefore(ScoreStrip(), root.firstChild);
  root.appendChild(RoleBadge());

  const storyPanel = root.querySelector("#storyPanel");
  const qPanel = root.querySelector("#qPanel");
  const contBtn = root.querySelector("#contBtn");

  // Re-entry safe: if we already generated this interlude, render directly
  if (state.interludes[nextRound]) {
    renderInterlude(state.interludes[nextRound]);
  } else {
    generateJemima().then((obj) => {
      const data = validateJemima(obj) ? obj : localFallback();
      state.interludes[nextRound] = data;
      renderInterlude(data);
    }).catch(() => {
      const data = localFallback();
      state.interludes[nextRound] = data;
      renderInterlude(data);
    });
  }

  function renderInterlude(data) {
    storyPanel.innerHTML = `
      <div class="badge">${escapeHTML(data.location)}</div>
      <div class="gap"></div>
      <ol>
        ${data.beats.map(b => `<li class="p">${escapeHTML(b)}</li>`).join("")}
      </ol>
    `;

    qPanel.classList.remove("hidden");
    qPanel.innerHTML = `
      <div class="h2">Answer both to continue</div>
      <div class="gap"></div>

      <div class="kv">
        <label>Q1</label>
        <div>
          <div class="p">${escapeHTML(data.questions[0])}</div>
          <input id="a1" type="number" class="input" style="text-transform:none; letter-spacing:0" placeholder="0" />
          <div id="r1" class="error-inline hidden">Incorrect — try reading the beats again.</div>
        </div>

        <label>Q2</label>
        <div>
          <div class="p">${escapeHTML(data.questions[1])}</div>
          <input id="a2" type="number" class="input" style="text-transform:none; letter-spacing:0" placeholder="0" />
          <div id="r2" class="error-inline hidden">Incorrect — try reading the beats again.</div>
        </div>
      </div>

      <div class="gap"></div>
      <button id="submit" class="btn">Submit answers</button>
      <div id="result" class="p"></div>
    `;

    qPanel.querySelector("#submit").addEventListener("click", () => {
      const a1 = parseInt(qPanel.querySelector("#a1").value || "NaN", 10);
      const a2 = parseInt(qPanel.querySelector("#a2").value || "NaN", 10);
      const ok1 = Number.isInteger(a1) && a1 === data.answers[0];
      const ok2 = Number.isInteger(a2) && a2 === data.answers[1];

      qPanel.querySelector("#r1").classList.toggle("hidden", ok1);
      qPanel.querySelector("#r2").classList.toggle("hidden", ok2);

      qPanel.querySelector("#result").innerHTML =
        `Q1: ${ok1 ? "✅" : `❌ (correct: ${data.answers[0]})`} &nbsp; ` +
        `Q2: ${ok2 ? "✅" : `❌ (correct: ${data.answers[1]})`}`;

      if (ok1 && ok2) {
        // Optional: mini score +2 for both correct
        const self = state.self;
        state.miniScores[self] = (state.miniScores[self] || 0) + 2;
        contBtn.classList.remove("hidden");
      }
    });
  }

  contBtn.addEventListener("click", () => {
    advanceFromInterludeToRound(nextRound);
  });

  return root;
}

function localFallback() {
  return {
    location: "Lidl",
    beats: [
      "Jemima arrived with €5 and a grin.",
      "She bought 2 bananas at €1 each and a roll for €1.",
      "She gifted 1 banana to a toddler.",
      "She performed 3 goose honks at the doors."
    ],
    questions: [
      "How much change did Jemima get? ___ euros",
      "How many bananas did Jemima have left? ___ bananas"
    ],
    answers: [2, 1]
  };
}

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
