// src/router.js
import { Lobby } from "./views/Lobby.js";
import { KeyRoom } from "./views/KeyRoom.js";
import { GenerationRoom } from "./views/GenerationRoom.js";
import { QuestionRoom } from "./views/QuestionRoom.js";
import { MarkingRoom } from "./views/MarkingRoom.js";
import { Interlude } from "./views/Interlude.js";
import { FinalRoom } from "./views/FinalRoom.js";

const routes = {
  "": Lobby,
  "#lobby": Lobby,
  "#key": KeyRoom,
  "#generation": GenerationRoom,

  // Rounds
  "#round1": QuestionRoom,
  "#round2": QuestionRoom,
  "#round3": QuestionRoom,
  "#round4": QuestionRoom,
  "#round5": QuestionRoom,

  // Marking
  "#marking1": MarkingRoom,
  "#marking2": MarkingRoom,
  "#marking3": MarkingRoom,
  "#marking4": MarkingRoom,
  "#marking5": MarkingRoom,

  // Interludes (after R1..R4)
  "#interlude2": Interlude,
  "#interlude3": Interlude,
  "#interlude4": Interlude,
  "#interlude5": Interlude,

  // Final
  "#final": FinalRoom
};

export function router() {
  const view = routes[location.hash] || Lobby;
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(view());
}

// ✅ export the symbol main.js imports
export function mountRoute() {
  router();
}

window.addEventListener("hashchange", router);
// First render
router();
