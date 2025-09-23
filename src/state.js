// src/state.js
// App-wide state (consolidated playable MVP)
export const state = {
  room: { code: '' },

  // Runtime (env stubs for later Firebase/Gemini)
  runtime: {
    geminiEnvKey: null,
    firebaseEnvJSON: null
  },

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
    qJSON: true,       // empty = green
    mathsJSON: true,   // empty = green
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

  // Local answer store: answers[player][qid] = 0|1
  answers: {
    Daniel: {},
    Jaime: {}
  },

  // Perceived (from marking) & actual (computed at Final)
  perceivedScores: { Daniel: 0, Jaime: 0 },
  actualScores:    { Daniel: 0, Jaime: 0 },

  // Round / flow
  currentRound: 1,
  phase: "question",   // "question" | "marking" | "interlude" | "final"

  // Big question (parts after R1–R4; final numeric after R5)
  bigQuestionParts: [
    "Part 1: Stub text",
    "Part 2: Stub text",
    "Part 3: Stub text",
    "Part 4: Stub text"
  ],
  bigQuestionGuesses: { Daniel: null, Jaime: null },
  bigQuestionAnswer: 42, // stub; used for closest-wins at final

  // Interludes store (generated or picked from pack) after R1–R4
  interludes: { 2: null, 3: null, 4: null, 5: null },

  // Player identity
  self: "Daniel",
  get opponent() { return this.self === "Daniel" ? "Jaime" : "Daniel"; }
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

// record a chosen answer index for the current player
export function recordAnswer(qid, index) {
  const who = state.self;
  state.answers[who][qid] = index;
}

// compute actual scores from stored answers and correctIndex across rounds
export function computeActualScores() {
  const rounds = [1,2,3,4,5];
  const acc = { Daniel: 0, Jaime: 0 };

  for (const r of rounds) {
    const qs = state[`round${r}Questions`] || [];
    for (const q of qs) {
      if (typeof q.correctIndex !== "number") continue;
      const dPick = state.answers.Daniel[q.id];
      const jPick = state.answers.Jaime[q.id];
      if (dPick === q.correctIndex) acc.Daniel += 1;
      if (jPick === q.correctIndex) acc.Jaime  += 1;
    }
  }
  state.actualScores = acc;
}

// closest-wins for big question (+3; tie both +3)
export function scoreBigQuestion() {
  const ans = state.bigQuestionAnswer;
  const d = state.bigQuestionGuesses.Daniel;
  const j = state.bigQuestionGuesses.Jaime;
  if (typeof d !== "number" || typeof j !== "number") return; // nothing to do yet

  const dDelta = Math.abs(d - ans);
  const jDelta = Math.abs(j - ans);

  if (dDelta < jDelta) state.actualScores.Daniel += 3;
  else if (jDelta < dDelta) state.actualScores.Jaime += 3;
  else { // tie
    state.actualScores.Daniel += 3;
    state.actualScores.Jaime  += 3;
  }
}

export function nextRound() {
  if (state.currentRound < 5) {
    state.currentRound++;
    state.phase = "question";
  } else {
    state.phase = "final";
  }
}
