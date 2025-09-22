// Contract only; actual calls land in PR #2.
export const Gemini = {
  async generateQuestionsBatch(/*config, desiredCount*/) {
    // returns { generated:[], rejected:[], verified:[] }
    return { generated: [], rejected: [], verified: [] };
  },
  async verifyQuestions(/*items*/) {
    return { pass: [], fail: [] };
  }
};