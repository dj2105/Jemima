// /src/router.js
// Minimal, explicit hash router for Jemima’s Asking with full route coverage.
// Uses dynamic imports for views. Stores/resolves a "next route" for Countdown.
// All routes return a DOM node to mount.

export function startRouter({ mount, initialView } = {}) {
  const navigate = (hash) => { location.hash = hash; };

  // Helper: safely parse hash and match a route
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

    // Key Room (host enters keys/config)
    {
      name: 'key',
      re: /^#\/key$/,
      load: async () => {
        const mod = await import('./views/KeyRoom.js');
        return mod.default({ navigate });
      }
    },

    // Host-only generation (guests watch progress)
    {
      name: 'generate',
      re: /^#\/generate$/,
      load: async () => {
        const mod = await import('./views/Generation.js');
        return mod.default({ navigate });
      }
    },

    // Countdown — both players resynchronise here.
    // It reads localStorage.nextRoute (set by the prior screen) and advances.
    {
      name: 'countdown',
      re: /^#\/countdown$/,
      load: async () => {
        const mod = await import('./views/Countdown.js');
        return mod.default({ navigate });
      }
    },

    // Questions Phase (offline): round 1–5
    {
      name: 'round',
      re: /^#\/round\/([1-5])$/,
      load: async (_m, roundStr) => {
        const mod = await import('./views/QuestionRoom.js');
        return mod.default({ navigate, round: Number(roundStr) });
      }
    },

    // Marking Phase (offline): round 1–5
    {
      name: 'marking',
      re: /^#\/marking\/([1-5])$/,
      load: async (_m, roundStr) => {
        const mod = await import('./views/MarkingRoom.js');
        return mod.default({ navigate, round: Number(roundStr) });
      }
    },

    // Interludes: after Rounds 1–4
    {
      name: 'interlude',
      re: /^#\/interlude\/([1-4])$/,
      load: async (_m, idxStr) => {
        const mod = await import('./views/Interlude.js');
        return mod.default({ navigate, idx: Number(idxStr) });
      }
    },

    // Jemima’s two maths questions (after Round 5 marking)
    {
      name: 'jemima',
      re: /^#\/jemima$/,
      load: async () => {
        const mod = await import('./views/JemimaQuiz.js');
        return mod.default({ navigate });
      }
    },

    // Final Room (perceived vs actual scores)
    {
      name: 'final',
      re: /^#\/final$/,
      load: async () => {
        const mod = await import('./views/FinalRoom.js');
        return mod.default({ navigate });
      }
    },

    // Optional: rejoin route with code
    {
      name: 'rejoin',
      re: /^#\/rejoin\/([A-Z0-9]{4,10})$/,
      load: async (_m, code) => {
        // Persist code and bounce to Lobby (or wherever you prefer)
        try { localStorage.setItem('lastGameCode', code.toUpperCase()); } catch {}
        const mod = await import('./views/Lobby.js');
        return mod.default({ navigate });
      }
    }
  ];

  function matchRoute(hash) {
    for (const r of routes) {
      const m = hash.match(r.re);
      if (m) return { route: r, match: m };
    }
    return null;
  }

  async function render() {
    const hash = location.hash || '#/';
    const m = matchRoute(hash);

    // First render: allow an injected initialView override (tests/dev)
    if (!m) {
      if (initialView) {
        mount(initialView({ navigate }));
        return;
      }
      const mod = await import('./views/Lobby.js');
      mount(mod.default({ navigate }));
      return;
    }

    try {
      const vnode = await m.route.load(m.match[0], ...m.match.slice(1));
      mount(vnode);
    } catch (err) {
      // Fallback hard to Lobby if a view fails to load
      console.error('[router] Failed to load route', m.route?.name, err);
      const mod = await import('./views/Lobby.js');
      mount(mod.default({ navigate }));
    }
  }

  window.addEventListener('hashchange', render);
  render();
}
