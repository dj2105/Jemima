import { Lobby } from "./views/Lobby.js";
import { KeyRoom } from "./views/KeyRoom.js";
import { GenerationRoom } from "./views/GenerationRoom.js";
import { QuestionRoom } from "./views/QuestionRoom.js";

const routes = {
  "": Lobby,
  "#lobby": Lobby,
  "#key": KeyRoom,
  "#generation": GenerationRoom,
  "#round1": QuestionRoom   // NEW
};

export function router() {
  const view = routes[location.hash] || Lobby;
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(view());
}
