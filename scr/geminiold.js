// /src/gemini.js
// Gemini client with verbose diagnostics support.
// Returns BOTH parsed JSON and raw text so callers can log helpful context.

const MODEL = 'gemini-2.0-flash';

function buildHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey
  };
}

// Try to extract JSON; accept fenced ```json blocks or raw JSON.
// Throws with context if it cannot parse.
function parseMaybeFencedJSON(text) {
  const fence = /```json\s*([\s\S]*?)```/i;
  const m = fence.exec(text);
  const raw = m ? m[1] : text;
  // Trim common “helpful” cruft
  const cleaned = raw.trim()
    // Some models return trailing fences accidentally; be defensive:
    .replace(/```$/m, '')
    // Remove common BOMs:
    .replace(/^\uFEFF/, '');
  return JSON.parse(cleaned);
}

async function callGemini(apiKey, systemPreamble, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [
      { role: 'user', parts: [{ text: (systemPreamble || '').trim() + '\n\n' + (userPrompt || '').trim() }] }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      responseMimeType: 'application/json'
    }
  };

  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: buildHeaders(apiKey), body: JSON.stringify(body) });
  } catch (e) {
    const err = new Error('Network error calling Gemini: ' + (e?.message || e));
    err.stage = 'network';
    throw err;
  }

  const httpOk = res.ok;
  let respJson = null, respText = '';
  try {
    respJson = await res.json();
  } catch {
    // If server didn't return JSON at all
    respText = await res.text().catch(() => '');
  }
  if (!httpOk) {
    const err = new Error(`Gemini HTTP ${res.status}`);
    err.stage = 'http';
    err.httpStatus = res.status;
    err.httpBody = respJson || respText || null;
    throw err;
  }

  // Extract primary text
  const text =
    respJson?.candidates?.[0]?.content?.parts?.[0]?.text ??
    respJson?.candidates?.[0]?.content?.parts?.map(p => p?.text).filter(Boolean).join('\n') ??
    '';

  if (!text) {
    const err = new Error('Gemini returned empty content.');
    err.stage = 'empty';
    err.raw = respJson;
    throw err;
  }

  let parsed;
  try {
    parsed = parseMaybeFencedJSON(text);
  } catch (e) {
    const err = new Error('Gemini response was not valid JSON: ' + (e?.message || e));
    err.stage = 'parse';
    err.rawText = text;
    err.raw = respJson;
    throw err;
  }

  return { json: parsed, rawText: text, raw: respJson };
}

// Public: Questions (5 rounds, 6 Q each)
export async function callGeminiQuestions(apiKey, userPrompt) {
  const preamble = `
You are generating quiz content for a two-player game. OUTPUT MUST BE STRICT JSON ONLY.
Schema:
{
  "rounds": [
    {
      "round": 1,
      "questions": [
        {
          "id": "r1q1",
          "prompt": "string",
          "options": [{"key":"A","text":"string"},{"key":"B","text":"string"}],
          "correct": "A" | "B"
        }
      ]
    }
  ]
}
Rules:
- Exactly 5 rounds, numbered 1..5.
- Exactly 6 questions per round (two-choice).
- "correct" must be "A" or "B".
- Prompts concise (<140 chars). No adult/sensitive topics.
- DO NOT include explanations, markdown, or extra fields.
`;
  return callGemini(apiKey, preamble, userPrompt);
}

// Public: Interludes (4) + Maths pack (2 whole-number questions)
export async function callGeminiInterludesAndMaths(apiKey, userPrompt) {
  const preamble = `
You are generating 4 short interludes and 2 whole-number maths questions. OUTPUT MUST BE STRICT JSON ONLY.
Schema:
{
  "interludes": ["string","string","string","string"],
  "maths": {
    "questions": [
      {"prompt":"string (answer is a whole number)"},
      {"prompt":"string (answer is a whole number)"}
    ],
    "answers": [number, number]
  }
}
Rules:
- Interludes are 1–3 sentences each; no inputs or countdowns.
- Maths answers must be whole numbers; ensure prompts imply that.
- DO NOT include explanations, markdown, or extra fields.
`;
  return callGemini(apiKey, preamble, userPrompt);
}
