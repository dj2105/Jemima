import { state } from "../state.js";
import { setDoc, doc } from "../lib/firebase.js";

export function MarkingRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  const opponent = "Jaime"; // TODO: dynamic based on player
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

    <div class="h1">Mark Jaime’s Answers</div>
    <div id="markList"></div>

    <div id="continueBox" class="hidden mt-6 text-center">
      <button id="continueBtn" class="btn">Continue</button>
    </div>

    <div id="waitingOverlay" class="overlay hidden"><h2>Waiting…</h2></div>
  `;

  const markList = root.querySelector("#markList");
  const continueBox = root.querySelector("#continueBox");
  const waiting = root.querySelector("#waitingOverlay");

  let marks = {};

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

  continueBox.querySelector("#continueBtn").addEventListener("click", async () => {
    // Update perceived score
    const points = Object.values(marks).reduce((a, b) => a + b, 0);
    state.perceivedScores = state.perceivedScores || {};
    state.perceivedScores[opponent] = (state.perceivedScores[opponent] || 0) + points;

    document.getElementById("scoreJaime").textContent = state.perceivedScores.Jaime || 0;

    // Save to Firestore (stubbed)
    await setDoc(doc(null, "rooms", state.room.code, "marking", "Daniel"), marks);

    continueBox.classList.add("hidden");
    waiting.classList.remove("hidden");

    // TODO: wait for other player then route to Round 2
  });

  return root;
}
