// src/views/GenerationRoom.js
import { state, setRoundQuestions } from "../state.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip } from "../components/ScoreStrip.js";

export function GenerationRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  root.innerHTML = `
    <div class="h1">Generation Room</div>
    <p class="p">Preparing questions and Jemima’s Maths interlude…</p>

    <div class="panel" style="margin-top:16px">
      <div class="counter">
        <div class="chip">Generated <strong id="genCount">0</strong> / 30</div>
        <div class="chip">Verified <strong id="verCount">0</strong></div>
        <div class="chip">Rejected <strong id="rejCount">0</strong></div>
        <div class="chip">Jemima Maths <strong id="mathFlag">pending</strong></div>
      </div>

      <div class="gap"></div>
      <button id="contBtn" class="btn full" disabled>Continue to Round 1</button>
    </div>

    <div id="overlay" class="overlay hidden" aria-live="polite">
      <div class="countdown" id="countVal">3</div>
    </div>
  `;

  // Consistent chrome
  root.insertBefore(ScoreStrip(), root.firstChild);
  root.appendChild(RoleBadge());

  const genEl = root.querySelector("#genCount");
  const verEl = root.querySelector("#verCount");
  const rejEl = root.querySelector("#rejCount");
  const mathEl = root.querySelector("#mathFlag");
  const contBtn = root.querySelector("#contBtn");
  const overlay = root.querySelector("#overlay");
  const countVal = root.querySelector("#countVal");

  // If already generated (re-entry), reflect and enable continue
  if (state.generationProgress?.generated >= 30 && state.generationProgress.mathsReady) {
    hydrateFromState();
    contBtn.disabled = false;
  } else {
    // Kick off simulated generation
    simulateGeneration().then(() => {
      contBtn.disabled = false;
    });
  }

  // Continue → 3-2-1 → Round 1
  contBtn.addEventListener("click", () => {
    startCountdown(3, () => {
      state.currentRound = 1;
      state.phase = "question";
      location.hash = "#round1";
    });
  });

  return root;

  // --- helpers ---

  function hydrateFromState() {
    genEl.textContent = state.generationProgress.generated ?? 0;
    verEl.textContent = state.generationProgress.verified ?? 0;
    rejEl.textContent = state.generationProgress.rejected ?? 0;
    mathEl.textContent = state.generationProgress.mathsReady ? "ready" : "pending";
  }

  // Simulates Gemini pipeline + seeds 5 rounds of simple two-option questions
  async function simulateGeneration() {
    // Prevent double-run
    if (!state.generationProgress) {
      state.generationProgress = { generated: 0, verified: 0, rejected: 0, mathsReady: false };
    }

    // Seed Round question sets (simple stubs; replace with Gemini output later)
    const r1 = [
      { id: "r1q1", question: "Stub Q1-1?", options: ["A","B"], correctIndex: 0 },
      { id: "r1q2", question: "Stub Q1-2?", options: ["A","B"], correctIndex: 1 },
      { id: "r1q3", question: "Stub Q1-3?", options: ["A","B"], correctIndex: 0 }
    ];
    const r2 = [
      { id: "r2q1", question: "Stub Q2-1?", options: ["A","B"], correctIndex: 0 },
      { id: "r2q2", question: "Stub Q2-2?", options: ["A","B"], correctIndex: 1 },
      { id: "r2q3", question: "Stub Q2-3?", options: ["A","B"], correctIndex: 0 }
    ];
    const r3 = [
      { id: "r3q1", question: "Stub Q3-1?", options: ["A","B"], correctIndex: 1 },
      { id: "r3q2", question: "Stub Q3-2?", options: ["A","B"], correctIndex: 0 },
      { id: "r3q3", question: "Stub Q3-3?", options: ["A","B"], correctIndex: 1 }
    ];
    const r4 = [
      { id: "r4q1", question: "Stub Q4-1?", options: ["A","B"], correctIndex: 0 },
      { id: "r4q2", question: "Stub Q4-2?", options: ["A","B"], correctIndex: 1 },
      { id: "r4q3", question: "Stub Q4-3?", options: ["A","B"], correctIndex: 1 }
    ];
    const r5 = [
      { id: "r5q1", question: "Stub Q5-1?", options: ["A","B"], correctIndex: 0 },
      { id: "r5q2", question: "Stub Q5-2?", options: ["A","B"], correctIndex: 0 },
      { id: "r5q3", question: "Stub Q5-3?", options: ["A","B"], correctIndex: 1 }
    ];

    // Store into state via helper
    setRoundQuestions(1, r1);
    setRoundQuestions(2, r2);
    setRoundQuestions(3, r3);
    setRoundQuestions(4, r4);
    setRoundQuestions(5, r5);

    // Also stub big question parts (Rounds 1–4); final numeric answer after Round 5
    state.bigQuestionParts = [
      "Part 1: A curious clue appears.",
      "Part 2: The plot thickens slightly.",
      "Part 3: Nearly there; think laterally.",
      "Part 4: Final hint before the big reveal."
    ];
    state.bigQuestionAnswer = null;

    // Animate counters to look alive
    await fakePipelineCounters({
      total: 30,
      rejEvery: 7, // roughly reject 1 out of 7 for drama
      onTick: ({ gen, ver, rej }) => {
        state.generationProgress.generated = gen;
        state.generationProgress.verified  = ver;
        state.generationProgress.rejected  = rej;
        genEl.textContent = gen;
        verEl.textContent = ver;
        rejEl.textContent = rej;
      }
    });

    // Flag Jemima maths as ready (we’ll wire actual generator later)
    state.generationProgress.mathsReady = true;
    mathEl.textContent = "ready";
  }

  function fakeSleep(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  async function fakePipelineCounters({ total, rejEvery = 6, onTick }) {
    let gen = 0, ver = 0, rej = 0;

    while (gen < total) {
      await fakeSleep(60 + Math.random() * 120);
      gen++;

      // simple verify/reject animation
      if (gen % rejEvery === 0) {
        rej++;
      } else {
        ver++;
      }

      onTick({ gen, ver, rej });
    }
  }

  function startCountdown(secs, done) {
    let n = secs;
    overlay.classList.remove("hidden");
    countVal.textContent = String(n);

    const t = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(t);
        overlay.classList.add("hidden");
        done && done();
      } else {
        countVal.textContent = String(n);
      }
    }, 1000);
  }
}
