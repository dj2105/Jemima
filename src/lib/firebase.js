// Minimal sync layer for "both ready" without Firebase SDK.
// Later, swap internals for Firestore but keep the same API.

const CH_NAME = 'jemimas-asking-sync-v1';

function bcSend(payload){
  try {
    if (!window.__JA_BC) {
      window.__JA_BC = new BroadcastChannel(CH_NAME);
    }
    window.__JA_BC.postMessage(payload);
  } catch(_) {
    // Fallback: dispatchEvent
    window.dispatchEvent(new CustomEvent(CH_NAME, { detail: payload }));
  }
}

function bcOnMessage(cb){
  try {
    if (!window.__JA_BC) {
      window.__JA_BC = new BroadcastChannel(CH_NAME);
    }
    window.__JA_BC.onmessage = (e) => cb(e.data);
  } catch(_) {
    window.addEventListener(CH_NAME, (e)=>cb(e.detail));
  }
}

// In-memory room map for this browser (build-friendly stub)
const mem = {
  rooms: {} // code -> { ready: { round: { phase: { Daniel:bool, Jaime:bool } } } }
};

function ensureNode(code, round, phase){
  mem.rooms[code] ||= { ready:{} };
  mem.rooms[code].ready[round] ||= {};
  mem.rooms[code].ready[round][phase] ||= { Daniel:false, Jaime:false };
  return mem.rooms[code].ready[round][phase];
}

// ---- Public API (mirror Firestore-ish naming) ----

export async function markReady({ roomCode, round, phase, player }){
  const node = ensureNode(roomCode, round, phase);
  node[player] = true;

  // broadcast
  bcSend({ type:'ready', roomCode, round, phase, player, value:true });
}

export function subscribeReady({ roomCode, round, phase }, cb){
  // Emit current snapshot first (best effort)
  const node = ensureNode(roomCode, round, phase);
  setTimeout(()=> cb({ ...node }), 0);

  // Listen to future changes
  const off = () => { /* we don’t need to detach in stub */ };
  bcOnMessage((msg)=>{
    if (!msg || msg.type!=='ready') return;
    if (msg.roomCode!==roomCode || msg.round!==round || msg.phase!==phase) return;
    const n = ensureNode(roomCode, round, phase);
    n[msg.player] = !!msg.value;
    cb({ ...n });
  });
  return off;
}

// Stubs retained from earlier PRs so imports don’t break:
export async function setDoc(ref, data){ console.log('Firestore setDoc (stub)', ref, data); }
export function doc(_db, ...path){ return path.join('/'); }
