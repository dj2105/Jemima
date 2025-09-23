import { state } from "../state.js";
import { generateQuestions, generateJemimaMaths } from "../lib/gemini.js";
import { setDoc, doc } from "../lib/firebase.js";

export default function GenerationRoom(root) {
  root.innerHTML = `
    <div class="panel text-center">
      <h1 class="title">Generation Room</h1>
      <div id="progress" class="progress-counters">
        <div>Questions: <span id="qGenerated">0</span> / 30</div>
        <div>Verified: <span id="qVerified">0</span></div>
        <div>Rejected: <span id="qRejected">0</span></div>
      </div>

      <div class="mt-6">Jemima’s Maths Puzzle: <span id="mathStatus">Pending</span></div>

      <div class="mt-6">
        <div>Join Code: <code id="joinCode">----</code></div>
        <button id="copyCodeBtn" class="btn">Copy</button>
      </div>

      <div id="waitingOverlay" class="overlay hidden">
        <h2>WAITING FOR JAIME…</h2>
      </div>

      <div id="countdown" class="countdown hidden"></div>
    </div>
  `;

  // Start generation immediately
  startGeneration();

  document.getElementById("copyCodeBtn").addEventListener("click", () => {
    const code = document.getElementById("joinCode").textContent;
    navigator.clipboard.writeText(code);
    alert(`Copied: ${code}`);
  });
}

async function startGeneration() {
  const qGenerated = document.getElementById("qGenerated");
  const qVerified = document.getElementById("qVerified");
  const qRejected = document.getElementById("qRejected");
  const mathStatus = document.getElementById("mathStatus");
  const joinCodeEl = document.getElementById("joinCode");

  // Generate 30 questions
  const { questions, verified, rejected } = await generateQuestions(30);
  qGenerated.textContent = questions.length;
  qVerified.textContent = verified;
  qRejected.textContent = rejected;

  // Save to Firestore
  await setDoc(
    doc(state.db, "rooms", state.roomCode, "config", "questions"),
    { questions }
  );

  // Generate Jemima Maths puzzle
  const maths = await generateJemimaMaths();
  mathStatus.textContent = "Ready";

  await setDoc(
    doc(state.db, "rooms", state.roomCode, "config", "maths"),
    { maths }
  );

  // Display join code
  joinCodeEl.textContent = state.roomCode;

  // Wait for Jaime to join (stub: real-time listener)
  await new Promise((res) => setTimeout(res, 2000));

  // Start countdown
  runCountdown();
}

function runCountdown() {
  const el = document.getElementById("countdown");
  el.classList.remove("hidden");
  let t = 3;
  el.textContent = t;
  const int = setInterval(() => {
    t--;
    el.textContent = t;
    if (t < 0) {
      clearInterval(int);
      window.location.hash = "#round1"; // TODO: route to Round 1
    }
  }, 1000);
}
