// /src/main.js
// Static absolute imports (no dynamic import quirks).
// Per-tab state isolation (so host & guest can use two windows).
// Minimal router + watcher bootstrap + friendly error panels.

//////////////// ABSOLUTE STATIC IMPORTS //////////////////
import { initFirebase, ensureAuth } from '/src/lib/firebase.js';
import watchRoom   from '/src/roomWatcher.js';

import Lobby      from '/src/views/Lobby.js';
import KeyRoom    from '/src/views/KeyRoom.js';
import Seed       from '/src/views/SeedProgress.js';
import Countdown  from '/src/views/Countdown.js';
import Questions  from '/src/views/Questions.js';
import Marking    from '/src/views/Marking.js';
import Award      from '/src/views/Award.js';
import Interlude  from '/src/views/Interlude.js';
import Maths      from '/src/views/Maths.js';
import Final      from '/src/views/Final.js';

//////////////// PER-TAB STATE (host/guest in separate windows) ////////
(function isolateRoomKeysPerTab(){
  const ROOM_KEYS = new Set(['lastGameCode', 'playerRole']);
  const _get = window.localStorage.getItem.bind(window.localStorage);
  const _set = window.localStorage.setItem.bind(window.localStorage);
  const _rem = window.localStorage.removeItem.bind(window.localStorage);
  window.localStorage.getItem = (k) => ROOM_KEYS.has(k) ? sessionStorage.getItem(k) : _get(k);
  window.localStorage.setItem = (k, v) => ROOM_KEYS.has(k) ? sessionStorage.setItem(k, v) : _set(k, v);
  window.localStorage.removeItem = (k) => ROOM_KEYS.has(k) ? sessionStorage.removeItem(k) : _rem(k);
})();

//////////////// MOUNT + ERROR UI /////////////////////////
const app = document.getElementById('app');
let currentView = null;
let currentUnsub = null;

function mount(el){
  if (currentView && typeof currentView.$destroy === 'function') {
    try { currentView.$destroy(); } catch {}
  }
  app.innerHTML = '';
  app.appendChild(el);
  currentView = el;
}

function showError(message){
  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>VIEW LOAD ERROR</h2>
    <p class="status" style="white-space:pre-wrap;">${message}</p>
    <p><a href="#/lobby">Back to Lobby</a></p>`;
  mount(el);
  console.error(message);
}

//////////////// ROUTER /////////////////////////////////
const ROUTES = {
  '/lobby':     Lobby,
  '/keyroom':   KeyRoom,
  '/seeding':   Seed,
  '/countdown': Countdown,
  '/questions': Questions,
  '/marking':   Marking,
  '/award':     Award,
  '/interlude': Interlude,
  '/maths':     Maths,
  '/final':     Final,
};

function normalizeHash(h){ if (!h || h === '#' || h === '#/') return '/lobby'; return h.replace(/^#/, ''); }

async function loadView(path){
  const View = ROUTES[path];
  if (!View) return showError(`This route (${path}) isn’t registered.`);
  try {
    const ctx = { navigate: (hash) => { location.hash = hash; } };
    const el = View(ctx);
    if (!(el instanceof HTMLElement)) return showError(`View at ${path} did not return a DOM element.`);
    mount(el);
  } catch (err) {
    showError(`Could not render ${path}:\n${err?.message || err}`);
  }
}

async function manageWatcherForPath(path){
  if (typeof currentUnsub === 'function') { try { currentUnsub(); } catch {} currentUnsub = null; }
  if (path === '/lobby' || path === '/keyroom') return;

  const code = (localStorage.getItem('lastGameCode') || '').toUpperCase();
  if (!code) return;

  try {
    const unsub = await watchRoom(code);
    if (typeof unsub === 'function') currentUnsub = unsub;
  } catch (e) {
    console.warn('[main] watcher error:', e);
  }
}

async function router(){
  const path = normalizeHash(location.hash);
  await loadView(path);
  await manageWatcherForPath(path);
}

//////////////// BOOT /////////////////////////////////
(async function boot(){
  try {
    await initFirebase();
    await ensureAuth();
  } catch (e) {
    return showError('Firebase boot failed:\n' + (e?.message || e));
  }

  if (!location.hash) location.hash = '#/lobby';
  router();
  window.addEventListener('hashchange', router);
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'lastGameCode') manageWatcherForPath(normalizeHash(location.hash));
  });
})();
