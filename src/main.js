// /src/main.js
// App entry: load global styles, mount initial view (Lobby).
// Router will be added next; this file already supports swapping to it.

import './styles.css';
import Lobby from './views/Lobby.js';

const app = document.getElementById('app');

// Simple mount helper
function mount(node){
  app.innerHTML = '';
  app.appendChild(node);
}

// Normalise legacy/alias hashes (e.g., '#/mark/3' -> '#/marking/3')
function normaliseHashOnce() {
  const h = location.hash || '';
  const m = h.match(/^#\/mark\/(\d)$/);
  if (m) {
    const target = `#/marking/${m[1]}`;
    if (h !== target) {
      location.replace(target);
      return true; // changed
    }
  }
  return false;
}

// Run now and also on future hash changes before the router processes them
normaliseHashOnce();
window.addEventListener('hashchange', () => {
  if (normaliseHashOnce()) return;
});

// Try to use router (if present). If it fails, show Lobby so nothing breaks.
(async function start(){
  document.title = "Jemima’s Asking";

  try {
    const mod = await import('./router.js'); // will exist next step
    if (mod && typeof mod.startRouter === 'function') {
      mod.startRouter({ mount, initialView: Lobby });
      return;
    }
  } catch {
    // no router yet — fall back to Lobby
  }

  // Fallback render (no routing yet)
  mount(Lobby({ navigate: (hash) => { location.hash = hash; } }));
})();
