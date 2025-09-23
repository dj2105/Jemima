// src/lib/firebase.js
// Stubbed Firebase helpers so the game runs locally without errors.
// Replace with real Firestore integration later.

export async function setDoc(...args) {
  console.log("[firebase:setDoc]", ...args);
  return Promise.resolve();
}

export function doc(...args) {
  console.log("[firebase:doc]", ...args);
  return {};
}

export function markReady({ roomCode, round, phase, player }) {
  console.log(`[firebase:markReady] ${roomCode} R${round} ${phase} by ${player}`);
}

export function subscribeReady({ roomCode, round, phase }, cb) {
  console.log(`[firebase:subscribeReady] ${roomCode} R${round} ${phase}`);
  // For local MVP, just simulate both ready after short delay
  setTimeout(() => {
    cb({ Daniel: true, Jaime: true });
  }, 800);
}
