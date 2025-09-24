// /src/views/MarkingRoom.js
// Player sees opponent’s answers, marks each as Correct/Incorrect.
// After marking all, GO → shows "scored you" pause → then navigates on.

export default function MarkingRoom(ctx = {}) {
  const navigate = (hash) => {
    if (ctx && typeof ctx.navigate === 'function') ctx.navigate(hash);
    else location.hash = hash;
  };

  const round = ctx.round || 1;
  const nextHash = (round < 5) ? `#/interlude/${round}` : '#/jemima';

  // Demo answers (normally would come from opponent)
  const demoAnswers = [
    { q: 'What is 2 + 2?', answer: '3' },
    { q: 'Which colour is the sky?', answer: 'Blue' },
    { q: 'Capital of France?', answer: 'Berlin' }
  ];

  const marks = {};

  // Root
  const root = document.createElement('div');
  root.className = 'wrap';

  const strip = document.createElement('div');
  strip.className = 'score-strip';
  strip.textContent = `Marking Round ${round}`;
  root.appendChild(strip);

  const container = document.createElement('div');
  container.style.marginTop = '24px';

  demoAnswers.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'card mt-4';

    const q = document.createElement('div');
    q.style.fontWeight = '700';
    q.style.marginBottom = '12px';
    q.textContent = `Q${idx + 1}. ${item.q}`;

    const ans = document.createElement('div');
    ans.className = 'note';
    ans.textContent = `Opponent answered: ${item.answer}`;

    const btnRow = document.createElement('div');
    btnRow.className = 'btn-row mt-3';

    const btnCorrect = document.createElement('button');
    btnCorrect.className = 'btn btn-outline';
    btnCorrect.textContent = 'Correct';

    const btnWrong = document.createElement('button');
    btnWrong.className = 'btn btn-outline';
    btnWrong.textContent = 'Incorrect';

    function select(which) {
      btnCorrect.classList.remove('selected');
      btnWrong.classList.remove('selected');
      if (which === 'C') btnCorrect.classList.add('selected');
      if (which === 'W') btnWrong.classList.add('selected');
      marks[idx] = which;
      checkReady();
    }

    btnCorrect.addEventListener('click', () => select('C'));
    btnWrong.addEventListener('click', () => select('W'));

    btnRow.append(btnCorrect, btnWrong);
    card.append(q, ans, btnRow);
    container.appendChild(card);
  });

  root.appendChild(container);

  // GO button
  const row = document.createElement('div');
  row.className = 'btn-row mt-6';
  const btnGo = document.createElement('button');
  btnGo.className = 'btn btn-go';
  btnGo.textContent = 'GO';
  btnGo.disabled = true;
  row.appendChild(btnGo);
  container.appendChild(row);

  function checkReady() {
    if (Object.keys(marks).length === demoAnswers.length) {
      btnGo.disabled = false;
    }
  }

  btnGo.addEventListener('click', () => {
    // Temporary "scored you" hold screen
    root.innerHTML = '';
    const hold = document.createElement('div');
    hold.className = 'center-stage';
    const msg = document.createElement('div');
    msg.className = 'panel-title accent-white';
    msg.textContent = 'Opponent scored you…';
    hold.appendChild(msg);
    root.appendChild(hold);

    setTimeout(() => {
      navigate(nextHash);
    }, 2500);
  });

  return root;
}
