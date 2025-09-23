/**
 * Gemini API stub + validation pipeline
 * PR #2: generates 30 questions + Jemima’s Maths puzzle
 */

export async function generateQuestions(count = 30) {
  // TODO: real Gemini API call
  // Stub: simulate verification + rejection
  let verified = 0, rejected = 0;
  const questions = [];

  for (let i = 0; i < count; i++) {
    // Fake data
    questions.push({
      subject: "Stub Subject",
      difficulty_tier: "pub",
      question: `Stub question #${i + 1}?`,
      correct_answer: "Correct",
      distractor: "Wrong"
    });
    verified++;
  }

  return { questions, verified, rejected };
}

export async function generateJemimaMaths() {
  // TODO: replace with Gemini JSON-driven puzzle
  return {
    part1: "Stub puzzle part 1",
    part2: "Stub puzzle part 2",
    part3: "Stub puzzle part 3",
    part4: "Stub puzzle part 4"
  };
}
