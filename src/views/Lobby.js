// Lobby screen — three panels (JAIME join, DANIEL host, REJOIN)
// Minimal, self-contained: sets location.hash for navigation.
// Reads/writes only localStorage key: "lastGameCode".

function h(tag, attrs = {}, ...children){
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if(k === "class") el.className = v;
    else if(k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if(v !== false && v != null) el.setAttribute(k, v);
  });
  children.flat().forEach(c => el.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
  return el;
}

function rightButtons(...btns){
  return h("div", { class:"btn-row" }, ...btns);
}

function codeInput(id, placeholder = "ENTER CODE"){
  return h("input", {
    id, class:"input-field", type:"text", inputmode:"latin", maxlength:"5",
    placeholder, autocomplete:"off", spellcheck:"false"
  });
}

function goTo(hash){ location.hash = hash; }

// Exported render:
export default function renderLobby(root = document.getElementById("app")){
  root.innerHTML = "";
  const wrap = h("main", { class:"wrap" });

  // === JAIME (Join) ===
  const jaimeTitle = h("h2", { class:"panel-title accent-jaime" }, "JAIME");
  const joinInput = codeInput("joinCode");
  const joinBtn = h("button", {
    class:"btn btn-go jaime", onclick: () => {
      const code = (joinInput.value || "").trim().toUpperCase();
      if(code.length >= 4){ localStorage.setItem("lastGameCode", code); goTo(`#/join/${code}`); }
      else joinInput.focus();
    }
  }, "Join");

  const jaimePanel = h("section", { class:"panel" },
    jaimeTitle,
    h("div", { class:"input-row mt-4" }, joinInput, h("div", { class:"btn-row" }, joinBtn))
  );

  // === DANIEL (Host) ===
  const danielTitle = h("h2", { class:"panel-title accent-daniel" }, "DANIEL");
  const hostBadge = h("span", { class:"badge", style:"margin-left:8px" }, "HOST");
  danielTitle.appendChild(hostBadge);

  const hostGo = h("button", {
    class:"btn btn-go daniel", onclick: () => goTo("#/key")
  }, "Go");

  const danielPanel = h("section", { class:"panel" },
    danielTitle,
    rightButtons(hostGo)
  );

  // === REJOIN ===
  const rejoinTitle = h("h2", { class:"panel-title accent-white" }, "REJOIN");
  const lastCode = (localStorage.getItem("lastGameCode") || "").toUpperCase();
  const lastCodeField = codeInput("lastCode");
  lastCodeField.value = lastCode;

  const rejoinBtn = h("button", {
    class:"btn btn-go", onclick: () => {
      const code = (lastCodeField.value || "").trim().toUpperCase();
      if(code){ localStorage.setItem("lastGameCode", code); goTo(`#/rejoin/${code}`); }
      else lastCodeField.focus();
    }
  }, "Go");

  const clearBtn = h("button", {
    class:"btn btn-outline", onclick: () => { localStorage.removeItem("lastGameCode"); lastCodeField.value = ""; }
  }, "Clear");

  const rejoinPanel = h("section", { class:"panel" },
    rejoinTitle,
    h("div", { class:"input-row mt-4" }, lastCodeField),
    rightButtons(rejoinBtn, clearBtn)
  );

  // Layout (stacked on mobile; two columns on wide)
  const grid = h("div", { class:"grid-2" }, jaimePanel, danielPanel);
  wrap.appendChild(grid);
  wrap.appendChild(rejoinPanel);

  root.appendChild(wrap);
}
