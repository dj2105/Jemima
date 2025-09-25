// /src/adapters/jemima-adapter.js
// Deterministically builds 4 interludes and 2 final maths questions from your config.
// No AI calls. Includes a tiny safe expression evaluator.

import { z } from "https://esm.sh/zod@3.23.8";

/* ---------------------------- Config shape check ---------------------------- */
const NumberSpec = z.object({
  name: z.string().min(1),
  min: z.number().int(),
  max: z.number().int()
}).refine(v => v.max >= v.min, { message: "max must be ≥ min" });

const Template = z.object({
  id: z.string().min(1),
  settingChoices: z.array(z.string().min(1)).min(1),
  requiredNumbers: z.array(NumberSpec).min(1),
  textPattern: z.string().min(10)
});

const JMathsSchema = z.object({
  version: z.literal("jmaths-1"),
  global: z.object({
    language: z.string().optional(),
    answerType: z.literal("integer"),
    allowZero: z.boolean().default(false),
    range: z.object({ min: z.number().int(), max: z.number().int() })
      .refine(r => r.max >= r.min, { message: "range.max must be ≥ range.min" })
  }),
  passageTemplates: z.array(Template).min(1),
  roundPlan: z.array(z.object({
    round: z.number().int().min(1).max(4),
    templateId: z.string().min(1)
  })).length(4),
  finalQuestionRecipes: z.array(z.object({
    id: z.string().min(1),
    promptPattern: z.string().min(10),
    compute: z.string().min(1)
  })).length(2)
});

const SeedInterlude = z.object({
  passage: z.string().min(20),
  numbers: z.array(z.number().int())
});
const SeedMaths = z.object({
  q1: z.object({ prompt: z.string().min(10), answer: z.number().int() }),
  q2: z.object({ prompt: z.string().min(10), answer: z.number().int() })
});

function firstIssue(err) {
  const i = err?.issues?.[0];
  if (!i) return "Invalid data";
  const path = i.path?.length ? ` at ${i.path.join(".")}` : "";
  return `${i.message}${path}`;
}

/* --------------------------- Deterministic RNG --------------------------- */
function makeRNG(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return (h % 100000) / 100000;
  };
}
function rndInt(min, max, rng) {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function fillPattern(template, dict) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => String(dict[k] ?? `{${k}}`));
}

/* ------------------------- Tiny safe expression eval ------------------------- */
// Only digits, whitespace, + - * / ( ) and identifiers [a-zA-Z_][a-zA-Z0-9_]* allowed.
function evalCompute(expr, scope) {
  if (!/^[\d\s+\-*/()a-zA-Z0-9_]+$/.test(expr)) {
    throw new Error("Illegal characters in compute expression");
  }
  const replaced = expr.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (name) => {
    if (!(name in scope)) throw new Error(`Unknown symbol ${name}`);
    return String(scope[name]);
  });
  // biome-ignore lint/security/noGlobalEval:
  const result = Function(`"use strict"; return (${replaced});`)();
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("Compute did not yield a finite number");
  }
  return Math.trunc(result);
}

/* ---------------------------------- Export ---------------------------------- */
export async function generateJemimaMaths(jcfgRaw, seedStr) {
  const cfgParse = JMathsSchema.safeParse(jcfgRaw);
  if (!cfgParse.success) throw new Error("jmaths invalid: " + firstIssue(cfgParse.error));
  const cfg = cfgParse.data;

  const rng = makeRNG(String(seedStr || "seed"));
  const tmap = new Map(cfg.passageTemplates.map(t => [t.id, t]));

  const interludes = [];
  const numbersByRound = {}; // {1:{apples:..,pricePence:..}, ...}

  // Build rounds 1–4
  for (const plan of [...cfg.roundPlan].sort((a,b) => a.round - b.round)) {
    const t = tmap.get(plan.templateId);
    if (!t) throw new Error(`Template not found: ${plan.templateId}`);

    const setting = t.settingChoices[Math.floor(rng() * t.settingChoices.length)];
    const dict = {};
    for (const spec of t.requiredNumbers) {
      dict[spec.name] = rndInt(spec.min, spec.max, rng);
    }
    numbersByRound[plan.round] = { ...dict, setting };

    const passage = fillPattern(t.textPattern, { ...dict, setting });
    const interlude = { passage, numbers: Object.values(dict).map(v => Math.trunc(v)) };
    const val = SeedInterlude.safeParse(interlude);
    if (!val.success) throw new Error("Interlude invalid: " + firstIssue(val.error));
    interludes.push(val.data);
  }

  // Scope for compute expressions: every numeric key per round becomes name+round (e.g., apples1, pricePence2)
  const scope = {};
  for (let r = 1; r <= 4; r++) {
    const dict = numbersByRound[r];
    if (!dict) throw new Error(`Missing numbers for round ${r}`);
    for (const [k, v] of Object.entries(dict)) {
      if (k === "setting") continue;
      scope[`${k}${r}`] = Math.trunc(v);
    }
  }

  // Two final questions
  const [R1, R2] = cfg.finalQuestionRecipes;
  const ans1 = evalCompute(R1.compute, scope);
  const ans2 = evalCompute(R2.compute, scope);

  const { min, max } = cfg.global.range;
  const allowZero = cfg.global.allowZero;
  const answers = [ans1, ans2];

  for (const n of answers) {
    if (!Number.isInteger(n)) throw new Error("Final answer must be integer");
    if (!allowZero && n === 0) throw new Error("Zero is not allowed by config");
    if (n < min || n > max) throw new Error(`Answer ${n} out of range ${min}–${max}`);
  }

  const maths = {
    q1: { prompt: R1.promptPattern, answer: ans1 },
    q2: { prompt: R2.promptPattern, answer: ans2 }
  };
  const mathsVal = SeedMaths.safeParse(maths);
  if (!mathsVal.success) throw new Error("Maths payload invalid: " + firstIssue(mathsVal.error));

  return { interludes, maths: mathsVal.data };
}
