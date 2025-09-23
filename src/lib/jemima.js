// src/lib/jemima.js
// Minimal adapter to use your provided pack locally (no Gemini call yet).
// Picks a random example per interlude request and validates shape.

const pack = /* your JSON goes here or import from a file */ {
  examples: [
    // trimmed: paste your JSON "examples" array here.
    {
      "location": "Lidl",
      "beats": [
        "Jemima arrived with €5 and a grin, declaring she would only buy essentials (bananas count as essentials).",
        "She bought 2 bananas at €1 each and a bread roll for €1.",
        "On the way out, she gifted 1 banana to a toddler wearing a cape.",
        "She performed 3 goose honks at the automatic doors for luck."
      ],
      "questions": [
        "How much change did Jemima get? ___ euros",
        "How many bananas did Jemima have left? ___ bananas"
      ],
      "answers": [2, 1]
    },
    // ... include the rest of your examples here ...
  ]
};

export function validateJemima(obj) {
  return obj
    && typeof obj.location === "string"
    && Array.isArray(obj.beats) && obj.beats.length === 4
    && Array.isArray(obj.questions) && obj.questions.length === 2
    && Array.isArray(obj.answers) && obj.answers.length === 2
    && obj.answers.every(Number.isInteger);
}

export async function getInterludeSample() {
  const ex = pack.examples[Math.floor(Math.random() * pack.examples.length)];
  // shallow clone to avoid mutation
  const copy = JSON.parse(JSON.stringify(ex));
  if (!validateJemima(copy)) throw new Error("Invalid interlude sample");
  return copy;
}
