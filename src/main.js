import { mountRoute } from './router.js';
import { state } from './state.js';

window.state = state;
window.addEventListener('hashchange', () => mountRoute());
window.addEventListener('load', () => {
  // Load envs (if any) into state; Key Room can override.
  try {
    const envFirebase = import.meta.env.VITE_FIREBASE_CONFIG;
    const envGemini = import.meta.env.VITE_GEMINI_API_KEY;
    if (envFirebase) state.runtime.firebaseEnvJSON = envFirebase;
    if (envGemini) state.runtime.geminiEnvKey = envGemini;
  } catch(_) {}
  mountRoute();
});
