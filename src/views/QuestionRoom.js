import { state } from "../state.js";
import { setDoc, doc, markReady, subscribeReady } from "../lib/firebase.js";
import { advanceToMarking } from "../flow.js";

export function QuestionRoom() {
  const round = state.currentRound || 1;
  const self = state.self;           // "Daniel" or "Jaime"
  const opponent = state.opponent;   // derived

  const root = document.createElement("div");
  root.className = "wrap";

  const questions = state[`round${round}Questions`] || [
    { id: `r${round}q1`, question: `Stub Q${round}-1?`, options: ["A", "B"] },
    { id: `r${round}q2`, question: `Stub Q${round}-2?`, options: ["A", "B"] },
    { id: `r${round}q3`, question: `Stub Q${round}-3?`, options: ["A", "B"] }
  ];

  let current = 0;

  root.innerHTML = `
    <div class="h1">Round ${round}</div>
    <div id="qBox" class="panel"></div>
    <div id="bigQ" class="hidden panel mt-4"></div>
    <div id="waiting" class="overlay hidden"><h2>Waiting for ${opponent}…</h2></div>
  `;

  const qBox = root.querySelector("#qBox");
  const bigQ = root.querySelector("#bigQ");
  const waiting = root.querySelector("#waiting");

  showQ();

  function showQ() {
    if (current >= questions.length) {
      // show this round's big-question part
      bigQ.classList.remove("hidden");
      bigQ.textContent = state.bigQuestionParts?.[round - 1] || "Stub big question part";

      // mark me ready for this round's question phase
      markReady({ roomCode: state.room.code || "EH6W", round, phase: "question", player: self });

      // wait for both ready → advance to marking
      waiting.classList.remove("hidden");
      subscribeReady({ roomCode: state.room.code || "EH6W", round, phase: "question" }, (ready) => {
        if (ready.Daniel && ready.Jaime) {
          waiting.classList.add("hidden");
          advanceToMarking();
        }
      });
      return;
    }

    const q = questions[current];
    qBox.innerHTML = `
      <p>${q.question}</p>
      <div class="row center gap">
        <button data-i="0" class="btn">${q.options[0]}</button>
        <button data-i="1" class="btn">${q.options[1]}</button>
      </div>
    `;

    qBox.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const choice = parseInt(e.target.dataset.i, 10);
        await setDoc(
          doc(null, "rooms", state.room.code || "EH6W", "answers", self),
          { [q.id]: choice, round }
        );
        current += 1;
        showQ();
      });
    });
  }

  return root;
}
