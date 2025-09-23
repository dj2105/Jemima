// src/state.js
// App-wide state (playable local MVP) — includes interludes + mini-scores + big question guesses
export const state = {
  // Room & runtime (future: Firestore/Gemini)
  room: { code: '' },
  runtime: { geminiEnvKey: null, firebaseEnvJSON: null },

  // Key Room inputs
  keyRoom: {
    geminiKey: '',
    qJSON: '',
    mathsJSON: '',
    firestoreJSON: '',
    codeFormatJSON: ''
  },

  // Validation flags
  validation: {
    geminiKey: false,
    qJSON: true,        // empty = green
    mathsJSON: true,    // empty = green
    firestoreJSON: false,
    codeFormatJSON: true
  },

  // Generation progress (display only for now)
  generationProgress: {
    generated: 0,
    verified: 0,
    rejected: 0,
    mathsReady: false
  },

  // Questions per round (arrays of 3 items)
  round1Questions: null,
  round2Questions: null,
  round3Questions: null,
  round4Questions: null,
  round5Questions: null,

  // Optional: opponent answers cache per round (used by some views)
  round1OpponentAnswers: null,

  // Local answer store: answers[player][qid] = index (0|1)
  answers: { Daniel: {}, Jaime: {} },

  // Scores
  perceivedScores: { Daniel: 0, Jaime: 0 }, // from marking
  actualScores:    { Daniel: 0, Jaime: 0 }, // computed at final

  // Round / flow
  currentRound: 1,
  phase: "question", // "question" | "marking" | "interlude" | "final"

  // Big question
  bigQuestionParts: [
    "Part 1: Stub text",
    "Part 2: Stub text",
    "Part 3: Stub text",
    "Part 4: Stub text"
  ],
  bigQuestionAnswer: null, // set later
  bigQuestionGuess: { Daniel: null, Jaime: null }, // numeric guesses after R5

  // Interludes store (shown after R1..R4 → interlude 2..5)
  interludes: { 2: null, 3: null, 4: null, 5: null },

  // Optional mini-scores for interludes (not part of main leaderboard)
  miniScores: { Daniel: 0, Jaime: 0 },

  // Player identity
  self: "Daniel",
  get opponent() { return this.self === "Daniel" ? "Jaime" : "Daniel"; }
};

// ---- Mutators / helpers ----
export function setRoomCode(code) {
  state.room.code = code;
}

export function setKeyRoomField(field, value) {
  state.keyRoom[field] = value;
}

export function setRoundQuestions(round, questions) {
  state[`round${round}Questions`] = questions;
}

export function recordAnswer(qid, index) {
  const who = state.self;
  state.answers[who][qid] = index;
}

export function nextRound() {
  if (state.currentRound < 5) {
    state.currentRound++;
    state.phase = "question";
  } else {
    state.phase = "final";
  }
}
