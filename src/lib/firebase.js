// Placeholder: reads config now; Firestore wiring arrives in PR #2.
import { loadLocal } from './localStore.js';

export function getFirebaseConfig(){
  // Priority: env → Key Room pasted → saved local
  let envJSON = import.meta.env.VITE_FIREBASE_CONFIG || '';
  let fromEnv = null;
  try{ if (envJSON) fromEnv = JSON.parse(envJSON); }catch{ fromEnv = null; }

  const saved = loadLocal('keyroom') || {};
  let pasted = null;
  try{ if (saved.firestoreJSON) pasted = JSON.parse(saved.firestoreJSON); }catch{ pasted = null; }

  return pasted || fromEnv || null;
}