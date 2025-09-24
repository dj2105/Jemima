// /src/router.js
// Hash router with lazy imports for all views, including join/rejoin flows.

let _mount = null;

// ---------- helpers ----------
function navigate(hash) {
  if (!hash) return;
  location.hash = hash.startsWith('#') ? hash : `#${hash}`;
}
function scrollTop() {
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); }
}
function normHash() {
  let h = location.hash || '#/';
  if (!h.startsWith('#/')) h = '#/';
  return h;
}
function placeholder(title = 'Loading…', subtitle = '') {
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';
  const h1 = document.createElement('div');
  h1.className = 'panel-title accent-white';
  h1.textContent = title;
  const sub = document.createElement('div');
  sub.className = 'note';
  sub.textContent = subtitle;
  wrap.append(h1, sub);
  return wrap;
}
function setLS(k, v) { try { localStorage.setItem(k, v); } catch {} }
function getLS(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } }

// ---------- routes ----------
const routes = [
  {
    name: 'home',
    re: /^#\/$/,
    load: async () => {
      const mod = await import('./views/Lobby.js');
      return mod.default({ navigate });
    }
  },
  {
    name: 'key',
    re: /^#\/key$/,
    load: async () => {
      const mod = await import('./views/KeyRoom.js');
      return mod.default({ navigate });
    }
  },
  {
    // Joiner ALWAYS becomes guest and goes to Generation.
    name: 'join',
    re: /^#\/join\/([A-Z0-9]{4,10})$/,
    load: async ({ params }) => {
      const code = (params[0] || '').toUpperCase();
      if (code) setLS('lastGameCode', code);
      setLS('playerRole', 'guest');   // <-- force guest (fix for stale host role)
      navigate('#/gen');
      return placeholder('Joining…', `Room ${code}`);
    }
  },
    {
    name: 'join',
    re: /^#\/join\/([A-Z0-9]{4,10})$/,
    load: async ({ params }) => {
      const code = (params[0] || '').toUpperCase();
      if (code) localStorage.setItem('lastGameCode', code);
-     // If role not set yet, default to guest for safety.
-     if (!localStorage.getItem('playerRole')) localStorage.setItem('playerRole', 'guest');
+     // Always force guest on /join
+     localStorage.setItem('playerRole', 'guest');
      location.hash = '#/gen';
      return placeholder('Joining…', `Room ${code}`);
    }
  },
  {
    name: 'rejoin',
    re: /^#\/rejoin\/([A-Z0-9]{4,10})$/,
    load: async ({ params }) => {
      const code = (params[0] || '').toUpperCase();
      if (code) localStorage.setItem('lastGameCode', code);
-     // keep role as-is
+     // Default to guest if role missing (avoid stale 'host')
+     if (!localStorage.getItem('playerRole')) {
+       localStorage.setItem('playerRole', 'guest');
+     }
      location.hash = '#/gen';
      return placeholder('Rejoining…', `Room ${code}`);
    }
  },
  {
    name: 'countdown',
    re: /^#\/countdown$/,
    load: async () => {
      const mod = await import('./views/Countdown.js');
      return mod.default({ navigate, nextHash: '#/q/1' });
    }
  },
  {
    name: 'question',
    re: /^#\/q\/([1-5])$/,
    load: async ({ params }) => {
      const round = Number(params[0]);
      const mod = await import('./views/QuestionRoom.js');
      return mod.default({ navigate, round });
    }
  },
  {
    name: 'mark',
    re: /^#\/mark\/([1-5])$/,
    load: async ({ params }) => {
      const round = Number(params[0]);
      const mod = await import('./views/MarkingRoom.js');
      return mod.default({ navigate, round });
    }
  },
  {
    name: 'interlude',
    re: /^#\/interlude\/([1-4])$/,
    load: async ({ params }) => {
      const round = Number(params[0]);
      const mod = await import('./views/Interlude.js');
      return mod.default({ navigate, round });
    }
  },
  {
    name: 'jemima',
    re: /^#\/jemima$/,
    load: async () => {
      const mod = await import('./views/JemimaQuiz.js');
      return mod.default({ navigate });
    }
  },
  {
    name: 'final',
    re: /^#\/final$/,
    load: async () => {
      const mod = await import('./views/FinalResults.js');
      return mod.default({ navigate });
    }
  }
];

// ---------- core ----------
async function render() {
  const h = normHash();
  scrollTop();

  for (const r of routes) {
    const m = h.match(r.re);
    if (m) {
      try {
        _mount(placeholder('Loading…'));
        const node = await r.load({ params: m.slice(1) });
        _mount(node);
      } catch (err) {
        console.error('[router] route load failed', err);
        _mount(placeholder('Error', String((err && err.message) || err)));
      }
      return;
    }
  }

  // 404 → Lobby
  const mod = await import('./views/Lobby.js');
  _mount(mod.default({ navigate }));
}

// ---------- public API ----------
export function startRouter({ mount } = {}) {
  _mount = mount;
  if (!location.hash) location.hash = '#/';

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);

  render();
}
