// src/lib/jemima.js
// Simple local generator; later swap to Gemini using your full prompt pack.

export async function generateJemima() {
  // Simulate a tiny delay
  await new Promise(r => setTimeout(r, 180));
  // Pick one of a few local samples (add more if you like)
  const samples = [aldi(), lidl(), jdSports(), themePark()];
  const pick = samples[Math.floor(Math.random() * samples.length)];
  return pick;
}

export function validateJemima(obj) {
  try {
    return !!(
      obj &&
      typeof obj.location === "string" &&
      Array.isArray(obj.beats) && obj.beats.length === 4 &&
      Array.isArray(obj.questions) && obj.questions.length === 2 &&
      Array.isArray(obj.answers) && obj.answers.length === 2 &&
      obj.answers.every(Number.isInteger)
    );
  } catch {
    return false;
  }
}

// --- Local samples (based on your pack) ---
function aldi() {
  return {
    location: "Aldi",
    beats: [
      "Jemima entered with €10 and a tote that says ‘Yes Chef’.",
      "She bought 3 apples for €1 each and a 500 ml lemonade for €2.",
      "She drank 250 ml immediately because fizz is urgent.",
      "She waved at 4 trolley coins like old friends."
    ],
    questions: [
      "How much change did Jemima get? ___ euros",
      "How much lemonade was left? ___ millilitres"
    ],
    answers: [5, 250]
  };
}

function lidl() {
  return {
    location: "Lidl",
    beats: [
      "Jemima arrived with €5 and a grin.",
      "She bought 2 bananas at €1 each and a roll for €1.",
      "She gifted 1 banana to a toddler.",
      "She performed 3 goose honks at the doors."
    ],
    questions: [
      "How much change did Jemima get? ___ euros",
      "How many bananas did Jemima have left? ___ bananas"
    ],
    answers: [2, 1]
  };
}

function jdSports() {
  return {
    location: "JD Sports",
    beats: [
      "Jemima had €30 and athletic intentions.",
      "She bought a headband for €5 and a bottle for €7.",
      "She did 8 giant steps to test the headband’s speed properties.",
      "Then she added colourful laces for €3."
    ],
    questions: [
      "How much money was left after all purchases? ___ euros",
      "How many items did she buy in total? ___ items"
    ],
    answers: [15, 3]
  };
}

function themePark() {
  return {
    location: "Theme park",
    beats: [
      "Jemima purchased 4 ride tickets at €3 each.",
      "She rode 3 times and saved 1 for later (responsible thrills).",
      "A mascot made her laugh 7 times, carefully counted.",
      "She bought a cone for €2; the wind stole exactly 0 sprinkles."
    ],
    questions: [
      "How much did the ride tickets cost in total? ___ euros",
      "How many ride tickets does Jemima have left? ___ tickets"
    ],
    answers: [12, 1]
  };
}
