// /src/views/Interlude.js
// After each round (1–4): shows a Jemima passage (4 short beats).
// Player clicks READY → becomes WAITING for a brief beat → auto-advance.

export default function Interlude(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const round = Number(ctx.round || 1);
  const nextHash = '#/countdown';

  // Demo passage (placeholder copy)
  const DEMO_PASSAGES = {
    1: [
      'Jemima hops off the windowsill, tail like a metronome.',
      'She pads past the laundry basket with a curious sniff.',
      'Outside, the wind flicks a receipt across the paving slabs.',
      'A bicycle bell rings twice somewhere near the corner shop.'
    ],
    2: [
      'A neon-blue glow hums above the self-checkouts.',
      'Trolleys clack in a jittery rhythm as wheels swivel.',
      'A price tag hangs skewed: two for one, but only on Tuesdays.',
      'Jemima squints at a spinning promo sign and blinks slowly.'
    ],
    3: [
      'The bus shelter ad loops a sunny beach, then a toaster.',
      'Puddles form perfect circles where drops keep landing.',
      'A stray feather skitters along the curb, stops, then lifts.',
      'Jemima taps the glass with a single, decisive paw.'
    ],
    4: [
      'Somewhere, a stockroom door thumps and a radio crackles.',
      'An electronic scale settles on 0.492 kg… then 0.493.',
      'The air smells faintly of oranges and warm cardboard.',
      'Jemima stretches, whiskers forward: ready.'
    ]
  };

  const passage = DEMO_PASSAGES[round] || DEMO_PASSAGES[1];

  // Root
  const root = document.createElement('div');
  root.className = 'wrap';

  // Header
  const h = document.createElement('div');
  h.className = 'panel-title accent-white';
  h.textContent = `Jemima Interlude ${round}`;
  root.appendChild(h);

  // Card with 4 beats
  const card = document.createElement('div');
  card.className = 'card mt-4';
  card.style.textAlign = 'left';

  passage.forEach((line, i) => {
    const p = document.createElement('div');
    p.style.margin = i ? '10px 0 0 0' : '0';
    p.textContent = `• ${line}`;
    card.appendChild(p);
  });

  root.appendChild(card);

  // Buttons row (right-aligned)
  const row = document.createElement('div');
  row.className = 'btn-row mt-6';

  const btn = document.createElement('button');
  btn.className = 'btn btn-go';
  btn.textContent = 'READY';

  btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'WAITING…';
    // Single-device demo: brief pause then advance
    const hold = document.createElement('div');
    hold.className = 'note mt-3';
    hold.textContent = 'Jemima is stretching her whiskers…';
    root.appendChild(hold);

    setTimeout(() => navigate(nextHash), 1600);
  });

  row.appendChild(btn);
  root.appendChild(row);

  return root;
}
