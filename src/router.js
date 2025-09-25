// /src/router.js
// Minimal hash router with strict route order and safe fallbacks.

export function startRouter({ mount, initialView }) {
  const navigate = (hash) => { location.hash = hash; };

  const routes = [
    {
      name: 'lobby',
      re: /^(?:#\/(?:lobby)?)?$/,
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
    // Generation (host path) and join (guest path) both land here.
    {
      name: 'generate',
      re: /^#\/(?:gen|generate)$/,
      load: async () => {
        const mod = await import('./views/Generation.js');
        return mod.default({ navigate });
      }
    },
    {
      name: 'join',
      re: /^#\/join\/([A-Z0-9]{4,6})$/,
      load: async (_m, code) => {
        try {
          localStorage.setItem('lastGameCode', code.toUpperCase());
          localStorage.setItem('playerRole', 'guest'); // force guest
        } catch {}
        const mod = await import('./views/Generation.js'); // guest watches host
        return mod.default({ navigate });
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
    // ------- GAME ROUTES -------
    {
      name: 'question',
      re: /^#\/q\/([1-5])$/,
      load: async (_m, round) => {
        const mod = await import('./views/QuestionRoom.js'); // <-- IMPORTANT
        return mod.default({ navigate, round: Number(round) });
      }
    },
    {
      name: 'marking',
      re: /^#\/mark\/([1-5])$/,
      load: async (_m, round) => {
        const mod = await import('./views/MarkingRoom.js');
        return mod.default({ navigate, round: Number(round) });
      }
    },
    {
      name: 'interlude',
      re: /^#\/interlude\/([1-4])$/,
      load: async (_m, idx) => {
        const mod = await import('./views/Interlude.js');
        return mod.default({ navigate, idx: Number(idx) });
      }
    },
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
    for (const r of routes) {
      const m = h.match(r.re);
      if (m) {
        const node = await r.load(m, ...(m.slice(1)));
        mount(node);
        return;
      }
    }
    // Fallback: Lobby (never Generation)
    if (initialView) {
      mount(initialView({ navigate }));
      return;
    }
    const mod = await import('./views/Lobby.js');
    mount(mod.default({ navigate }));
  }

  window.addEventListener('hashchange', render);
  render();
}
