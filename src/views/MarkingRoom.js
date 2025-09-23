// src/views/MarkingRoom.js
import { state } from "../state.js";
import { setDoc, doc } from "../lib/firebase.js";

export function MarkingRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  // Detect which player this client is — for now hardcoded.
  // TODO: later detect via login/session or role in Firestore.
  const self = "Daniel";
  const opponent = self === "Daniel" ? "Jaime" : "Daniel";

  // Grab opponent answers (fallback if none yet)
  const oppAnswers = state.round1OpponentAnswers || [
    { id: "q1", question: "Stub Q1?", chosen: "Yes" },
    { id: "q2", question: "Stub Q2?", chosen: "Right" },
    { id: "q3", question: "Stub Q3?", chosen: "Up" }
  ];

  root.innerHTML = `
    <div class="score-strip">
      Daniel: <span id="scoreDaniel">${state.perceivedScores?.Daniel || 0}</span> |
      Jaime: <span id="scoreJaime">${state.perceivedScores?.Jaime || 0}</span>
    </div>

    <div class="h1">Mark ${opponent}’s Answers</div>
    <div id="markList"></div>

    <div id="continueBox" class="hidden mt-6 text-center">
      <button id="continueBtn" class="btn">Continue to Round ${state.currentRound + 1}</button>
    </div>

    <div id="waitingOverlay" class="overlay hidden"><h2>Waiting…</h2></div>
  `;

  const markList = root.querySelector("#markList");
  const continueBox = root.querySelector("#continueBox");
  const waiting = root.querySelector("#waitingOverlay");

  let marks = {};

  // Render opponent’s answers
  oppAnswers.forEach((a) => {
    const div = document.createElement("div");
    div.className = "panel mt-3";
    div.innerHTML = `
      <p><strong>${a.question}</strong></p>
      <p>Chosen: <code>${a.chosen}</code></p>
      <div class="row center gap">
        <button class="btn markBtn" data-q="${a.id}" data-val="1">Correct</button>
        <button class="btn markBtn" data-q="${a.id}" data-val="0">Incorrect</button>
      </div>
    `;
    markList.appendChild(div);
  });

  // Marking logic
  markList.querySelectorAll(".markBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const qid = e.target.dataset.q;
      const val = parseInt(e.target.dataset.val);
      marks[qid] = val;

      e.target.parentNode.querySelectorAll("button").forEach((b) => {
        b.classList.remove("selected");
      });
      e.target.classList.add("selected");

      if (Object.keys(marks).length === oppAnswers.length) {
        continueBox.classList.remove("hidden");
      }
    });
  });

  // Continue button logic
  continueBox.querySelector("#continueBtn").addEventListener("click", async () => {
    // Add perceived points for the opponent
    const points = Object.values(marks).reduce((a, b) => a + b, 0);
    state.perceivedScores[opponent] = (state.perceivedScores[opponent] || 0) + points;

    // Update UI scores
    document.getElementById("scoreDaniel").textContent = state.perceivedScores.Daniel || 0;
    document.getElementById("scoreJaime").textContent = state.perceivedScores.Jaime || 0;

    // Save to Firestore (stub — currently using null db in doc())
    await setDoc(doc(null, "rooms", state.room.code, "marking", self), {
      marks,
      round: state.currentRound
    });

    // Show waiting screen until opponent also finishes
    continueBox.classList.add("hidden");
    waiting.classList.remove("hidden");

    // TODO: Add Firestore listener → if both players submitted,
    // then increment round and redirect:
    // state.currentRound++;
    // location.hash = "#round" + state.currentRound;
  });

  return root;
}
