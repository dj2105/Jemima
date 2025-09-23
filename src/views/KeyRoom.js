import { state, setKeyRoomField } from '../state.js';
import { saveLocal, loadLocal } from '../lib/localStore.js';
import { validateGeminiKey, validateJSON, validateFirestoreConfig, defaultCodeFormatJSON } from '../lib/validation.js';
import { RoleBadge } from "../components/RoleBadge.js";

function dot(ok){ return `<span class="dot ${ok ? 'ok':'err'}"></span>`; }

export function KeyRoom(){
  // Load saved values once
  const initial = loadLocal('keyroom') || {};
  Object.assign(state.keyRoom, initial);

  // Initial validations
  state.validation.geminiKey = validateGeminiKey(state.keyRoom.geminiKey || state.runtime.geminiEnvKey || '');
  state.validation.qJSON = validateJSON(state.keyRoom.qJSON, /*emptyIsOk=*/true);
  state.validation.mathsJSON = validateJSON(state.keyRoom.mathsJSON, /*emptyIsOk=*/true);
  state.validation.firestoreJSON = validateFirestoreConfig(state.keyRoom.firestoreJSON || state.runtime.firebaseEnvJSON || '');
  state.validation.codeFormatJSON = validateJSON(state.keyRoom.codeFormatJSON, /*emptyIsOk=*/true);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.innerHTML = `
    <div class="h1">Key Room</div>
    <div class="panel">
      <div class="kv">
        <label>Gemini API Key</label>
        <div>
          <div class="row wrap">
            <input id="gemini" class="input code" placeholder="Paste key (or leave to use env)" value="${(state.keyRoom.geminiKey||'')}" />
            <span id="gemini-dot">${dot(state.validation.geminiKey)}</span>
          </div>
          <div class="subtext">Format check only here (env or pasted). Real API ping added in PR #2.</div>
        </div>

        <label>Questions JSON overrides</label>
        <div>
          <textarea id="qjson" class="input" style="height:110px; text-transform:none; letter-spacing:0">${state.keyRoom.qJSON||''}</textarea>
          <div class="row"><span id="qjson-dot">${dot(state.validation.qJSON)}</span><span class="subtext">Empty = use defaults (OK)</span></div>
        </div>

        <label>Jemima Maths JSON</label>
        <div>
          <textarea id="mathsjson" class="input" style="height:110px; text-transform:none; letter-spacing:0">${state.keyRoom.mathsJSON||''}</textarea>
          <div class="row"><span id="mathsjson-dot">${dot(state.validation.mathsJSON)}</span><span class="subtext">Empty = use defaults (OK)</span></div>
        </div>

        <label>Firestore settings (web config JSON)</label>
        <div>
          <textarea id="firejson" class="input" style="height:110px; text-transform:none; letter-spacing:0">${state.keyRoom.firestoreJSON||''}</textarea>
          <div class="row"><span id="firejson-dot">${dot(state.validation.firestoreJSON)}</span><span class="subtext">Paste full web config JSON or rely on env.</span></div>
        </div>

        <label>Code-format JSON</label>
        <div>
          <textarea id="codefmt" class="input" style="height:110px; text-transform:none; letter-spacing:0">${state.keyRoom.codeFormatJSON||''}</textarea>
          <div class="row"><span id="codefmt-dot">${dot(state.validation.codeFormatJSON)}</span><span class="subtext">Empty = <code class="code">{ "type":"alnum4", "exclude":["O","0"] }</code></span></div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="row" style="justify-content:space-between">
        <button id="back" class="btn">Back to Lobby</button>
        <div class="row" style="gap:14px">
          <button id="save" class="btn">Save</button>
          <button id="continue" class="btn daniel">Continue to Generation</button>
        </div>
      </div>
    </div>
  `;

  const els = {
    gemini: wrap.querySelector('#gemini'),
    qjson: wrap.querySelector('#qjson'),
    mathsjson: wrap.querySelector('#mathsjson'),
    firejson: wrap.querySelector('#firejson'),
    codefmt: wrap.querySelector('#codefmt'),
    dots:{
      gemini: wrap.querySelector('#gemini-dot'),
      qjson: wrap.querySelector('#qjson-dot'),
      mathsjson: wrap.querySelector('#mathsjson-dot'),
      firejson: wrap.querySelector('#firejson-dot'),
      codefmt: wrap.querySelector('#codefmt-dot')
    }
  };

  function refreshDots(){
    els.dots.gemini.innerHTML = dot(state.validation.geminiKey);
    els.dots.qjson.innerHTML = dot(state.validation.qJSON);
    els.dots.mathsjson.innerHTML = dot(state.validation.mathsJSON);
    els.dots.firejson.innerHTML = dot(state.validation.firestoreJSON);
    els.dots.codefmt.innerHTML = dot(state.validation.codeFormatJSON);
  }

  function readAndValidate(){
    setKeyRoomField('geminiKey', els.gemini.value.trim());
    setKeyRoomField('qJSON', els.qjson.value.trim());
    setKeyRoomField('mathsJSON', els.mathsjson.value.trim());
    setKeyRoomField('firestoreJSON', els.firejson.value.trim());
    setKeyRoomField('codeFormatJSON', els.codefmt.value.trim());

    state.validation.geminiKey = validateGeminiKey(state.keyRoom.geminiKey || state.runtime.geminiEnvKey || '');
    state.validation.qJSON = validateJSON(state.keyRoom.qJSON, true);
    state.validation.mathsJSON = validateJSON(state.keyRoom.mathsJSON, true);
    state.validation.firestoreJSON = validateFirestoreConfig(state.keyRoom.firestoreJSON || state.runtime.firebaseEnvJSON || '');
    state.validation.codeFormatJSON = validateJSON(state.keyRoom.codeFormatJSON, true);

    refreshDots();
  }

  els.gemini.addEventListener('input', readAndValidate);
  els.qjson.addEventListener('input', readAndValidate);
  els.mathsjson.addEventListener('input', readAndValidate);
  els.firejson.addEventListener('input', readAndValidate);
  els.codefmt.addEventListener('input', readAndValidate);

  wrap.querySelector('#save').addEventListener('click', () => {
    readAndValidate();
    saveLocal('keyroom', { ...state.keyRoom });
    alert('Saved locally.');
  });

  wrap.querySelector('#continue').addEventListener('click', () => {
    readAndValidate();
    const allGreen = state.validation.geminiKey && state.validation.firestoreJSON
      && state.validation.qJSON && state.validation.mathsJSON && state.validation.codeFormatJSON;
    if (!allGreen){
      alert('Please fix red dots before continuing.');
      return;
    }
    // Ensure default code format if empty
    if (!state.keyRoom.codeFormatJSON) {
      state.keyRoom.codeFormatJSON = JSON.stringify(defaultCodeFormatJSON());
      saveLocal('keyroom', { ...state.keyRoom });
    }
    location.hash = '/gen';
  });

  wrap.querySelector('#back').addEventListener('click', () => location.hash = '/lobby');

  wrap.appendChild(RoleBadge());
  
  return wrap;
}
