// App-wide state (merged PR#1 + PR#2 + PR#3 + PR#5 + PR#9)
export const state = {
  room: { code: '' },
  runtime: {
    geminiEnvKey: null,
    firebaseEnvJSON: null
  },
  keyRoom: {
    geminiKey: '',
    qJSON: '',
    mathsJSON: '',
    firestoreJSON: '',
    codeFormatJSON: ''
  },
  validation: {
    geminiKey: false,
    qJSON: true,       // empty = green
    mathsJSON: true,   // empty = green
    firestoreJSON: false,
    codeFormatJSON: true
  },
  generationProgress: {
    generated: 0,
    verified: 0,
    rejected: 0,
    mathsReady: false
  },

  round1Questions: null,
  round2Questions: null,
  round3Questions: null,
  round4Questions: null,
  round5Questions: null,
  round1OpponentAnswers: null,
  perceivedScores: { Daniel: 0, Jaime: 0 },

  // Round / big question
  currentRound: 1,
  phase: "question",   // "question" | "marking" | "final"
  bigQuestionParts: [
    "Part 1: Stub text",
    "Part 2: Stub text",
    "Part 3: Stub text",
    "Part 4: Stub text"
  ],
  bigQuestionAnswer: null,

  // PR #9: player roles
  self: "Daniel",
  get opponent() {
    return this.self === "Daniel" ? "Jaime" : "Daniel";
  }
};

// --- Mutators / helpers ---
export function setRoomCode(code) {
  state.room.code = code;
}

export function setKeyRoomField(field, value) {
  state.keyRoom[field] = value;
}

export function setRoundQuestions(round, questions) {
  state[`round${round}Questions`] = questions;
}

export function nextRound() {
  if (state.currentRound < 5) {
    state.currentRound++;
    state.phase = "question";
  } else {
    state.phase = "final";
  }
}
