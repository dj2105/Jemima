// /src/views/Generation.js
// Centre-stage loading screen with a thin progress bar and status lines.
// Works in demo mode (no keys) by simulating progress to 100%,
// then enables the GO button to move to the Countdown.

export default function Generation(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  // Read what KeyRoom stored (if anything)
  const get = (k, d = '') => {
    try { return localStorage.getItem(k) ?? d; } catch { return d; }
  };
  const ks = JSON.parse(get('keyRoom', '{}') || '{}');
  const hasGemini = !!(ks && ks.geminiKey && ks.geminiKey.trim());

  // Root layout
  const wrap = document.createElement('div');
  wrap.className = 'center-stage';

  const box = document.createElement('div');
  box.style.textAlign = 'center';
  box.style.maxWidth = '860px';
  box.style.margin = '0 auto';

  const title = document.createElement('div');
  title.className = 'panel-title accent-white';
  title.textContent = 'GENERATING…';

  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = hasGemini
    ? 'Seeding questions and Jemima passages.'
    : 'Demo mode: simulating generation (no API key detected).';

  // Status lines
  const status = document.createElement('div');
  status.className = 'card';
  status.style.textAlign = 'left';

  const lineQs = document.createElement('div');
  lineQs.className = 'mt-2';
  lineQs.textContent = 'Questions: 0 generated · 0 rejected';

  const lineJm = document.createElement('div');
  lineJm.className = 'mt-2';
  lineJm.textContent = 'Jemima passages: waiting…';

  status.append(lineQs, lineJm);

  // Progress bar
  const bar = document.createElement('div');
  bar.className = 'progress mt-4';
  const fill = document.createElement('span');
  bar.appendChild(fill);

  // GO button (right-aligned) — disabled until 100%
  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'GO';
  btn.disabled = true;
  btn.addEventListener('click', () => navigate('#/countdown'));
  row.appendChild(btn);

  box.append(title, note, status, bar, row);
  wrap.appendChild(box);

  // --- Demo/progress logic ---
  // Target counts (for nice-looking counters)
  const TARGET_QUESTIONS = 15; // 5 rounds × 3 questions
  const TARGET_REJECTED = 3;   // pretend a few are rejected
  const TARGET_JEMIMA = 4;     // 4 interlude passages

  let qOk = 0, qBad = 0, jm = 0, pct = 0;

  function updateUI() {
    lineQs.textContent = `Questions: ${qOk} generated · ${qBad} rejected`;
    lineJm.textContent = `Jemima passages: ${jm}/${TARGET_JEMIMA} ready`;
    fill.style.width = `${pct}%`;
    btn.disabled = pct < 100;
  }

  // If we had real API calls, we would:
  // 1) fire both generations,
  // 2) update qOk/qBad/jm as promises resolve,
  // 3) set pct based on weighted completion.
  // For now, simulate so the screen is functional and testable.

  const timer = setInterval(() => {
    // Nudge numbers towards targets
    if (qOk < TARGET_QUESTIONS && Math.random() < 0.6) qOk++;
    else if (qBad < TARGET_REJECTED && Math.random() < 0.3) qBad++;

    if (jm < TARGET_JEMIMA && Math.random() < 0.4) jm++;

    // Simple weighted %: questions 70%, jemima 30%
    const qPart = Math.min((qOk + qBad) / (TARGET_QUESTIONS + TARGET_REJECTED), 1);
    const jPart = Math.min(jm / TARGET_JEMIMA, 1);
    const targetPct = Math.floor(qPart * 70 + jPart * 30);

    // Smooth towards targetPct
    pct = Math.min(100, Math.max(pct, targetPct, pct + (Math.random() * 3)));

    // Snap to 100 when both done
    if (qOk >= TARGET_QUESTIONS && qBad >= TARGET_REJECTED && jm >= TARGET_JEMIMA) {
      pct = 100;
    }

    updateUI();

    if (pct >= 100) {
      clearInterval(timer);
      // Optional small delay before enabling GO (gives a “done” feeling)
      setTimeout(() => { btn.disabled = false; }, 300);
    }
  }, 180);

  updateUI();
  return wrap;
}
