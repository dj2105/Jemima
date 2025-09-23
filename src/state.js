// src/state.js
// Central app state + small mutators. No imports here.

export const state = {
  room: { code: "" },

  // Environment stubs (wired later)
  runtime: { geminiEnvKey: null, firebaseEnvJSON: null },

  // Key Room inputs
  keyRoom: { geminiKey: "", qJSON: "", mathsJSON: "", firestoreJSON: "", codeFormatJSON: "" },

  // Validation flags
  validation: {
    geminiKey: false,
    qJSON: true,
    mathsJSON: true,
    firestoreJSON: false,
    codeFormatJSON: true
  },

  // Progress (display only)
  generationProgress: { generated: 0, verified: 0, rejected: 0, mathsReady: false },

  // Questions per round (arrays of 3)
  round1Questions: null,
  round2Questions: null,
  round3Questions: null,
  round4Questions: null,
  round5Questions: null,

  // Local answers: answers[player][qid] = index (0 or 1)
  answers: { Daniel: {}, Jaime: {} },

  // Scores
  perceivedScores: { Daniel: 0, Jaime: 0 },

  // Flow
  currentRound: 1,
  phase: "question", // "question" | "marking" | "interlude" | "final"

  // Interludes after R1..R4
  interludes: { 2: null, 3: null, 4: null, 5: null },
  miniScores: { Daniel: 0, Jaime: 0 },

  // Big question (numeric)
  bigQuestionAnswer: 42,                 // stub; set real value later
  bigQuestionGuess: { Daniel: null, Jaime: null },

  // Who am I
  self: "Daniel",
  get opponent() { return this.self === "Daniel" ? "Jaime" : "Daniel"; }
};

// ---- Mutators / helpers ----
export function setRoomCode(code) { state.room.code = code; }
export function setKeyRoomField(field, value) { state.keyRoom[field] = value; }
export function setRoundQuestions(round, questions) { state[`round${round}Questions`] = questions; }
export function recordAnswer(qid, index) {
  const who = state.self;
  state.answers[who][qid] = index;
}
export function nextRound() {
  if (state.currentRound < 5) { state.currentRound++; state.phase = "question"; }
  else { state.phase = "final"; }
}
