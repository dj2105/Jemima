// /src/roomWatcher.js
// Watch a room doc and navigate on state changes.
// Ensures BOTH players jump appropriately.
// Mapping is aligned to the project FSM plus new award_rN state.

import { initFirebase, ensureAuth, db, doc, onSnapshot } from './lib/firebase.js';

function go(path) {
  const target = path.startsWith('#') ? path : '#' + path;
  if (location.hash !== target) location.hash = target;
}

export default async function watchRoom(code) {
  if (!code) return () => {};
  await initFirebase();
  await ensureAuth();

  const ref = doc(db, 'rooms', code.toUpperCase());

  const unsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const state = String(data.state || 'lobby');

    if (state === 'lobby') return;

    if (state === 'seeding') return go('/seeding');

    if (state.startsWith('countdown_r')) return go('/countdown');

    if (state.startsWith('questions_r')) return go('/questions');

    if (state.startsWith('marking_r')) return go('/marking');

    // NEW: award screen state
    if (state.startsWith('award_r')) return go('/award');

    if (state.startsWith('jclue_r')) return go('/interlude');

    if (state === 'maths_questions') return go('/maths');

    if (state === 'final') return go('/final');

    // Unknown/temporary states: do nothing
  }, (err) => {
    console.error('[roomWatcher] onSnapshot error:', err);
  });

  return unsub;
}
