// /src/views/KeyRoom.js
// Key Room (phase 1): paste Gemini key + two JSON configs, validate & save locally.
// This version does NOT contact Gemini or Firebase yet. That's the next file.

export default function KeyRoom(ctx = {}) {
  const navigate = (hash) =>
    (ctx && typeof ctx.navigate === 'function') ? ctx.navigate(hash) : (location.hash = hash);

  const el = document.createElement('section');
  el.className = 'panel';
  el.innerHTML = `
    <h2>Key Room</h2>
    <p class="status">Paste your Gemini API key and the two JSON configs. Click “Validate & Save”.</p>

    <div class="panel">
      <label for="apiKey"><strong>Gemini API Key</strong></label>
      <input id="apiKey" type="password" placeholder="AIza…" autocomplete="off" />
      <small class="status">Stored locally only (on this device).</small>
    </div>

    <div class="panel">
      <h3>Main Questions Config (<code>version: "qcfg-1"</code>)</h3>
      <textarea id="qcfg" rows="12" placeholder='{"version":"qcfg-1","topics":[{"name":"World Capitals","weight":1}]}'></textarea>
      <div class="status" id="qcfgStatus"></div>
    </div>

    <div class="panel">
      <h3>Jemima Maths Config (<code>version: "jmaths-1"</code>)</h3>
      <textarea id="jcfg" rows="12" placeholder='{"version":"jmaths-1","roundPlan":[{"round":1,"templateId":"shopping"},{"round":2,"templateId":"shopping"},{"round":3,"templateId":"shopping"},{"round":4,"templateId":"shopping"}]}'></textarea>
      <div class="status" id="jcfgStatus"></div>
    </div>

    <div class="row" style="gap:0.5rem; flex-wrap:wrap;">
      <button id="btnValidate">Validate & Save</button>
      <button id="btnGenerate" class="primary" disabled title="Coming next step">Generate Seed (next step)</button>
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

  // Load Zod dynamically (CDN) so we don’t need any build tools.
  let z = null;
  async function loadZod() {
    if (z) return z;
    const mod = await import('https://esm.sh/zod@3.23.8');
    z = mod;
    return z;
  }

  // Very small schemas (we’ll harden later). These catch common mistakes now.
  let QCfgSchema, JMathsSchema;
  function initSchemas() {
    const { z: _z } = z;

    const Topic = _z.object({
      name: _z.string().min(1),
      weight: _z.number().positive().max(2).optional()
    });

    const Diff = _z.object({
      round: _z.number().int().min(1).max(5),
      level: _z.enum(['easy','easy+','medium','hard','hard+'])
    });

    QCfgSchema = _z.object({
      version: _z.literal('qcfg-1'),
      topics: _z.array(Topic).min(1),
      difficultyCurve: _z.array(Diff).length(5).optional(),
      composition: _z.object({
        perRound: _z.object({
          host: _z.object({ count: _z.literal(3) }).optional(),
          guest: _z.object({ count: _z.literal(3) }).optional()
        }).optional()
      }).optional(),
      global: _z.object({
        language: _z.string().optional(),
        twoChoiceOnly: _z.boolean().optional(),
        maxQuestionChars: _z.number().int().optional(),
        maxAnswerChars: _z.number().int().optional()
      }).optional()
    });

    const NumberSpec = _z.object({
      name: _z.string().min(1),
      min: _z.number().int(),
      max: _z.number().int()
    }).refine(v => v.max >= v.min, { message: 'numberSpec.max must be ≥ min' });

    const Template = _z.object({
      id: _z.string().min(1),
      settingChoices: _z.array(_z.string().min(1)).min(1).optional(),
      requiredNumbers: _z.array(NumberSpec).min(1).optional(),
      textPattern: _z.string().min(10).optional()
    });

    JMathsSchema = _z.object({
      version: _z.literal('jmaths-1'),
      passageTemplates: _z.array(Template).optional(),
      roundPlan: _z.array(_z.object({
        round: _z.number().int().min(1).max(4),
        templateId: _z.string().min(1)
      })).length(4),
      finalQuestionRecipes: _z.array(_z.object({
        id: _z.string().min(1),
        promptPattern: _z.string().min(10),
        compute: _z.string().min(1)
      })).length(2).optional(),
      global: _z.object({
        language: _z.string().optional(),
        answerType: _z.string().optional(),
        allowZero: _z.boolean().optional(),
        range: _z.object({ min: _z.number().int(), max: _z.number().int() }).optional()
      }).optional()
    });
  }

  function firstIssue(err) {
    const i = err?.issues?.[0];
    if (!i) return 'Invalid data';
    const path = i.path?.length ? ` at ${i.path.join('.')}` : '';
    return `${i.message}${path}`;
  }

  // Prefill from localStorage (if any)
  try { $('#apiKey').value = localStorage.getItem('geminiApiKey') || ''; } catch {}
  try { $('#qcfg').value  = localStorage.getItem('qcfg.json') || ''; } catch {}
  try { $('#jcfg').value  = localStorage.getItem('jmaths.json') || ''; } catch {}

  $('#btnValidate').addEventListener('click', async () => {
    $('#qcfgStatus').textContent = '';
    $('#jcfgStatus').textContent = '';
    $('#log').innerHTML = '';

    try {
      await loadZod();
      initSchemas();
    } catch (e) {
      log('Failed to load validator (Zod). Check your internet connection.', 'error');
      console.error(e);
      return;
    }

    // Save API key locally (optional)
    const key = ($('#apiKey').value || '').trim();
    if (key) {
      try { localStorage.setItem('geminiApiKey', key); } catch {}
      log('✅ Gemini API key saved locally.');
    } else {
      log('ℹ️ No Gemini key entered (you can add it later).');
    }

    // Parse + validate configs
    let qcfgRaw, jcfgRaw;
    try { qcfgRaw = $('#qcfg').value ? JSON.parse($('#qcfg').value) : null; } catch { qcfgRaw = null; }
    try { jcfgRaw = $('#jcfg').value ? JSON.parse($('#jcfg').value) : null; } catch { jcfgRaw = null; }

    // qcfg
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

    // jmaths
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

  // Generate button is disabled in this step—will be enabled after we add Firebase + adapters.
  $('#btnGenerate').addEventListener('click', () => {
    alert('We’ll enable generation after we add Firebase and the adapters in the next step.');
  });

  return el;
}
