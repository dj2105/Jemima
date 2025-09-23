// App-wide state
export const state = {
  db: null,
  roomCode: "EH6W", // stub until generated
  generationProgress: {
    generated: 0,
    verified: 0,
    rejected: 0,
    mathsReady: false
  }
};
