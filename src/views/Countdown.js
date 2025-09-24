// /src/views/Countdown.js
// Full-screen centred numerals 3 → 2 → 1 (no 0).
// Auto-advances to the next route.

export default function Countdown(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const get = (k, d = '') => {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  };

  // Where to go after the countdown
  const nextHash =
    (ctx && ctx.nextHash) ||
    get('nextHash', '#/q/1') ||
    '#/q/1';

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
      // Subtle pop
      num.style.transform = 'scale(1.05)';
      setTimeout(() => { num.style.transform = 'scale(1)'; }, 90);
      setTimeout(tick, 800); // speed of the countdown
      return;
    }
    // After "1" (no 0), navigate
    navigate(nextHash);
  }

  // Kick off
  setTimeout(tick, 50);

  return stage;
}
