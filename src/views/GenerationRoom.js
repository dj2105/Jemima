// src/views/GenerationRoom.js
import { state, setRoundQuestions } from "../state.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip } from "../components/ScoreStrip.js";
import { ensureFirebase, setRoomStatus } from "../lib/firebase.js";
import { countdownThen } from "../flow.js";

export function GenerationRoom() {
  const root = document.createElement("div");
  root.className = "wrap";

  root.innerHTML = `
    <div class="h1">Generation Room</div>
    <p>Seeding stub questions for a full 5-round playtest.</p>
    <div class="gap"></div>
    <div class="panel">
      <div class="row" style="justify-content:space-between">
        <button id="seed" class="btn">Seed Questions</button>
        <button id="start" class="btn daniel" disabled>Start Game</button>
      </div>
      <div class="p" id="status"></div>
      <div class="subtext" id="hostNote"></div>
    </div>
  `;

  // Chrome
  root.insertBefore(ScoreStrip(), root.firstChild);
  root.appendChild(RoleBadge());

  const statusEl = root.querySelector("#status");
  const hostNote = root.querySelector("#hostNote");
  const seedBtn = root.querySelector("#seed");
  const startBtn = root.querySelector("#start");

  // Only the host (Daniel) should start the game
  const isHost = state.self === "Daniel";
  if (!isHost) {
    startBtn.disabled = true;
    hostNote.textContent = "Only the host (Daniel) can start the game once questions are seeded.";
  }

  seedBtn.addEventListener("click", () => {
    // Create 5 rounds × 3 questions with options + correctIndex
    const make = (r) => (i) => ({
      id: `r${r}q${i + 1}`,
      question: `Round ${r} — Q${i + 1}: pick A or B?`,
      options: ["A", "B"],
      correctIndex: i % 2 // alternate correctness: 0,1,0 per round
    });

    const r1 = Array.from({ length: 3 }, (_, i) => make(1)(i));
    const r2 = Array.from({ length: 3 }, (_, i) => make(2)(i));
    const r3 = Array.from({ length: 3 }, (_, i) => make(3)(i));
    const r4 = Array.from({ length: 3 }, (_, i) => make(4)(i));
    const r5 = Array.from({ length: 3 }, (_, i) => make(5)(i));

    setRoundQuestions(1, r1);
    setRoundQuestions(2, r2);
    setRoundQuestions(3, r3);
    setRoundQuestions(4, r4);
    setRoundQuestions(5, r5);

    state.currentRound = 1;
    state.phase = "question";

    statusEl.textContent = "✅ Seeded questions for rounds 1–5.";
    if (isHost) startBtn.disabled = false;
  });

  startBtn.addEventListener("click", async () => {
    if (!isHost) return; // guard
    if (!state.room.code) {
      alert("No room code yet. Go back and generate one in the Lobby.");
      return;
    }
    await ensureFirebase();

    // Tell both clients to start countdown to round 1
    await setRoomStatus(state.room.code, { phase: "countdown", round: 1 });

    // Also start countdown locally (host) to keep both tabs in sync
    countdownThen("#round1");
  });

  return root;
}
