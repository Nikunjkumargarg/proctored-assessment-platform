function normalizeMultiple(values) {
  if (!Array.isArray(values)) return [];
  return [...values].map(String).sort();
}

function isObjectiveCorrect(question, answerValue) {
  if (question.type === 'short_answer') return null;

  if (question.type === 'single_choice') {
    const expected = question.correctAnswers[0];
    return String(answerValue ?? '') === String(expected ?? '');
  }

  if (question.type === 'multiple_choice') {
    const expected = normalizeMultiple(question.correctAnswers);
    const actual = normalizeMultiple(answerValue);
    if (expected.length !== actual.length) return false;
    return expected.every((v, i) => v === actual[i]);
  }

  return false;
}

function scoreAttempt(assessment, answers) {
  const answerMap = new Map(
    (answers || []).map((a) => [String(a.questionId), a.value])
  );

  let score = 0;
  let maxScore = 0;

  for (const question of assessment.questions) {
    const points = question.points ?? 1;
    if (question.type === 'short_answer') {
      // Short answers are stored but not auto-scored
      continue;
    }
    maxScore += points;
    const value = answerMap.get(String(question._id));
    if (isObjectiveCorrect(question, value)) {
      score += points;
    }
  }

  return { score, maxScore };
}

function stripCorrectAnswers(assessmentDoc) {
  const obj = assessmentDoc.toObject ? assessmentDoc.toObject() : { ...assessmentDoc };
  obj.questions = (obj.questions || []).map((q) => {
    const { correctAnswers, ...rest } = q;
    return rest;
  });
  return obj;
}

module.exports = {
  scoreAttempt,
  stripCorrectAnswers,
  isObjectiveCorrect,
};
