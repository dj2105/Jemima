// /src/views/Countdown.js
//
// Countdown phase — shared 3·2·1 timer anchored to Firestore.
// • Shows a bold monospace timer that counts real seconds (3 → 2 → 1 → 0).
// • Host ensures `countdown.startAt` exists (ms epoch). Guests simply wait for it.
// • When timer elapses, host flips the room to `state:"questions"`.
// • Both players navigate to /questions once the room state changes.
//
// Query params: ?code=ABC&round=N
// Firestore:
//   READ  rooms/{code} -> meta.hostUid/guestUid, countdown.startAt, state, round
//   WRITE (host only)
//     - Arm timer:   countdown.startAt = Date.now()+3000, state:"countdown", round (idempotent)
//     - On expiry:   state:"questions", countdown.startAt -> null
//
// Visual language: Courier, narrow column, minimal card.

import {
  initFirebase,
  ensureAuth,
  roomRef,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "../lib/firebase.js";

const clampCode = (s) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
const hp = () => new URLSearchParams((location.hash.split("?")[1] || ""));

const COUNTDOWN_WINDOW_MS = 3_000;

function el(tag, attrs = {}, kids = []) {
  const node = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach((child) =>
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child)
  );
  return node;
}

export default {
  async mount(container) {
    await initFirebase();
    const me = await ensureAuth();

    const qs = hp();
    const code = clampCode(qs.get("code") || "");
    let round = parseInt(qs.get("round") || "1", 10) || 1;

    // per-view hue
    const hue = Math.floor(Math.random() * 360);
    document.documentElement.style.setProperty("--ink-h", String(hue));

    container.innerHTML = "";
    const root = el("div", { class: "view view-countdown" });
    const title = el("h1", { class: "title" }, `Round ${round}`);
    root.appendChild(title);

    const card = el("div", { class: "card" });
    const tag = el("div", { class: "mono", style: "text-align:center;margin-bottom:8px;" }, `Room ${code}`);
    card.appendChild(tag);

    const msg = el("div", { class: "mono", style: "text-align:center;opacity:.8;margin-bottom:12px;" }, "Get ready…");
    card.appendChild(msg);

    const timer = el("div", {
      class: "mono",
      style: "font-size:64px;line-height:1;text-align:center;font-weight:700;"
    }, "—");
    card.appendChild(timer);

    const sub = el("div", { class: "mono small", style: "text-align:center;margin-top:12px;" }, "Waiting for host…");
    card.appendChild(sub);

    root.appendChild(card);
    container.appendChild(root);

    const rRef = roomRef(code);
    const snap0 = await getDoc(rRef);
    const room0 = snap0.data() || {};
    const { hostUid, guestUid } = room0.meta || {};
    const myRole = hostUid === me.uid ? "host" : guestUid === me.uid ? "guest" : "guest";

    let countdownStartAt = Number(room0?.countdown?.startAt || 0) || 0;
    let hasFlipped = false;

    // Allow round label to follow doc updates (e.g., if host armed next round before guest arrived)
    if (Number(room0.round)) {
      round = Number(room0.round);
      title.textContent = `Round ${round}`;
    }

    const armCountdownIfNeeded = async () => {
      if (myRole !== "host") return;
      const now = Date.now();
      const stale = !countdownStartAt || now - countdownStartAt > COUNTDOWN_WINDOW_MS * 5;
      if (!stale) return; // already armed (or only slightly in past for rejoin)

      countdownStartAt = Date.now() + COUNTDOWN_WINDOW_MS;
      try {
        console.log(`[flow] arm countdown | code=${code} round=${round} role=${myRole}`);
        await updateDoc(rRef, {
          state: "countdown",
          round,
          "countdown.startAt": countdownStartAt,
          "timestamps.updatedAt": serverTimestamp()
        });
      } catch (err) {
        console.warn("[countdown] failed to arm timer:", err);
      }
    };

    await armCountdownIfNeeded();

    const stop = onSnapshot(rRef, (snap) => {
      const data = snap.data() || {};

      if (Number(data.round) && Number(data.round) !== round) {
        round = Number(data.round);
        title.textContent = `Round ${round}`;
      }

      const remoteStart = Number(data?.countdown?.startAt || 0) || 0;
      if (remoteStart && remoteStart !== countdownStartAt) {
        countdownStartAt = remoteStart;
      }

      if (data.state === "questions") {
        setTimeout(() => {
          location.hash = `#/questions?code=${code}&round=${round}`;
        }, 80);
        return;
      }

      if (data.state && data.state !== "countdown") {
        // Fallback routing if we landed late
        let target = null;
        if (data.state === "marking") target = `#/marking?code=${code}&round=${round}`;
        else if (data.state === "award") target = `#/award?code=${code}&round=${round}`;
        else if (data.state === "maths") target = `#/maths?code=${code}`;
        else if (data.state === "final") target = `#/final?code=${code}`;
        if (target) {
          setTimeout(() => { location.hash = target; }, 80);
        }
        return;
      }

      if (!remoteStart) {
        sub.textContent = myRole === "host"
          ? "Pressing go…"
          : "Waiting for Daniel to arm the timer…";
        armCountdownIfNeeded();
      } else {
        sub.textContent = "";
      }
    }, (err) => {
      console.warn("[countdown] snapshot error:", err);
    });

    const tick = setInterval(async () => {
      if (!countdownStartAt) {
        timer.textContent = "—";
        return;
      }

      const now = Date.now();
      const remainMs = Math.max(0, (countdownStartAt) - now);
      const secs = Math.ceil(remainMs / 1000);
      timer.textContent = String(secs > 0 ? secs : 0);

      if (remainMs <= 0 && !hasFlipped) {
        hasFlipped = true;
        if (myRole === "host") {
          try {
            console.log(`[flow] countdown -> questions | code=${code} round=${round} role=${myRole}`);
            await updateDoc(rRef, {
              state: "questions",
              "countdown.startAt": null,
              "timestamps.updatedAt": serverTimestamp()
            });
          } catch (err) {
            console.warn("[countdown] failed to flip to questions:", err);
            hasFlipped = false; // allow retry
          }
        }
      }
    }, 200);

    this.unmount = () => {
      try { stop && stop(); } catch {}
      try { clearInterval(tick); } catch {}
    };
  },

  async unmount() { /* handled in instance */ }
};
