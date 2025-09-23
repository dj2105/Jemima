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

  questions.forEach((q) => {
    const div = document.createElement("div");
    div.className = "panel mt-3";
    div.innerHTML = `
      <p><strong>${q.question}</strong></p>
      <div class="row center gap">
        ${q.options
          .map(
            (opt) =>
              `<button class="btn optBtn" data-q="${q.id}" data-val="${opt}">${opt}</button>`
          )
          .join("")}
      </div>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll(".optBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const qid = e.target.dataset.q;
      const val = e.target.dataset.val;

      // mark selection visually
      e.target.parentNode.querySelectorAll("button").forEach((b) =>
        b.classList.remove("selected")
      );
      e.target.classList.add("selected");

      answered++;
      if (answered >= questions.length) {
        contBtn.classList.remove("hidden");
      }
    });
  });

  contBtn.addEventListener("click", () => {
    advanceToMarking();
  });
root.appendChild(RoleBadge());
return root;
}
