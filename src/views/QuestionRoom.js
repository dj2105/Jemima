import { state } from "../state.js";
import { setDoc, doc } from "../lib/firebase.js";

export function QuestionRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  let current = 0;
  const questions = state.round1Questions || [
    { id: "q1", question: "Stub Q1?", options: ["A", "B"], correct: 0 },
    { id: "q2", question: "Stub Q2?", options: ["A", "B"], correct: 1 },
    { id: "q3", question: "Stub Q3?", options: ["A", "B"], correct: 0 }
  ];

  root.innerHTML = `
    <div class="h1">Round 1</div>
    <div id="qBox" class="panel text-center"></div>
    <div id="bigQ" class="hidden panel mt-4">
      <p><strong>Big Question – Part 1:</strong></p>
      <p id="bigQText">Stub: this is part 1 of the big question.</p>
    </div>
    <div id="waiting" class="overlay hidden"><h2>Waiting for Jaime…</h2></div>
  `;

  const qBox = root.querySelector("#qBox");
  showQuestion();

  function showQuestion() {
    if (current >= questions.length) {
      // all 3 done
      document.getElementById("bigQ").classList.remove("hidden");
      // signal finished
      markFinished();
      return;
    }

    const q = questions[current];
    qBox.innerHTML = `
      <div class="mb-4">${q.question}</div>
      <div class="row center gap">
        <button class="btn" data-idx="0">${q.options[0]}</button>
        <button class="btn" data-idx="1">${q.options[1]}</button>
      </div>
    `;

    qBox.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const choice = parseInt(e.target.dataset.idx);
        await saveAnswer(q.id, choice);
        current++;
        showQuestion();
      });
    });
  }

  async function saveAnswer(qId, choice) {
    const player = "Daniel"; // TODO: dynamic role
    await setDoc(
      doc(null, "rooms", state.room.code || "EH6W", "answers", player),
      { [qId]: choice }
    );
  }

  function markFinished() {
    // TODO: Firestore presence check
    root.querySelector("#waiting").classList.remove("hidden");
    console.log("Round 1 finished for player");
  }

  return root;
}
