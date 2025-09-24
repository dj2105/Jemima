// /netlify/functions/gemini.js
// Server proxy for Google Gemini 2.0 Flash (models/gemini-2.0-flash).
// Expects POST body: { kind, spec, prompt, system, temperature, seed }.
// Reads API key from env: GEMINI_API_KEY (preferred) or VITE_GEMINI_API_KEY.
// Returns JSON: { ok:true, data } or { ok:false, error, detail? }.

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return cors(200, '');
    if (event.httpMethod !== 'POST') {
      return cors(405, JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}'); }
    catch { return cors(400, JSON.stringify({ ok: false, error: 'Invalid JSON body' })); }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    if (!apiKey) {
      console.error('[gemini] Missing GEMINI_API_KEY');
      return cors(500, JSON.stringify({ ok: false, error: 'Missing GEMINI_API_KEY' }));
    }

    const {
      kind = 'generic',
      spec = {},
      prompt = '',
      system = '',
      temperature = 0.8,
      seed
    } = body;

    const header = 'Respond with ONE valid JSON object. No prose. No code fences.';
    const task = prompt || buildTask(kind, spec);
    if (!task) return cors(500, JSON.stringify({ ok: false, error: 'No task built' }));

    const contents = [];
    if (system) contents.push({ role: 'user', parts: [{ text: `SYSTEM:\n${system}` }] });
    contents.push({ role: 'user', parts: [{ text: `${header}\n\nTASK:\n${task}` }] });

    const payload = {
      contents,
      generationConfig: {
        temperature: Number.isFinite(temperature) ? temperature : 0.8,
        maxOutputTokens: 3072,
        ...(Number.isInteger(seed) ? { seed } : {})
      }
    };

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      encodeURIComponent(apiKey);

    // Debug breadcrumbs
    console.log('[gemini] kind:', kind);
    console.log('[gemini] payload (first 500):', JSON.stringify(payload).slice(0, 500));

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const raw = await r.text();
    console.log('[gemini] response status:', r.status);
    console.log('[gemini] response body (first 500):', raw.slice(0, 500));

    if (!r.ok) {
      return cors(500, JSON.stringify({ ok: false, error: `HTTP ${r.status}`, detail: raw }));
    }

    let data;
    try { data = JSON.parse(raw); }
    catch {
      console.error('[gemini] Non-JSON API response:', raw.slice(0, 300));
      return cors(500, JSON.stringify({ ok: false, error: 'Non-JSON response from API' }));
    }

    // --- NEW: join *all* parts text for candidate[0] ---
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const joined = parts.map(p => (p?.text || '')).join('');

    if (!joined) {
      console.error('[gemini] Empty candidate parts:', JSON.stringify(data).slice(0, 300));
      return cors(500, JSON.stringify({ ok: false, error: 'Empty model response' }));
    }

    // Strip code fences if present and trim to the outermost JSON object
    const unfenced = stripFences(joined);
    const justJson = trimToOuterJson(unfenced);

    let parsed;
    try {
      parsed = JSON.parse(justJson);
    } catch (e) {
      console.error('[gemini] Invalid JSON from model (first 200):', justJson.slice(0, 200));
      return cors(500, JSON.stringify({ ok: false, error: 'Model returned invalid JSON' }));
    }

    return cors(200, JSON.stringify({ ok: true, data: parsed }));
  } catch (err) {
    console.error('[gemini] Function crash:', err);
    return cors(500, JSON.stringify({ ok: false, error: String(err && err.message || err) }));
  }
};

// ----- Helpers -----

function buildTask(kind, spec) {
  if (kind === 'questions') {
    return [
      'Generate quiz data for five rounds, three questions per round.',
      'Each question has EXACTLY two options and a correct key ("a1" or "a2").',
      'Output JSON matching this schema exactly:',
      '{ "rounds":[ { "round":1, "questions":[ { "q":"", "a1":"", "a2":"", "correct":"a1" } ] } ] }',
      'Use British English. Keep each question one clear fact, <=160 chars.',
      'Caller mechanics to guide subject mix and difficulty:',
      safeStringify(spec)
    ].join('\n');
  }

  if (kind === 'interludes') {
    return [
      'Create four short Jemima interludes ("beats"), one set per round 1–4.',
      'Each set must have exactly 4 concise beats (one–two sentences each).',
      'Return JSON: { "passages":[ { "round":1, "beats":["","","",""] }, { "round":2, ... } ] }',
      'Follow this caller spec:',
      safeStringify(spec)
    ].join('\n');
  }

  if (kind === 'maths') {
    return [
      'Create exactly two numeric questions based on the previously shown Jemima interludes.',
      'Answers must be whole numbers; include explicit units.',
      'Return JSON: { "questions":[ { "prompt":"", "units":"", "answer":123 }, { "prompt":"", "units":"", "answer":456 } ], "notes":"" }',
      'Caller hints/spec:',
      safeStringify(spec)
    ].join('\n');
  }

  return '{"message":"ready"}';
}

function safeStringify(x) {
  try { return JSON.stringify(x); } catch { return '{}'; }
}

function stripFences(s) {
  // Remove ```json ... ``` or ``` ... ``` fences if present
  return s.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();
}

function trimToOuterJson(s) {
  // Keep from first "{" to last "}" to drop any accidental prose
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return s.trim();
  return s.slice(start, end + 1);
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS'
    },
    body
  };
}
