// src/views/FinalRoom.js
import { state } from "../state.js";

export function FinalRoom() {
  const root = document.createElement("div");
  root.className = "wrap";
  const perceivedDaniel = state.perceivedScores?.Daniel ?? 0;
  const perceivedJaime  = state.perceivedScores?.Jaime  ?? 0;

  root.innerHTML = `
    <div class="h1">Final Scores</div>
    <div class="panel">
      <p class="p">Perceived scores (from marking):</p>
      <div class="row" style="gap:18px; align-items:center; flex-wrap:wrap">
        <div class="badge daniel">Daniel</div>
        <strong id="perc-daniel" style="font-size:22px">${perceivedDaniel}</strong>
      </div>
      <div class="gap"></div>
      <div class="row" style="gap:18px; align-items:center; flex-wrap:wrap">
        <div class="badge jaime">Jaime</div>
        <strong id="perc-jaime" style="font-size:22px">${perceivedJaime}</strong>
      </div>

      <div class="divider"></div>

      <p class="p">Actual scores will be revealed here with animation in a later PR.</p>
      <button id="revealBtn" class="btn">Reveal Actual Scores (stub)</button>

      <div id="revealBox" class="hidden" style="margin-top:16px">
        <div class="row" style="gap:18px; align-items:center; flex-wrap:wrap">
          <div class="badge daniel">Daniel</div>
          <strong id="actual-daniel" style="font-size:26px">—</strong>
        </div>
        <div class="gap"></div>
        <div class="row" style="gap:18px; align-items:center; flex-wrap:wrap">
          <div class="badge jaime">Jaime</div>
          <strong id="actual-jaime" style="font-size:26px">—</strong>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#revealBtn').addEventListener('click', () => {
    // Stub: just mirror perceived as actual for now
    const box = root.querySelector('#revealBox');
    box.classList.remove('hidden');
    root.querySelector('#actual-daniel').textContent = String(perceivedDaniel);
    root.querySelector('#actual-jaime').textContent  = String(perceivedJaime);
  });

  return root;
}
