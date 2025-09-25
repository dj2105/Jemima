// /src/router.js
// Strict hash router with safe fallback. Never falls back to Generation.

export function startRouter({ mount, initialView }) {
  const navigate = (hash) => { location.hash = hash; };

  async function fallback() {
    try {
      if (initialView) return initialView({ navigate });
    } catch {}
    const mod = await import('./views/Lobby.js');
    return mod.default({ navigate });
  }

  const routes = [
    // Lobby (default)
    {
      name: 'lobby',
      re: /^(?:#\/(?:lobby)?)?$/,
      load: async () => {
        const mod = await import('./views/Lobby.js');
        return mod.default({ navigate });
      }
    },

    // Host setup
    {
      name: 'key',
      re: /^#\/key$/,
      load: async () => {
        const mod = await import('./views/KeyRoom.js');
        return mod.default({ navigate });
      }
    },

    // Host generation page
    {
      name: 'generate',
      re: /^#\/(?:gen|generate)$/,
      load: async () => {
        const mod = await import('./views/Generation.js');
        return mod.default({ navigate });
      }
    },

    // Guest path: /join/CODE  (force role=guest and go to Generation watcher)
    {
      name: 'join',
      re: /^#\/join\/([A-Z0-9]{4,6})$/,
      load: async (_m, code) => {
        try {
          localStorage.setItem('lastGameCode', code.toUpperCase());
          localStorage.setItem('playerRole', 'guest');
        } catch {}
        const mod = await import('./views/Generation.js');
        return mod.default({ navigate });
      }
    },

    // Countdown → Q1
    {
      name: 'countdown',
      re: /^#\/countdown$/,
      load: async () => {
        const mod = await import('./views/Countdown.js');
        return mod.default({ navigate, nextHash: '#/q/1' });
      }
    },

    // ===== GAME ROUTES =====
    // Questions (Rounds 1–5)
    {
      name: 'question',
      re: /^#\/q\/([1-5])$/,
      load: async (_m, round) => {
        // If your file is named differently (e.g. Question.js), change the import path below.
        const mod = await import('./views/QuestionRoom.js');
        return mod.default({ navigate, round: Number(round) });
      }
    },

    // Marking (Rounds 1–5)
    {
      name: 'marking',
      re: /^#\/mark\/([1-5])$/,
      load: async (_m, round) => {
        const mod = await import('./views/MarkingRoom.js');
        return mod.default({ navigate, round: Number(round) });
      }
    },

    // Jemima interludes (after R1–R4)
    {
      name: 'interlude',
      re: /^#\/interlude\/([1-4])$/,
      load: async (_m, idx) => {
        const mod = await import('./views/Interlude.js');
        return mod.default({ navigate, idx: Number(idx) });
      }
    },

    // Final results
    {
      name: 'final',
      re: /^#\/final$/,
      load: async () => {
        const mod = await import('./views/FinalRoom.js');
        return mod.default({ navigate });
      }
    }
  ];

  async function render() {
    const h = location.hash || '#/';
    console.debug('[router] hash:', h);
    for (const r of routes) {
      const m = h.match(r.re);
      if (m) {
        console.debug('[router] match:', r.name, m.slice(1));
        try {
          const node = await r.load(m, ...(m.slice(1)));
          mount(node);
        } catch (e) {
          console.error('[router] load failed for', r.name, e);
          mount(await fallback());
        }
        return;
      }
    }
    console.warn('[router] no route matched; falling back to Lobby');
    mount(await fallback());
  }

  window.addEventListener('hashchange', render);
  render();
}
