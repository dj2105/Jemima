// src/views/MarkingRoom.js
import { state } from "../state.js";
import { setDoc, doc, markReady, subscribeReady } from "../lib/firebase.js";
import { advanceToNextRoundOrFinal } from "../flow.js";
import { RoleBadge } from "../components/RoleBadge.js";
import { ScoreStrip, updateScoreStrip } from "../components/ScoreStrip.js";

export function MarkingRoom() {
  const r = state.currentRound || 1;
  const self = state.self;          // "Daniel" or "Jaime"
  const opponent = state.opponent;  // derived

  const root = document.createElement("div");
  root.className = "wrap";

  // Prefer explicit per-round opponent answers if present
  const explicit = state[`round${r}OpponentAnswers`];

  // Fallback: build simple stubs from that round's questions if answers aren't stored yet
  const qStub = (state[`round${r}Questions`] || []).map((q, i) => ({
    id: q.id || `r${r}q${i + 1}`,
    question: q.question || `Stub Q${r}-${i + 1}?`,
    chosen: (q.options && q.options[0]) || "A"
  }));

  const oppAnswers =
    explicit && Array.isArray(explicit) && explicit.length ? explicit : qStub;

  root.innerHTML = `
    <div class="h1">Mark ${opponent}’s Answers — Round ${r}</div>
    <div id="markList"></div>

    <div id="continueBox" class="hidden mt-6 text-center">
      <button id="continueBtn" class="btn">
        Continue to ${r < 5 ? `Round ${r + 1}` : "Final"}
      </button>
    </div>

    <div id="waitingOverlay" class="overlay hidden">
      <h2>Waiting for ${opponent}…</h2>
    </div>
  `;

  // Add score strip at the very top (outside of the template)
  root.insertBefore(ScoreStrip(), root.firstChild);

  const markList = root.querySelector("#markList");
  const continueBox = root.querySelector("#continueBox");
  const waiting = root.querySelector("#waitingOverlay");

  const marks = {}; // qid -> 1 (correct) | 0 (incorrect)

  // Render each opponent answer block
  oppAnswers.forEach((a) => {
    const div = document.createElement("div");
    div.className = "panel mt-3";
    div.innerHTML = `
      <p><strong>${a.question}</strong></p>
      <p>Chosen: <code>${a.chosen}</code></p>
      <div class="row center gap">
        <button class="btn markBtn" data-q="${a.id}" data-val="1" aria-pressed="false">Correct</button>
        <button class="btn markBtn" data-q="${a.id}" data-val="0" aria-pressed="false">Incorrect</button>
      </div>
    `;
    markList.appendChild(div);
  });

  // Interactions for marking
  markList.querySelectorAll(".markBtn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const qid = e.currentTarget.dataset.q;
      const val = parseInt(e.currentTarget.dataset.val, 10);
      marks[qid] = val;

      // Visual selection (and ARIA)
      const group = e.currentTarget.parentNode;
      group.querySelectorAll("button").forEach((b) => {
        b.classList.remove("selected");
        b.setAttribute("aria-pressed", "false");
      });
      e.currentTarget.classList.add("selected");
      e.currentTarget.setAttribute("aria-pressed", "true");

      if (Object.keys(marks).length === oppAnswers.length) {
        continueBox.classList.remove("hidden");
      }
    });
  });

  // Continue → save marks, update perceived, wait for opponent, then advance
  continueBox.querySelector("#continueBtn").addEventListener("click", async () => {
    const points = Object.values(marks).reduce((a, b) => a + b, 0);

    // Update perceived score for opponent
    state.perceivedScores = state.perceivedScores || {};
    state.perceivedScores[opponent] =
      (state.perceivedScores[opponent] || 0) + points;

    // Reflect in UI (and keep the strip in sync)
    updateScoreStrip(root);

    // Persist (Firestone adapter; safe no-op if stubbed)
    await setDoc(
      doc(null, "rooms", state.room.code || "EH6W", "marking", self),
      { marks, round: r }
    );

    // Mark me ready for this round's marking phase
    waiting.classList.remove("hidden");
    continueBox.classList.add("hidden");

    markReady({
      roomCode: state.room.code || "EH6W",
      round: r,
      phase: "marking",
      player: self
    });

    // When both are ready → advance
    subscribeReady(
      { roomCode: state.room.code || "EH6W", round: r, phase: "marking" },
      (ready) => {
        if (ready.Daniel && ready.Jaime) {
          waiting.classList.add("hidden");
          advanceToNextRoundOrFinal();
        }
      }
    );
  });

  // Role badge
  root.appendChild(RoleBadge());

  return root;
}
