// /src/views/QuestionRoom.js
// Shows 3 stacked questions with 2 possible answers each.
// Top strip shows Daniel [score] | Jaime [score].
// GO button appears (right-aligned) only after all 3 are answered.

export default function QuestionRoom(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const round = ctx.round || 1;
  const nextHash = `#/mark/${round}`;

  // Demo questions (replace later with Gemini data)
  const demoQs = [
    { q: 'What is 2 + 2?', a1: '3', a2: '4', correct: '4' },
    { q: 'Which colour is the sky?', a1: 'Blue', a2: 'Green', correct: 'Blue' },
    { q: 'Capital of France?', a1: 'Paris', a2: 'Berlin', correct: 'Paris' }
  ];

  // Root
  const root = document.createElement('div');
  root.className = 'wrap';

  // Score strip (placeholder scores)
  const strip = document.createElement('div');
  strip.className = 'score-strip';
  strip.textContent = `Daniel [0] | Jaime [0]`;
  root.appendChild(strip);

  // Questions
  const container = document.createElement('div');
  container.style.marginTop = '24px';

  const answers = {};

  demoQs.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'card mt-4';

    const q = document.createElement('div');
    q.style.fontWeight = '700';
    q.style.marginBottom = '12px';
    q.textContent = `Q${idx + 1}. ${item.q}`;
    card.appendChild(q);

    // two choice buttons
    [item.a1, item.a2].forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'choice';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        // deselect siblings
        Array.from(card.querySelectorAll('.choice')).forEach((b) =>
          b.classList.remove('selected')
        );
        btn.classList.add('selected');
        answers[idx] = opt;
        checkReady();
      });
      card.appendChild(btn);
    });

    container.appendChild(card);
  });

  root.appendChild(container);

  // GO button row
  const row = document.createElement('div');
  row.className = 'btn-row mt-6';

  const btnGo = document.createElement('button');
  btnGo.className = 'btn btn-go';
  btnGo.textContent = 'GO';
  btnGo.disabled = true;
  btnGo.addEventListener('click', () => {
    navigate(nextHash);
  });

  row.appendChild(btnGo);
  container.appendChild(row);

  function checkReady() {
    const total = Object.keys(answers).length;
    btnGo.disabled = total < demoQs.length;
  }

  return root;
}
