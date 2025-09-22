export const state = {
  room: {
    code: '',
  },
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
    qJSON: true,       // empty = green per spec
    mathsJSON: true,   // empty = green
    firestoreJSON: false,
    codeFormatJSON: true // empty = green -> fallback to default
  }
};

export function setRoomCode(code){ state.room.code = code; }

export function setKeyRoomField(field, value){
  state.keyRoom[field] = value;
}