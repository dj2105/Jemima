import { Lobby } from "./views/Lobby.js";
import { KeyRoom } from "./views/KeyRoom.js";
import { GenerationRoom } from "./views/GenerationRoom.js";
import { QuestionRoom } from "./views/QuestionRoom.js";
import { MarkingRoom } from "./views/MarkingRoom.js";
import { FinalRoom } from "./views/FinalRoom.js"; // will come in PR #6

const routes = {
  "": Lobby,
  "#lobby": Lobby,
  "#key": KeyRoom,
  "#generation": GenerationRoom,
  "#round1": QuestionRoom,
  "#marking1": MarkingRoom,
  "#round2": QuestionRoom,
  "#marking2": MarkingRoom,
  "#round3": QuestionRoom,
  "#marking3": MarkingRoom,
  "#round4": QuestionRoom,
  "#marking4": MarkingRoom,
  "#round5": QuestionRoom,
  "#marking5": MarkingRoom,
  "#final": FinalRoom
};

export function router() {
  const view = routes[location.hash] || Lobby;
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(view());
}

export function mountRoute() { router(); }
window.addEventListener("hashchange", router);
router();
