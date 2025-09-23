// App-wide state (merged PR#1 + PR#2 + PR#3)
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
  round1Questions: null
};

export function setRoomCode(code) {
  state.room.code = code;
}

export function setKeyRoomField(field, value) {
  state.keyRoom[field] = value;
}

// ✅ New helper for Round 1
export function setRound1Questions(questions) {
  state.round1Questions = questions;
}
