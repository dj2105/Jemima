import { state } from "../state.js";
import { setRound1Questions } from "../state.js";

export function GenerationRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  // stub questions for round 1
  const stubQuestions = [
    { id: "r1q1", question: "Stub Question 1?", options: ["Yes", "No"] },
    { id: "r1q2", question: "Stub Question 2?", options: ["Left", "Right"] },
    { id: "r1q3", question: "Stub Question 3?", options: ["Up", "Down"] }
  ];

  root.innerHTML = `
    <div class="h1">Generation Room</div>
    <p>Here we would normally generate questions with Gemini.</p>
    <div class="gap"></div>
    <button id="contBtn" class="btn">Continue to Round 1</button>
  `;

  root.querySelector("#contBtn").addEventListener("click", () => {
    // store stub questions for round 1
    setRound1Questions(stubQuestions);

    // advance to Round 1
    state.currentRound = 1;
    state.phase = "question";
    location.hash = "#round1";
  });

  return root;
}
