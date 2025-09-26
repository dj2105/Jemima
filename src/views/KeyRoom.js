// /src/views/KeyRoom.js
// Key Room: paste Gemini key + two JSON configs, validate, generate seed, write to Firestore.

import {
  initFirebase, ensureAuth, db, doc, setDoc, serverTimestamp
} from '../lib/firebase.js';

export default function KeyRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Key Room</h2>
    <p class="status">Paste your Gemini API key and the two JSON configs. Validate, then Generate.</p>

    <div class="panel">
      <label for="apiKey"><strong>Gemini API Key</strong></label>
      <input id="apiKey" type="password" placeholder="AIza…" autocomplete="off" />
      <small class="status">Stored locally on this device only.</small>
    </div>

    <div class="panel">
      <h3>Main Questions Config (<code>version: "qcfg-1"</code>)</h3>
      <textarea id="qcfg" rows="12" placeholder='{"version":"qcfg-1","topics":[{"name":"World Capitals","weight":1}],"difficultyCurve":[{"round":1,"level":"easy"},{"round":2,"level":"easy+"},{"round":3,"level":"medium"},{"round":4,"level":"hard"},{"round":5,"level":"hard+"}],"composition":{"perRound":{"host":{"count":3},"guest":{"count":3}}}}'></textarea>
      <div class="status" id="qcfgStatus"></div>
    </div>

    <div class="panel">
      <h3>Jemima Maths Config (<code>version: "jmaths-1"</code>)</h3>
      <textarea id="jcfg" rows="12" placeholder='{"version":"jmaths-1","global":{"answerType":"integer","allowZero":false,"range":{"min":1,"max":9999}},"passageTemplates":[{"id":"shopping","settingChoices":["Lidl","Tesco"],"requiredNumbers":[{"name":"apples","min":3,"max":12},{"name":"bananas","min":2,"max":10},{"name":"pricePence","min":20,"max":399}],"textPattern":"At {setting}, Jemima bought {apples} apples and {bananas} bananas at {pricePence}p each."}],"roundPlan":[{"round":1,"templateId":"shopping"},{"round":2,"templateId":"shopping"},{"round":3,"templateId":"shopping"},{"round":4,"templateId":"shopping"}],"finalQuestionRecipes":[{"id":"bananasTimesP2","promptPattern":"Multiply the total bananas across all four passages by the banana price (in pence) from passage 2.","compute":"(bananas1+bananas2+bananas3+bananas4)*pricePence2"},{"id":"applesMinusBananas","promptPattern":"From the total apples across all four passages subtract the total bananas.","compute":"(apples1+apples2+apples3+apples4)-(bananas1+bananas2+bananas3+bananas4)"}]}'></textarea>
      <div class="status" id="jcfgStatus"></div>
    </div>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <button id="btnValidate">Validate & Save</button>
      <button id="btnGenerate" class="primary">Generate Seed</button>
      <a href="#/lobby" class="nav-link">Back to Lobby</a>
    </div>

    <div class="log" id="log"></div>
  `;

  const $ = (sel) => el.querySelector(sel);
  const log = (msg, kind = 'info') => {
    const d = document.createElement('div');
    d.className = `logline ${kind}`;
    d.textContent = msg;
    $('#log').appendChild(d);
  };

  // Load persisted values
  try { $('#apiKey').value = localStorage.getItem('geminiApiKey') || ''; } catch {}
  try { $('#qcfg').value  = localStorage.getItem('qcfg.json') || $('#qcfg').value; } catch {}
  try { $('#jcfg').value  = localStorage.getItem('jmaths.json') || $('#jcfg').value; } catch {}

  // --- Zod (from CDN), schemas ---
  let z = null, QCfgSchema = null, JMathsSchema = null, SeedSchema = null;

  async function loadSchemas() {
    if (!z) {
      z = await import('https://esm.sh/zod@3.23.8');
    }
    const _z = z.z;

    const Topic = _z.object({
      name: _z.string().min(1),
      weight: _z.number().positive().max(2).optional()
    });
    const Diff = _z.object({
      round: _z.number().int().min(1).max(5),
      level: _z.enum(['easy','easy+','medium','hard','hard+'])
    });

    // Extended QCfgSchema
    QCfgSchema = _z.object({
      version: _z.literal('qcfg-1'),
      topics: _z.array(Topic).min(1),
      difficultyCurve: _z.array(Diff).length(5),
      composition: _z.object({
        perRound: _z.object({
          host: _z.object({ count: _z.literal(3) }),
          guest: _z.object({ count: _z.literal(3) })
        })
      }),

      // extras
      global: _z.record(_z.any()).optional(),
      delivery_format: _z.record(_z.any()).optional(),
      selection_rules: _z.record(_z.any()).optional(),
      constraints: _z.record(_z.any()).optional(),
      screening_and_verification: _z.record(_z.any()).optional(),
      topic_catalogue: _z.array(_z.string()).optional(),
      gemini_prompts: _z.record(_z.any()).optional(),
      question_blueprints: _z.array(_z.record(_z.any())).optional(),
      post_generation_checks: _z.record(_z.any()).optional(),
      examples: _z.array(_z.record(_z.any())).optional(),
      pseudocode_pipeline: _z.record(_z.any()).optional(),
      api_contract: _z.record(_z.any()).optional(),
      runtime_enforcement: _z.record(_z.any()).optional()
    });

    // Extended JMathsSchema
    const NumberSpec = _z.object({
      name: _z.string().min(1),
      min: _z.number().int(),
      max: _z.number().int()
    }).refine(v => v.max >= v.min, { message: 'numberSpec.max must be ≥ min' });

    const Template = _z.object({
      id: _z.string().min(1),
      settingChoices: _z.array(_z.string().min(1)).min(1),
      requiredNumbers: _z.array(NumberSpec).min(1),
      textPattern: _z.string().min(10)
    });

    JMathsSchema = _z.object({
      version: _z.literal('jmaths-1'),
      global: _z.record(_z.any()).optional(),
      passageTemplates: _z.array(Template).min(1).optional(),
      roundPlan: _z.array(_z.record(_z.any())).optional(),
      finalQuestionRecipes: _z.array(_z.record(_z.any())).optional(),

      // accept extras like in your pack
      constraints: _z.record(_z.any()).optional(),
      beat_library: _z.array(_z.string()).optional(),
      system_prompt: _z.string().optional(),
      examples: _z.array(_z.record(_z.any())).optional(),
      meta: _z.record(_z.any()).optional()
    });

    // SeedSchema (for combined seed)
    const SeedQItem = _z.object({
      q: _z.string().min(6),
      a1: _z.string().min(1),
      a2: _z.string().min(1),
      correct: _z.number().int().min(0).max(1)
    });
    const SeedRound = _z.object({
      hostQ: _z.array(SeedQItem).length(3),
      guestQ: _z.array(SeedQItem).length(3)
    });
    const SeedInterlude = _z.object({
      passage: _z.string().min(20),
      numbers: _z.array(_z.number().int())
    });
    const SeedMaths = _z.object({
      q1: _z.object({ prompt: _z.string().min(10), answer: _z.number().int() }),
      q2: _z.object({ prompt: _z.string().min(10), answer: _z.number().int() })
    });
    SeedSchema = _z.object({
      rounds: _z.array(SeedRound).length(5),
      interludes: _z.array(SeedInterlude).length(4),
      maths: SeedMaths
    });
  }

  function firstIssue(err) {
    const i = err?.issues?.[0];
    if (!i) return 'Invalid data';
    const path = i.path?.length ? ` at ${i.path.join('.')}` : '';
    return `${i.message}${path}`;
  }

  // --- Validate & Save ---
  $('#btnValidate').addEventListener('click', async () => {
    $('#qcfgStatus').textContent = '';
    $('#jcfgStatus').textContent = '';
    $('#log').innerHTML = '';

    try {
      await loadSchemas();
    } catch (e) {
      log('Failed to load validator (Zod). Check your internet connection.', 'error');
      console.error(e);
      return;
    }

    const key = ($('#apiKey').value || '').trim();
    if (key) {
      try { localStorage.setItem('geminiApiKey', key); } catch {}
      log('✅ Gemini API key saved locally.');
    } else {
      log('ℹ️ No Gemini key entered yet.');
    }

    let qcfgRaw = null, jcfgRaw = null;
    try { qcfgRaw = $('#qcfg').value ? JSON.parse($('#qcfg').value) : null; } catch {}
    try { jcfgRaw = $('#jcfg').value ? JSON.parse($('#jcfg').value) : null; } catch {}

    if (!qcfgRaw) {
      $('#qcfgStatus').textContent = '❌ Please paste JSON for Main Questions (qcfg-1).';
    } else {
      const res = QCfgSchema.safeParse(qcfgRaw);
      if (res.success) {
        $('#qcfgStatus').textContent = '✅ Valid qcfg-1 saved.';
        try { localStorage.setItem('qcfg.json', JSON.stringify(res.data, null, 2)); } catch {}
      } else {
        $('#qcfgStatus').textContent = '❌ ' + firstIssue(res.error);
      }
    }

    if (!jcfgRaw) {
      $('#jcfgStatus').textContent = '❌ Please paste JSON for Jemima Maths (jmaths-1).';
    } else {
      const res = JMathsSchema.safeParse(jcfgRaw);
      if (res.success) {
        $('#jcfgStatus').textContent = '✅ Valid jmaths-1 saved.';
        try { localStorage.setItem('jmaths.json', JSON.stringify(res.data, null, 2)); } catch {}
      } else {
        $('#jcfgStatus').textContent = '❌ ' + firstIssue(res.error);
      }
    }

    log('Validation complete.');
  });

  // --- Generate Seed ---
  $('#btnGenerate').addEventListener('click', async () => {
    $('#log').innerHTML = '';
    try {
      await loadSchemas();
    } catch {
      log('Validator failed to load.', 'error');
      return;
    }

    const apiKey = ($('#apiKey').value || '').trim();
    if (!apiKey) {
      log('Please enter a Gemini API key.', 'error');
      return;
    }

    const roomCode = (localStorage.getItem('lastGameCode') || '').toUpperCase();
    if (!roomCode) {
      log('No room code found. Go back to Lobby and create/join a room first.', 'error');
      return;
    }

    let qcfg, jcfg;
    try { qcfg = JSON.parse(localStorage.getItem('qcfg.json') || $('#qcfg').value || '{}'); } catch { qcfg = null; }
    try { jcfg = JSON.parse(localStorage.getItem('jmaths.json') || $('#jcfg').value || '{}'); } catch { jcfg = null; }

    const qv = QCfgSchema.safeParse(qcfg);
    const jv = JMathsSchema.safeParse(jcfg);
    if (!qv.success) { log('Main Questions config invalid: ' + firstIssue(qv.error), 'error'); return; }
    if (!jv.success) { log('Jemima Maths config invalid: ' + firstIssue(jv.error), 'error'); return; }

    try {
      log('Initialising Firebase…');
      await initFirebase();
      await ensureAuth();
    } catch (e) {
      log('Firebase init/auth failed: ' + (e?.message || e), 'error');
      return;
    }

    const roomRef = doc(db, 'rooms', roomCode);
    try {
      await setDoc(roomRef, { state: 'generating' }, { merge: true });
    } catch (e) {
      log('Failed to set room state to generating: ' + (e?.message || e), 'error');
      return;
    }

    try {
      log('Contacting Gemini for main questions…');
      const { generateSeedQuestions } = await import('/src/adapters/questions-adapter.js');
      const qSeed = await generateSeedQuestions(apiKey, qv.data);

      log('Generating Jemima passages + maths…');
      const { generateJemimaMaths } = await import('/src/adapters/jemima-adapter.js');
      const jSeed = await generateJemimaMaths(jv.data, `${roomCode}-${Date.now()}`);

      const fullSeed = {
        rounds: qSeed.rounds,
        interludes: jSeed.interludes,
        maths: jSeed.maths
      };
      const parsed = SeedSchema.safeParse(fullSeed);
      if (!parsed.success) {
        throw new Error('Seed invalid: ' + firstIssue(parsed.error));
      }

      await setDoc(roomRef, {
        seed: parsed.data,
        meta: {
          configVersions: { qcfg: qv.data.version, jmaths: jv.data.version },
          createdAt: serverTimestamp?.() || new Date(),
          version: '2025-09-26'
        }
      }, { merge: true });

      await setDoc(roomRef, {
        state: 'countdown_r1',
        countdownT0: serverTimestamp?.() || new Date(Date.now() + 3500)
      }, { merge: true });

      log('✅ Seed generated. Moving to Countdown…');
      navigate('#/countdown');
    } catch (e) {
      log('Generation failed: ' + (e?.message || e), 'error');
    }
  });

  return el;
}
