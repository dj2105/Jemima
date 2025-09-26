// /src/views/KeyRoom.js
import { initFirebase, ensureAuth, db, doc, setDoc, getDoc } from '../lib/firebase.js';

export default function KeyRoom(ctx = {}) {
  console.log('[KeyRoom] module loaded');

  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Key Room — Configure Game</h2>
    <p class="status">Room: <strong id="roomCode">(loading)</strong></p>

    <section class="panel">
      <h3>Quiz Questions Spec (qcfg)</h3>
      <textarea id="qcfgInput" rows="12" style="width:100%"></textarea>
      <div class="row" style="gap:.5rem;flex-wrap:wrap">
        <button id="validateQcfg">Validate</button>
        <button id="saveQcfg" class="primary">Save</button>
        <button id="loadQcfg">Load</button>
        <span id="qcfgStatus" class="status">Not validated</span>
      </div>
    </section>

    <section class="panel">
      <h3>Jemima Maths Spec (jmaths)</h3>
      <textarea id="jmathsInput" rows="12" style="width:100%"></textarea>
      <div class="row" style="gap:.5rem;flex-wrap:wrap">
        <button id="validateJmaths">Validate</button>
        <button id="saveJmaths" class="primary">Save</button>
        <button id="loadJmaths">Load</button>
        <span id="jmathsStatus" class="status">Not validated</span>
      </div>
    </section>

    <div class="row" style="gap:.5rem;flex-wrap:wrap">
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
    </div>
  `;

  const $ = (s) => el.querySelector(s);
  const lsGet = (k, d='') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const code = (lsGet
