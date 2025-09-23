import { state } from "../state.js";
import { generateQuestions, generateJemimaMaths } from "../lib/gemini.js";
// In PR#2 we stub firestore wrappers:
import { setDoc, doc } from "../lib/firebase.js";

export function GenerationRoom(){
  const root = document.createElement('div');
  root.className = 'wrap';
  root.innerHTML = `
    <div class="h1">Generation Room</div>
    <div class="panel text-center">
      <div id="progress" class="progress-counters">
        <div>Questions: <span id="qGenerated">0</span> / 30</div>
        <div>Verified: <span id="qVerified">0</span></div>
        <div>Rejected: <span id="qRejected">0</span></div>
      </div>

      <div class="gap"></div>
      <div>Jemima’s Maths Puzzle: <span id="mathStatus">Pending</span></div>

      <div class="divider"></div>

      <div class="row" style="align-items:center; gap:12px; justify-content:center">
        <div>Join Code: <code id="joinCode">----</code></div>
        <button id="copyCodeBtn" class="btn">Copy</button>
      </div>

      <div id="countdown" class="countdown hidden"></div>
    </div>
  `;

  startGeneration();

  root.querySelector("#copyCodeBtn").addEventListener("click", () => {
    const code = root.querySelector("#joinCode").textContent;
    navigator.clipboard.writeText(code).catch(()=>{});
    alert(`Copied: ${code}`);
  });

  async function startGeneration() {
    const qGenerated = root.querySelector("#qGenerated");
    const qVerified  = root.querySelector("#qVerified");
    const qRejected  = root.querySelector("#qRejected");
    const mathStatus = root.querySelector("#mathStatus");
    const joinCodeEl = root.querySelector("#joinCode");

    // Generate 30 questions (stubbed)
    const { questions, verified, rejected } = await generateQuestions(30);
    qGenerated.textContent = questions.length;
    qVerified.textContent  = verified;
    qRejected.textContent  = rejected;

    // Save to Firestore (stubbed)
    await setDoc(
      doc(null, "rooms", state.room.code || "EH6W", "config", "questions"),
      { questions }
    );

    // Generate Jemima Maths puzzle (stubbed)
    const maths = await generateJemimaMaths();
    mathStatus.textContent = "Ready";

    await setDoc(
      doc(null, "rooms", state.room.code || "EH6W", "config", "maths"),
      { maths }
    );

    // Show join code
    joinCodeEl.textContent = state.room.code || "EH6W";

    // Simulate Jaime joining then 3s countdown
    setTimeout(runCountdown, 1000);
  }

  function runCountdown(){
    const el = root.querySelector('#countdown');
    el.classList.remove('hidden');
    let t = 3;
    el.textContent = t;
    const iv = setInterval(() => {
      t--;
      el.textContent = t;
      if (t < 0){
        clearInterval(iv);
        // next route comes in PR#3
        alert('Round 1 starting (stub)');
      }
    }, 1000);
  }

  return root;
}
