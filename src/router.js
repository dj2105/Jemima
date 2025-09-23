import { Lobby } from "./views/Lobby.js";
import { KeyRoom } from "./views/KeyRoom.js";
import { GenerationRoom } from "./views/GenerationRoom.js";
import { QuestionRoom } from "./views/QuestionRoom.js";
import { MarkingRoom } from "./views/MarkingRoom.js";

const routes = {
  "": Lobby,
  "#lobby": Lobby,
  "#key": KeyRoom,
  "#generation": GenerationRoom,
  "#round1": QuestionRoom,
  "#marking1": MarkingRoom
};

export function router() {
  const view = routes[location.hash] || Lobby;
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(view());
}

// ✅ Export alias so main.js import works
export function mountRoute() {
  router();
}
window.addEventListener("hashchange", () => {
  router();
});

// Call once on load
router();
