import { state } from "../state.js";
import { setDoc, doc, markReady, subscribeReady } from "../lib/firebase.js";
import { advanceToNextRoundOrFinal } from "../flow.js";

export function MarkingRoom() {
  const round = state.currentRound || 1;
  const self = state.self || "Daniel";
  const opponent = self === "Daniel" ? "Jaime" : "Daniel";

  const root = document.createElement("div");
  root.className = "wrap";

  const oppAnswers = state.round1OpponentAnswers || [
    { id: `r${round}q1`, question: `Stub Q${round}-1?`, chosen: "A" },
    { id: `r${round}q2`, question: `Stub Q${round}-2?`, chosen: "B" },
    { id: `r${round}q3`, question: `Stub Q${round}-3?`, chosen: "A" }
  ];

  root.innerHTML = `
    <div class="score-strip">
      Daniel: <span id="scoreDaniel">${state.perceivedScores?.Daniel || 0}</span> |
      Jaime: <span id="scoreJaime">${state.perceivedScores?.Jaime || 0}</span>
    </div>

    <div class="h1">Mark ${opponent}’s Answers — Round ${round}</div>
    <div id="markList"></div>

    <div id="continueBox" class="hidden mt-6 text-center">
      <button id="continueBtn" class="btn">Continue to Round ${round + 1}</button>
    </div>

    <div id="waitingOverlay" class="overlay hidden"><h2>Waiting for ${opponent}…</h2></div>
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

  // Marking interactions
  markList.querySelectorAll(".markBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const qid = e.target.dataset.q;
      const val = parseInt(e.target.dataset.val);
      marks[qid] = val;

      e.target.parentNode.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      e.target.classList.add("selected");

      if (Object.keys(marks).length === oppAnswers.length) {
        continueBox.classList.remove("hidden");
      }
    });
  });

  continueBox.querySelector("#continueBtn").addEventListener("click", async () => {
    // Perceived score updates
    const points = Object.values(marks).reduce((a, b) => a + b, 0);
    state.perceivedScores[opponent] = (state.perceivedScores[opponent] || 0) + points;
    document.getElementById("scoreDaniel").textContent = state.perceivedScores.Daniel || 0;
    document.getElementById("scoreJaime").textContent  = state.perceivedScores.Jaime  || 0;

    // Save marks (stub)
    await setDoc(doc(null, "rooms", state.room.code || "EH6W", "marking", self), {
      marks, round
    });

    // Mark me ready for marking phase
    waiting.classList.remove("hidden");
    markReady({ roomCode: state.room.code || "EH6W", round, phase:'marking', player: self });

    // Wait for both → advance to next round or final
    subscribeReady({ roomCode: state.room.code || "EH6W", round, phase:'marking' }, (ready) => {
      if (ready.Daniel && ready.Jaime) {
        waiting.classList.add("hidden");
        advanceToNextRoundOrFinal();
      }
    });

    continueBox.classList.add("hidden");
  });

  return root;
}
