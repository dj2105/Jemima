// /src/main.js
// Minimal hash router + view loader for Jemima’s Asking

const routes = {
  '/lobby': () => loadView('/src/views/Lobby.js', fallbackLobby),
  '/keyroom': () => loadView('/src/views/KeyRoom.js', notImplemented('Key Room')),
  '/countdown': () => loadView('/src/views/Countdown.js', notImplemented('Countdown')),
  '/questions': () => loadView('/src/views/QuestionRoom.js', notImplemented('Question Room')),
  '/marking': () => loadView('/src/views/MarkingRoom.js', notImplemented('Marking Room')),
  '/interlude': () => loadView('/src/views/Interlude.js', notImplemented('Interlude')),
  '/maths': () => loadView('/src/views/MathsRoom.js', notImplemented('Maths Room')),
  '/final': () => loadView('/src/views/FinalRoom.js', notImplemented('Final Room')),
};

const appEl = document.getElementById('app');

function setView(el) {
  appEl.innerHTML = '';
  appEl.appendChild(el);
}

async function loadView(path, fallbackFactory) {
  try {
    const mod = await import(path);
    if (typeof mod.default !== 'function') throw new Error('View has no default export function.');
    const el = mod.default({ navigate });
    setView(el);
  } catch (err) {
    console.warn(`Could not load ${path}:`, err);
    const el = fallbackFactory(err);
    setView(el);
  }
}

function navigate(hash) {
  if (!hash.startsWith('#/')) hash = '#/lobby';
  if (location.hash !== hash) location.hash = hash;
  // when hash actually changes, router() will be called by the event listener
  // if it hasn't changed (same route), call router() manually
  if (location.hash === hash) router();
}

function router() {
  const hash = location.hash || '#/lobby';
  const path = hash.replace(/^#/, '');
  const handler = routes[path] || routes['/lobby'];
  handler();
}

// --- Fallback view factories (keep the app usable before views exist) ---

function panel(title, bodyHTML) {
  const s = document.createElement('section');
  s.className = 'panel';
  s.innerHTML = `<h2>${title}</h2>${bodyHTML}`;
  return s;
}

function fallbackLobby() {
  const el = panel('Lobby (placeholder)', `
    <p>This is a temporary Lobby so you can see the app working.</p>
    <div class="row" style="gap:0.5rem;flex-wrap:wrap;">
      <button id="host">I’m Host</button>
      <button id="guest">I’m Guest</button>
      <button id="keyroom" class="primary">Go to Key Room</button>
    </div>
    <p class="status">Replace this with <code>/src/views/Lobby.js</code> soon.</p>
  `);
  el.querySelector('#host').addEventListener('click', () => {
    try { localStorage.setItem('playerRole', 'host'); } catch {}
    alert('Role set to Host. Next, go to Key Room.');
  });
  el.querySelector('#guest').addEventListener('click', () => {
    try { localStorage.setItem('playerRole', 'guest'); } catch {}
    alert('Role set to Guest. Waiting for a host to start.');
  });
  el.querySelector('#keyroom').addEventListener('click', () => navigate('#/keyroom'));
  return el;
}

function notImplemented(name) {
  return () => panel(`${name}`, `
    <p>This view isn’t created yet.</p>
    <p>Create <code>${name.replace(/\s+/g,'')}</code> as <code>/src/views/${name.replace(/\s+/g,'')}.js</code> exporting <code>default function(ctx){...}</code>.</p>
    <p><a href="#/lobby">Back to Lobby</a></p>
  `);
}

// --- Wire up hashchange & initial route ---
window.addEventListener('hashchange', router);
if (!location.hash) location.hash = '#/lobby';
router();
