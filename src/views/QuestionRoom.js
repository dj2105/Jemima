// src/views/QuestionRoom.js
import { state } from "../state.js";
import { advanceToMarking } from "../flow.js";
import { RoleBadge } from "../components/RoleBadge.js";

export function QuestionRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  const r = state.currentRound;
  const questions = state[`round${r}Questions`] || [];

  root.innerHTML = `
    <div class="score-strip">
      Daniel: ${state.perceivedScores.Daniel} |
      Jaime: ${state.perceivedScores.Jaime}
    </div>

    <div class="h1">Round ${r} Questions</div>
    <div id="qList"></div>
    <div class="gap"></div>
    <button id="contBtn" class="btn hidden">Continue to Marking</button>
  `;

  const list = root.querySelector("#qList");
  const contBtn = root.querySelector("#contBtn");

  let answered = 0;

  // Render all 3 questions
  questions.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "panel mt-3";
    div.innerHTML = `
      <p><strong>${q.question}</strong></p>
      <div class="row center gap" data-qid="${q.id}" data-locked="0" role="group" aria-label="Question ${idx + 1}">
        ${q.options.map((opt, i) => `
          <button class="btn optBtn"
                  data-q="${q.id}"
                  data-i="${i}"
                  aria-pressed="false">
            ${opt}
          </button>
        `).join("")}
      </div>
    `;
    list.appendChild(div);
  });

  // Click handling with visible selection + lock per question
  list.querySelectorAll(".optBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const group = e.currentTarget.parentNode; // the row with both buttons
      if (group.dataset.locked === "1") {
        // Already answered; ignore additional clicks
        return;
      }

      // Visually lock both options, then highlight the chosen one
      group.querySelectorAll("button").forEach((b) => {
        b.classList.remove("selected");
        b.classList.add("is-locked");
        b.setAttribute("aria-pressed", "false");
      });
      e.currentTarget.classList.add("selected");
      e.currentTarget.classList.remove("is-locked");
      e.currentTarget.setAttribute("aria-pressed", "true");

      // Lock the group so we only count once
      group.dataset.locked = "1";
      answered += 1;

      if (answered >= questions.length) {
        contBtn.classList.remove("hidden");
      }
    });
  });

  contBtn.addEventListener("click", () => {
    advanceToMarking();
  });

  // Role badge
  root.appendChild(RoleBadge());
  return root;
}
