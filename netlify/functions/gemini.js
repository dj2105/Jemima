// /netlify/functions/gemini.js
// Calls Gemini API with spec and returns JSON.

import fetch from "node-fetch";

export async function handler(event) {
  try {
    const { kind, spec, temperature } = JSON.parse(event.body || "{}");

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return {
        statusCode: 500,
        body: JSON.stringify({ ok: false, error: "Missing GEMINI_API_KEY" })
      };
    }

    const prompt = buildPrompt(kind, spec);

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: temperature ?? 0.7 }
        })
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        body: JSON.stringify({ ok: false, error: data.error?.message || "Gemini call failed" })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, data })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: String(err) })
    };
  }
}

function buildPrompt(kind, spec) {
  if (kind === "questions" && spec?.mechanics?.gemini_prompts?.generation_prompt) {
    return spec.mechanics.gemini_prompts.generation_prompt;
  }
  if (kind === "interludes" && spec?.system_prompt) {
    return spec.system_prompt;
  }
  if (kind === "maths") {
    return "Generate 2 numeric Jemima maths questions with whole-number answers.";
  }
  return "Hello from Jemima.";
}
