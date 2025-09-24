// /src/lib/gemini.js
// Client helper to talk to our Netlify Gemini function.
// Usage example:
//   import { geminiCall } from './lib/gemini.js';
//   const res = await geminiCall({ kind:'questions', spec:{topics:['History']} });

const ENDPOINT = '/.netlify/functions/gemini';

/**
 * Call Gemini through Netlify proxy
 * @param {Object} opts
 * @param {string} opts.kind - "questions" | "interludes" | "maths" | "generic"
 * @param {Object} [opts.spec] - optional JSON spec
 * @param {string} [opts.prompt] - optional custom prompt
 * @param {string} [opts.system] - optional system preface
 * @param {number} [opts.temperature=0.9]
 * @param {number} [opts.seed]
 * @returns {Promise<{ok:boolean,data?:any,error?:string}>}
 */
export async function geminiCall(opts = {}) {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(opts)
    });

    if (!r.ok) {
      const text = await r.text();
      return { ok: false, error: `HTTP ${r.status}`, detail: text };
    }

    const data = await r.json();
    return data;
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}
