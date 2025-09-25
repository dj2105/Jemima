// /src/adapters/questions-adapter.js
// Calls Gemini to generate 5 rounds × (3 host + 3 guest) of A/B questions.
// Enforces strict shape, clamps lengths, and throws clear errors on bad responses.

import { z } from "https://esm.sh/zod@3.23.8";

/* ---------- Minimal config schema (runtime check, no TypeScript needed) ---------- */
const Topic = z.object({
  name: z.string().min(1),
  weight: z.number().positive().max(2).optional()
});
const Diff = z.object({
  round: z.number().int().min(1).max(5),
  level: z.enum(["easy","easy+","medium","hard","hard+"])
});
const QCfgSchema = z.object({
  version: z.literal("qcfg-1"),
  topics: z.array(Topic).min(1),
  difficultyCurve: z.array(Diff).length(5),
  composition: z.object({
    perRound: z.object({
      host: z.object({ count: z.literal(3) }),
      guest: z.object({ count: z.literal(3) })
    })
  }),
  global: z.object({
    language: z.string().optional(),
    twoChoiceOnly: z.boolean().optional(),
    maxQuestionChars: z.number().int().optional(),
    maxAnswerChars: z.number().int().optional()
  }).optional()
});

/* ----------------------------- Output shape check ----------------------------- */
const SeedQItem = z.object({
  q: z.string().min(6),
  a1: z.string().min(1),
  a2: z.string().min(1),
  correct: z.number().int().min(0).max(1)
});
const RoundSchema = z.object({
  hostQ: z.array(SeedQItem).length(3),
  guestQ: z.array(SeedQItem).length(3)
});
const AllRoundsSchema = z.array(RoundSchema).length(5);

function firstIssue(err) {
  const i = err?.issues?.[0];
  if (!i) return "Invalid data";
  const path = i.path?.length ? ` at ${i.path.join(".")}` : "";
  return `${i.message}${path}`;
}

/* ---------------------------------- Helpers ---------------------------------- */
function clamp(s, max) {
  if (typeof s !== "string") return s;
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function buildPrompt(qcfg) {
  // compact + explicit; model must return STRICT JSON
  return {
    role: "You generate compact trivia rounds as STRICT JSON only.",
    instructions: {
      language: qcfg.global?.language ?? "en-GB",
      twoChoiceOnly: true,
      maxQuestionChars: qcfg.global?.maxQuestionChars ?? 180,
      maxAnswerChars: qcfg.global?.maxAnswerChars ?? 60,
      difficultyCurve: qcfg.difficultyCurve,
      topics: qcfg.topics,
      constraints: {
        maxPerTopicPerGame: qcfg.composition?.perRound ? 2 : 2,
        avoidTrivial: true,
        avoidOverlappingFacts: true
      },
      outputSchema: {
        rounds: [
          {
            hostQ: [{ q: "string", a1: "string", a2: "string", correct: 0 }],
            guestQ: [{ q: "string", a1: "string", a2: "string", correct: 1 }]
          }
        ] // exactly 5 rounds
      }
    },
    rules: [
      "Exactly 5 rounds.",
      "Each round: 3 hostQ + 3 guestQ.",
      "Each question has exactly two answers a1, a2.",
      "correct is 0 or 1 and points to the correct option index.",
      "Avoid trivial/overused facts and duplicates.",
      "Keep stems ≤ maxQuestionChars; answers ≤ maxAnswerChars.",
      "Return STRICT JSON only. No prose, no markdown."
    ]
  };
}

async function callGeminiJSON(apiKey, payload) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
    encodeURIComponent(apiKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
      generationConfig: { temperature: 0.6 }
    })
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${txt || res.statusText}`);
  }

  const json = await res.json().catch(() => ({}));
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini did not return text.");
  }
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    throw new Error("Gemini did not return JSON.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}

/* ---------------------------------- Export ---------------------------------- */
export async function generateSeedQuestions(apiKey, qcfgRaw) {
  // Validate config
  const cfgParse = QCfgSchema.safeParse(qcfgRaw);
  if (!cfgParse.success) throw new Error("qcfg invalid: " + firstIssue(cfgParse.error));
  const qcfg = cfgParse.data;

  // Build prompt & call model
  const prompt = buildPrompt(qcfg);
  const modelOut = await callGeminiJSON(apiKey, prompt);

  // Validate shape (accept either {rounds:[...]} or [...] root)
  const roundsCandidate = Array.isArray(modelOut) ? modelOut : modelOut?.rounds;
  const parsed = AllRoundsSchema.safeParse(roundsCandidate);
  if (!parsed.success) throw new Error("Gemini rounds invalid: " + firstIssue(parsed.error));

  // Length clamps & correctness checks
  const qMax = qcfg.global?.maxQuestionChars ?? 180;
  const aMax = qcfg.global?.maxAnswerChars ?? 60;

  for (const r of parsed.data) {
    for (const it of [...r.hostQ, ...r.guestQ]) {
      it.q = clamp(it.q, qMax);
      it.a1 = clamp(it.a1, aMax);
      it.a2 = clamp(it.a2, aMax);
      if (!(it.correct === 0 || it.correct === 1)) {
        throw new Error("correct must be 0 or 1");
      }
    }
  }

  // Return in strict shape
  return { rounds: parsed.data };
}
