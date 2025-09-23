// src/views/GenerationRoom.js
import { state, setRoundQuestions } from "../state.js";

export function GenerationRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  root.innerHTML = `
    <div class="h1">Generation Room</div>
    <p>Here we would normally generate questions with Gemini.</p>
    <div class="gap"></div>
    <button id="contBtn" class="btn">Continue to Round 1</button>
  `;

  root.querySelector("#contBtn").addEventListener("click", () => {
    // --- seed stub questions for rounds 1–5 ---
    const r1 = [
      { id: "r1q1", question: "Stub Q1-1?", options: ["A","B"] },
      { id: "r1q2", question: "Stub Q1-2?", options: ["A","B"] },
      { id: "r1q3", question: "Stub Q1-3?", options: ["A","B"] }
    ];
    const r2 = [
      { id: "r2q1", question: "Stub Q2-1?", options: ["A","B"] },
      { id: "r2q2", question: "Stub Q2-2?", options: ["A","B"] },
      { id: "r2q3", question: "Stub Q2-3?", options: ["A","B"] }
    ];
    const r3 = [
      { id: "r3q1", question: "Stub Q3-1?", options: ["A","B"] },
      { id: "r3q2", question: "Stub Q3-2?", options: ["A","B"] },
      { id: "r3q3", question: "Stub Q3-3?", options: ["A","B"] }
    ];
    const r4 = [
      { id: "r4q1", question: "Stub Q4-1?", options: ["A","B"] },
      { id: "r4q2", question: "Stub Q4-2?", options: ["A","B"] },
      { id: "r4q3", question: "Stub Q4-3?", options: ["A","B"] }
    ];
    const r5 = [
      { id: "r5q1", question: "Stub Q5-1?", options: ["A","B"] },
      { id: "r5q2", question: "Stub Q5-2?", options: ["A","B"] },
      { id: "r5q3", question: "Stub Q5-3?", options: ["A","B"] }
    ];

    setRoundQuestions(1, r1);
    setRoundQuestions(2, r2);
    setRoundQuestions(3, r3);
    setRoundQuestions(4, r4);
    setRoundQuestions(5, r5);

    // advance to Round 1
    state.currentRound = 1;
    state.phase = "question";
    location.hash = "#round1";
  });

  return root;
}
