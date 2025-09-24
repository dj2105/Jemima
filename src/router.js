// /src/router.js
// Hash router with real screens wired: Lobby, KeyRoom, Generation, Countdown,
// QuestionRoom, MarkingRoom, Interlude, JemimaQuiz, FinalResults.

let _mount = null;

/* ---------- Helpers ---------- */

function normalizeHash() {
  const h = location.hash || '#/';
  if (!h.startsWith('#/')) {
    location.hash = h.replace(/^#?/, '#/');
    return location.hash;
  }
  return h;
}
function scrollTop() {
  try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { window.scrollTo(0,0); }
}
function ctxNavigate(hash) {
  if (typeof hash !== 'string' || !hash.length) return;
  location.hash = hash.startsWith('#') ? hash : `#${hash}`;
}

/* ---------- Fallback placeholder ---------- */

function Placeholder({ title = 'Screen', subtitle = '', action = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';

  const box = document.createElement('div');
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';
  box.style.textAlign = 'center';

  const h1 = document.createElement('div');
  h1.className = 'panel-title accent-white';
  h1.style.marginBottom = '8px';
  h1.textContent = title;

  const sub = document.createElement('div');
  sub.className = 'note';
  sub.style.marginBottom = '18px';
  sub.textContent = subtitle;

  const row = document.createElement('div');
  row.className = 'btn-row';
  row.style.justifyContent = 'center';

  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.addEventListener('click', () => { if (typeof action === 'function') action(); });

  row.appendChild(btn);
  box.append(h1, sub, row);
  wrap.appendChild(box);
  return wrap;
}

/* ---------- Route table ---------- */

const routes = [
  {
    name: 'lobby',
    re: /^#\/$/,
    load: async () => {
      const mod = await import('./views/Lobby.js');
      return mod.default({ navigate: ctxNavigate });
    }
  },
  {
    name: 'key',
    re: /^#\/key$/,
    load: async () => {
      const mod = await import('./views/KeyRoom.js');
      return mod.default({ navigate: ctxNavigate });
    }
  },
  {
    name: 'join',
    re: /^#\/join\/([A-Z0-9]{4,10})$/,
    load: ({ params }) =>
      Placeholder({
        title: `JOIN: ${params[0]}`,
        subtitle: 'Waiting to connect…',
        action: () => ctxNavigate('#/gen')
      })
  },
  {
    name: 'rejoin',
    re: /^#\/rejoin\/([A-Z0-9]{4,10})$/,
    load: ({ params }) =>
      Placeholder({
        title: `REJOIN: ${params[0]}`,
        subtitle: 'Re-entering room…',
        action: () => ctxNavigate('#/gen')
      })
  },
  {
    name: 'generation',
    re: /^#\/gen$/,
    load: async () => {
      const mod = await import('./views/Generation.js');
      return mod.default({ navigate: ctxNavigate });
    }
  },
  {
    name: 'countdown',
    re: /^#\/countdown$/,
    load: async () => {
      const mod = await import('./views/Countdown.js');
      return mod.default({ navigate: ctxNavigate, nextHash: '#/q/1' });
    }
  },
  {
    name: 'question',
    re: /^#\/q\/([1-5])$/,
    load: async ({ params }) => {
      const round = Number(params[0]);
      const mod = await import('./views/QuestionRoom.js');
      return mod.default({ navigate: ctxNavigate, round });
    }
  },
  {
    name: 'marking',
    re: /^#\/mark\/([1-5])$/,
    load: async ({ params }) => {
      const round = Number(params[0]);
      const mod = await import('./views/MarkingRoom.js');
      return mod.default({ navigate: ctxNavigate, round });
    }
  },
  {
    name: 'interlude',
    re: /^#\/interlude\/([1-4])$/,
    load: async ({ params }) => {
      const round = Number(params[0]);
      const mod = await import('./views/Interlude.js');
      return mod.default({ navigate: ctxNavigate, round });
    }
  },
  {
    name: 'jemima-quiz',
    re: /^#\/jemima$/,
    load: async () => {
      const mod = await import('./views/JemimaQuiz.js');
      return mod.default({ navigate: ctxNavigate });
    }
  },
  {
    name: 'final',
    re: /^#\/final$/,
    load: async () => {
      const mod = await import('./views/FinalResults.js').catch(() => null);
      if (mod && mod.default) return mod.default({ navigate: ctxNavigate });
      return Placeholder({
        title: 'FINAL RESULTS',
        subtitle: 'Totals & winner.',
        action: () => ctxNavigate('#/')
      });
    }
  },
  {
    name: 'error',
    re: /^#\/error$/,
    load: () =>
      Placeholder({
        title: 'ERROR',
        subtitle: 'Something went wrong.',
        action: () => ctxNavigate('#/')
      })
  }
];

/* ---------- Core matcher ---------- */

async function renderFromHash() {
  const hash = normalizeHash();
  scrollTop();

  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      const node = await r.load({ params: m.slice(1) });
      _mount?.(node);
      return;
    }
  }

  _mount?.(
    Placeholder({
      title: 'Not Found',
      subtitle: `Unknown route: ${hash}`,
      action: () => ctxNavigate('#/')
    })
  );
}

/* ---------- Public API ---------- */

export function startRouter({ mount } = {}) {
  _mount = mount;
  if (!location.hash) location.hash = '#/';

  window.addEventListener('hashchange', renderFromHash);
  window.addEventListener('DOMContentLoaded', renderFromHash);

  renderFromHash();
}
