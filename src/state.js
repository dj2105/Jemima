// App-wide state (merged PR#1 + PR#2)
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
  // PR#2 progress
  generationProgress: {
    generated: 0,
    verified: 0,
    rejected: 0,
    mathsReady: false
  }
};

export function setRoomCode(code){ state.room.code = code; }
