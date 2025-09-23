// App-wide state (merged PR#1 + PR#2 + PR#3 + PR#5)
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
  round1OpponentAnswers: null,
  perceivedScores: { Daniel: 0, Jaime: 0 },

  // ✅ PR #5 additions
  currentRound: 1,
  phase: "question",   // "question" | "marking" | "final"
  bigQuestionParts: [
    "Part 1: Stub text",
    "Part 2: Stub text",
    "Part 3: Stub text",
    "Part 4: Stub text"
  ],
  bigQuestionAnswer: null
};

export function setRoomCode(code) {
  state.room.code = code;
}

export function setKeyRoomField(field, value) {
  state.keyRoom[field] = value;
}

export function setRound1Questions(questions) {
  state.round1Questions = questions;
}
