// /src/views/Countdown.js
// Full-screen centred numerals 3 → 2 → 1 (no 0).
// Auto-advances to the next route stored in localStorage.nextHash,
// falling back to '#/round/1'.

export default function Countdown(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const get = (k, d = '') => {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const del = (k) => { try { localStorage.removeItem(k); } catch {} };

  // Determine next route BEFORE clearing anything
  const storedNext = (ctx && ctx.nextHash) || get('nextHash', '');
  const nextHash = storedNext && typeof storedNext === 'string'
    ? storedNext
    : '#/round/1';

  // Root
  const stage = document.createElement('div');
  stage.className = 'center-stage';

  const num = document.createElement('div');
  num.className = 'countdown';
  num.textContent = '3';
  stage.appendChild(num);

  // Countdown logic
  const steps = ['3', '2', '1'];
  let idx = 0;

  function tick() {
    if (idx < steps.length) {
      num.textContent = steps[idx++];
      num.style.transform = 'scale(1.05)';
      setTimeout(() => { num.style.transform = 'scale(1)'; }, 90);
      setTimeout(tick, 800);
      return;
    }
    // After "1" (no 0), advance together
    // Clear only after we’ve used it, so re-renders don’t lose the target.
    del('nextHash');
    navigate(nextHash);
  }

  // Kick off
  setTimeout(tick, 50);

  return stage;
}
