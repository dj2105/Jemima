import { state } from "../state.js";
import { setDoc, doc } from "../lib/firebase.js";
import { advanceFlow } from "../flow.js";

export function QuestionRoom() {
  const round = state.currentRound || 1;

  const root = document.createElement("div");
  root.className = "wrap";

  const questions = state[`round${round}Questions`] || [
    { id: "q1", question: `Stub Q${round}-1?`, options: ["A","B"] },
    { id: "q2", question: `Stub Q${round}-2?`, options: ["A","B"] },
    { id: "q3", question: `Stub Q${round}-3?`, options: ["A","B"] }
  ];

  let current = 0;

  root.innerHTML = `
    <div class="h1">Round ${round}</div>
    <div id="qBox" class="panel"></div>
    <div id="bigQ" class="hidden panel mt-4"></div>
  `;

  const qBox = root.querySelector("#qBox");
  const bigQ = root.querySelector("#bigQ");

  showQ();

  function showQ(){
    if(current >= questions.length){
      bigQ.classList.remove("hidden");
      bigQ.textContent = state.bigQuestionParts[round-1] || "Stub big question part";
      // finished → wait 1s then advance flow
      setTimeout(()=>advanceFlow(), 1000);
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
    qBox.querySelectorAll("button").forEach(btn=>{
      btn.addEventListener("click", async e=>{
        const choice = parseInt(e.target.dataset.i);
        await setDoc(doc(null,"rooms",state.room.code||"EH6W","answers","Daniel"),
          { [q.id]: choice });
        current++;
        showQ();
      });
    });
  }

  return root;
}
