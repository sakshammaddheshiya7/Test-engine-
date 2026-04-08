export function scoreCalculator(total: number, correct: number) {
  if (!total) {
    return {
      score: 0,
      accuracy: 0,
    };
  }

  const accuracy = Math.round((correct / total) * 100);
  return {
    score: correct,
    accuracy,
  };
}
