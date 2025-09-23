// src/views/FinalRoom.js
export function FinalRoom() {
  const div = document.createElement("div");
  div.className = "wrap";
  div.innerHTML = `
    <div class="h1">Final Scores</div>
    <p>This is a placeholder Final Room. We'll implement the reveal later.</p>
  `;
  return div;
}
