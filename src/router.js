import { Lobby } from './views/Lobby.js';
import { KeyRoom } from './views/KeyRoom.js';
import { GenerationRoom } from './views/GenerationRoom.js';

const routes = {
  '/': Lobby,
  '/lobby': Lobby,
  '/key': KeyRoom,
  '/gen': GenerationRoom
};

export function mountRoute(){
  const path = (location.hash.replace('#','') || '/').split('?')[0];
  const View = routes[path] || Lobby;
  const app = document.getElementById('app');
  app.innerHTML = '';
  const el = View();
  app.appendChild(el);
}