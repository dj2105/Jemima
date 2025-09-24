// netlify/functions/gemini.js
// Netlify Function proxy for Google Gemini 2.0 Flash.
// Reads API key from env (GEMINI_API_KEY or VITE_GEMINI_API_KEY).
// Usage (client): POST /.netlify/functions/gemini  { kind, spec, prompt, system, temperature, seed }
//
// Returns: { ok: true, data } or { ok:false, error }

const MODEL = 'models/gemini-2.0-flash';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    return json(400, { ok: false, error: 'Missing GEMINI_API_KEY on server' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const {
    kind = 'generic',          // 'questions' | 'interludes' | 'maths' | 'generic'
    spec = {},                 // caller-provided JSON spec to steer outputs
    prompt = '',               // optional direct prompt text
    system = '',               // optional system-style preface
    temperature = 0.9,         // creativity
    seed = undefined           // optional integer for repeatability
  } = body;

  // Build a safe, minimal generateContent payload
  const contents = [];

  if (system) {
    contents.push({
      role: 'user',
      parts: [{ text: `SYSTEM:\n${system}` }]
    });
  }

  // For typed kinds, wrap request with a concise instruction to emit strict JSON
  const header = `You are a JSON-only generator. Always respond with a single valid JSON object with no preamble and no code fences.`;

  let task = prompt;
  if (!task) {
    if (kind === 'questions') {
      task =
        `Generate a JSON object for five quiz rounds. Each round has 3 questions. Each question has exactly two options.\n` +
        `Schema:\n{\n "rounds":[\n   { "round":1, "questions":[\n     {"q":"", "a1":"", "a2":"", "correct":"a1|a2"}\n   ]}\n ]}\n` +
        `Follow caller spec JSON to shape topics and difficulty.\nCALLER_SPEC:\n${JSON.stringify(spec)}`;
    } else if (kind === 'interludes') {
      task =
        `Generate four short narrative passages ("beats") about Jemima between quiz rounds.\n` +
        `Schema: { "passages":[ {"round":1, "beats":["", "", "", ""]}, ... ] }\n` +
        `Keep each beat one sentence. CALLER_SPEC:\n${JSON.stringify(spec)}`;
    } else if (kind === 'maths') {
      task =
        `Create exactly two numeric questions that can be solved from previously shown passages. Whole-number answers with units.\n` +
        `Schema: { "questions":[{"prompt":"", "units":"", "answer":123}], "notes":"" }\n` +
        `CALLER_SPEC:\n${JSON.stringify(spec)}`;
    } else {
      task = `Return {"message":"ready"}`;
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: `${header}\n\nTASK:\n${task}` }]
  });

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
      ...(Number.isInteger(seed) ? { seed } : {})
    }
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const text = await r.text();
      return json(502, { ok: false, error: `Gemini HTTP ${r.status}`, detail: text });
    }

    const data = await r.json();

    // Extract the text from the first candidate
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
      '';

    if (!text) {
      return json(500, { ok: false, error: 'Empty response from model', raw: data });
    }

    // Expect strict JSON
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to salvage JSON by trimming code fences if any
      const cleaned = text.replace(/^[\s\S]*?{/, '{').replace(/}[\s\S]*$/, '}');
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return json(500, { ok: false, error: 'Model did not return valid JSON', rawText: text });
      }
    }

    return json(200, { ok: true, data: parsed });
  } catch (err) {
    return json(500, { ok: false, error: String(err && err.message || err) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(obj)
  };
}
