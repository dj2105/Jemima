import { state } from "../state.js";

export function RoleBadge() {
  const div = document.createElement("div");
  div.className = `role-badge ${state.self.toLowerCase()}`;
  div.textContent = `You are ${state.self}`;
  return div;
}
