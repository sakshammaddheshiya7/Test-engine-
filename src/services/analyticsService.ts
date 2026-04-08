import type { TestAttemptDoc } from "./questionService";

type AttemptLike = Pick<TestAttemptDoc, "accuracy" | "correctAnswers" | "totalQuestions" | "weakChapters" | "topicPerformance">;

type AttemptWithTime = Pick<TestAttemptDoc, "accuracy" | "timeTakenSec" | "totalQuestions" | "createdAt">;

export type DifficultyLevel = "Easy" | "Medium" | "Hard" | "Very Hard";

export type TopicInsight = {
  topic: string;
  attempted: number;
  correct: number;
  accuracy: number;
};

export type AnalyticsSummary = {
  totalTests: number;
  avgAccuracy: number;
  avgScore: number;
  strongestTopic: string;
  weakChapters: string[];
  weakTopics: string[];
  topicInsights: TopicInsight[];
  recentAccuracy: Array<{ label: string; accuracy: number }>;
};

export type HeatmapDay = {
  dateKey: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

export type ExamPrediction = {
  expectedScore: number;
  confidence: "Low" | "Medium" | "High";
  speedIndex: number;
  trend: "Improving" | "Stable" | "Declining";
  summary: string;
};

export type AdminAdvancedInsights = {
  hardestQuestions: Array<{
    questionId: string;
    chapter: string;
    topic: string;
    avgTimeSec: number;
    attempts: number;
    veryHardRate: number;
  }>;
  chapterDifficulty: Array<{
    chapter: string;
    attempts: number;
    avgAccuracy: number;
  }>;
  engagement: {
    activeDays: number;
    attemptsPerActiveDay: number;
    avgAttemptsPerStudent: number;
  };
};

export type PerformanceAlert = {
  chapter: string;
  avgAccuracy: number;
  attempts: number;
  impactedUsers: number;
  severity: "low" | "medium" | "high";
  recommendation: string;
};

export type ContentRecommendation = {
  chapter: string;
  demandScore: number;
  avgAccuracy: number;
  totalAttempts: number;
  suggestion: string;
};

export function getAdaptiveDifficultyByAccuracy(averageAccuracy: number): "easy" | "medium" | "hard" {
  if (averageAccuracy >= 75) {
    return "hard";
  }

  if (averageAccuracy >= 45) {
    return "medium";
  }

  return "easy";
}

export function calculateQuestionDifficultyLevel(input: {
  isCorrect: boolean;
  timeTakenSec: number;
  targetSecPerQuestion: number;
  attemptRatio: number;
}): DifficultyLevel {
  const safeTarget = Math.max(15, input.targetSecPerQuestion);
  const timeStress = input.timeTakenSec / safeTarget;

  let score = 0;
  if (!input.isCorrect) {
    score += 1.8;
  }

  score += Math.min(2.2, Math.max(0, timeStress - 0.8) * 1.3);
  score += Math.min(0.8, Math.max(0, input.attemptRatio - 0.6));

  if (score < 1.1) {
    return "Easy";
  }

  if (score < 2.1) {
    return "Medium";
  }

  if (score < 3.2) {
    return "Hard";
  }

  return "Very Hard";
}

function toDateKey(input: Date) {
  return input.toISOString().slice(0, 10);
}

function normalizeDateFromSeconds(seconds?: number) {
  if (!seconds) {
    return null;
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function buildActivityHeatmap(attempts: Array<Pick<TestAttemptDoc, "createdAt">>, days = 35): HeatmapDay[] {
  const activityByDay: Record<string, number> = {};

  attempts.forEach((attempt) => {
    const date = normalizeDateFromSeconds(attempt.createdAt?.seconds);
    if (!date) {
      return;
    }

    const key = toDateKey(date);
    activityByDay[key] = (activityByDay[key] ?? 0) + 1;
  });

  const end = new Date();
  const result: HeatmapDay[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(end);
    day.setDate(end.getDate() - index);
    const key = toDateKey(day);
    const count = activityByDay[key] ?? 0;
    const level: HeatmapDay["level"] = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;

    result.push({ dateKey: key, count, level });
  }

  return result;
}

export function calculateDailyStreak(attempts: Array<Pick<TestAttemptDoc, "createdAt">>) {
  const uniqueDays = new Set<string>();

  attempts.forEach((attempt) => {
    const date = normalizeDateFromSeconds(attempt.createdAt?.seconds);
    if (!date) {
      return;
    }

    uniqueDays.add(toDateKey(date));
  });

  if (!uniqueDays.size) {
    return 0;
  }

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = toDateKey(cursor);
    if (!uniqueDays.has(key)) {
      if (streak === 0) {
        cursor.setDate(cursor.getDate() - 1);
        const previousKey = toDateKey(cursor);
        if (uniqueDays.has(previousKey)) {
          streak += 1;
          continue;
        }
      }
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function buildSpeedInsight(attempts: Array<Pick<TestAttemptDoc, "timeTakenSec" | "totalQuestions">>) {
  const valid = attempts.filter((attempt) => attempt.totalQuestions > 0 && attempt.timeTakenSec > 0);
  if (!valid.length) {
    return {
      avgSecPerQuestion: 0,
      speedBand: "No speed data yet",
    };
  }

  const totalSecPerQuestion = valid.reduce((sum, attempt) => sum + attempt.timeTakenSec / attempt.totalQuestions, 0);
  const avgSecPerQuestion = Math.round(totalSecPerQuestion / valid.length);
  const speedBand =
    avgSecPerQuestion <= 55
      ? "Fast"
      : avgSecPerQuestion <= 85
        ? "Balanced"
        : avgSecPerQuestion <= 120
          ? "Needs speed practice"
          : "Slow - prioritize timer drills";

  return {
    avgSecPerQuestion,
    speedBand,
  };
}

export function buildSlowTopicInsights(
  attempts: Array<Pick<TestAttemptDoc, "difficultyInsights">>,
  minSamples = 2,
) {
  const topicTimeMap: Record<string, { total: number; count: number }> = {};

  attempts.forEach((attempt) => {
    (attempt.difficultyInsights ?? []).forEach((row) => {
      const key = row.topic?.trim() || "Unknown Topic";
      const current = topicTimeMap[key] ?? { total: 0, count: 0 };
      current.total += Math.max(0, row.timeTakenSec || 0);
      current.count += 1;
      topicTimeMap[key] = current;
    });
  });

  return Object.entries(topicTimeMap)
    .map(([topic, stats]) => ({
      topic,
      avgSec: Math.round(stats.total / Math.max(1, stats.count)),
      attempts: stats.count,
    }))
    .filter((row) => row.attempts >= minSamples)
    .sort((a, b) => b.avgSec - a.avgSec)
    .slice(0, 4);
}

export function predictExamScore(attempts: AttemptWithTime[]): ExamPrediction {
  if (!attempts.length) {
    return {
      expectedScore: 0,
      confidence: "Low",
      speedIndex: 0,
      trend: "Stable",
      summary: "Not enough test history. Complete at least 3 tests for a stable prediction.",
    };
  }

  const recent = attempts.slice(0, 12);
  const avgAccuracy = recent.reduce((sum, item) => sum + item.accuracy, 0) / recent.length;
  const avgSecPerQuestion =
    recent.reduce((sum, item) => sum + item.timeTakenSec / Math.max(1, item.totalQuestions), 0) / recent.length;
  const speedScore = Math.max(0, Math.min(100, Math.round(120 - avgSecPerQuestion)));
  const expectedScore = Math.max(0, Math.min(100, Math.round(avgAccuracy * 0.78 + speedScore * 0.22)));

  const latest = recent[0]?.accuracy ?? avgAccuracy;
  const oldest = recent[recent.length - 1]?.accuracy ?? avgAccuracy;
  const delta = latest - oldest;
  const trend: ExamPrediction["trend"] = delta > 5 ? "Improving" : delta < -5 ? "Declining" : "Stable";

  const confidence: ExamPrediction["confidence"] = recent.length >= 8 ? "High" : recent.length >= 4 ? "Medium" : "Low";
  const summary =
    trend === "Improving"
      ? "Your trend is improving. Keep daily revision and timed practice for a higher expected score."
      : trend === "Declining"
        ? "Your trend dipped recently. Focus on weak chapters and shorter timed sets this week."
        : "Your trend is stable. Increase adaptive hard tests to push score upward.";

  return {
    expectedScore,
    confidence,
    speedIndex: speedScore,
    trend,
    summary,
  };
}

export function buildAdminAdvancedInsights(
  attempts: Array<
    Pick<TestAttemptDoc, "difficultyInsights" | "topicPerformance" | "createdAt" | "accuracy"> & {
      userId: string;
    }
  >,
): AdminAdvancedInsights {
  const difficultyMap: Record<string, { chapter: string; topic: string; attempts: number; totalTime: number; veryHard: number }> = {};
  const chapterMap: Record<string, { attempted: number; correct: number }> = {};
  const daySet = new Set<string>();
  const userSet = new Set<string>();

  attempts.forEach((attempt) => {
    userSet.add(attempt.userId);
    const day = normalizeDateFromSeconds(attempt.createdAt?.seconds);
    if (day) {
      daySet.add(toDateKey(day));
    }

    Object.entries(attempt.topicPerformance ?? {}).forEach(([topic, stats]) => {
      const chapter = topic.split("::")[0] || "General";
      const entry = chapterMap[chapter] ?? { attempted: 0, correct: 0 };
      entry.attempted += stats.attempted;
      entry.correct += stats.correct;
      chapterMap[chapter] = entry;
    });

    (attempt.difficultyInsights ?? []).forEach((item) => {
      const qid = item.questionId || `${item.chapter}-${item.topic}`;
      const row = difficultyMap[qid] ?? {
        chapter: item.chapter || "General",
        topic: item.topic || "General",
        attempts: 0,
        totalTime: 0,
        veryHard: 0,
      };
      row.attempts += 1;
      row.totalTime += Math.max(0, item.timeTakenSec || 0);
      if (item.level === "Very Hard") {
        row.veryHard += 1;
      }
      difficultyMap[qid] = row;
    });
  });

  const hardestQuestions = Object.entries(difficultyMap)
    .map(([questionId, row]) => ({
      questionId,
      chapter: row.chapter,
      topic: row.topic,
      attempts: row.attempts,
      avgTimeSec: Math.round(row.totalTime / Math.max(1, row.attempts)),
      veryHardRate: Math.round((row.veryHard / Math.max(1, row.attempts)) * 100),
    }))
    .filter((row) => row.attempts >= 2)
    .sort((a, b) => b.veryHardRate - a.veryHardRate || b.avgTimeSec - a.avgTimeSec)
    .slice(0, 8);

  const chapterDifficulty = Object.entries(chapterMap)
    .map(([chapter, row]) => ({
      chapter,
      attempts: row.attempted,
      avgAccuracy: row.attempted ? Math.round((row.correct / row.attempted) * 100) : 0,
    }))
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
    .slice(0, 8);

  const activeDays = daySet.size;
  const attemptsPerActiveDay = activeDays ? Number((attempts.length / activeDays).toFixed(1)) : 0;
  const avgAttemptsPerStudent = userSet.size ? Number((attempts.length / userSet.size).toFixed(1)) : 0;

  return {
    hardestQuestions,
    chapterDifficulty,
    engagement: {
      activeDays,
      attemptsPerActiveDay,
      avgAttemptsPerStudent,
    },
  };
}

export function buildPerformanceAlerts(
  attempts: Array<
    Pick<TestAttemptDoc, "topicPerformance"> & {
      userId: string;
    }
  >,
): PerformanceAlert[] {
  const chapterStats: Record<string, { attempted: number; correct: number; users: Set<string> }> = {};

  attempts.forEach((attempt) => {
    Object.entries(attempt.topicPerformance ?? {}).forEach(([topicKey, row]) => {
      const chapter = topicKey.split("::")[0] || "General";
      const current = chapterStats[chapter] ?? { attempted: 0, correct: 0, users: new Set<string>() };
      current.attempted += row.attempted;
      current.correct += row.correct;
      current.users.add(attempt.userId);
      chapterStats[chapter] = current;
    });
  });

  return Object.entries(chapterStats)
    .map(([chapter, stats]) => {
      const avgAccuracy = stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0;
      const impactedUsers = stats.users.size;
      const severity: PerformanceAlert["severity"] =
        avgAccuracy < 35 ? "high" : avgAccuracy < 50 ? "medium" : "low";
      const recommendation =
        severity === "high"
          ? "Run an urgent concept-rebuild test and publish extra solved examples."
          : severity === "medium"
            ? "Push a targeted booster set with mixed PYQ and chapter drill."
            : "Monitor this chapter and add moderate difficulty reinforcement.";

      return {
        chapter,
        avgAccuracy,
        attempts: stats.attempted,
        impactedUsers,
        severity,
        recommendation,
      };
    })
    .filter((row) => row.attempts >= 20 && row.impactedUsers >= 5)
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy)
    .slice(0, 8);
}

export function buildContentRecommendations(
  attempts: Array<
    Pick<TestAttemptDoc, "topicPerformance"> & {
      userId: string;
    }
  >,
): ContentRecommendation[] {
  const chapterStats: Record<string, { attempted: number; correct: number }> = {};

  attempts.forEach((attempt) => {
    Object.entries(attempt.topicPerformance ?? {}).forEach(([topicKey, row]) => {
      const chapter = topicKey.split("::")[0] || "General";
      const current = chapterStats[chapter] ?? { attempted: 0, correct: 0 };
      current.attempted += row.attempted;
      current.correct += row.correct;
      chapterStats[chapter] = current;
    });
  });

  return Object.entries(chapterStats)
    .map(([chapter, stats]) => {
      const avgAccuracy = stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0;
      const demandScore = Math.round(stats.attempted * (1 + (100 - avgAccuracy) / 100));
      const suggestion =
        avgAccuracy < 40
          ? "Add 40+ foundational and medium-level questions with detailed solutions."
          : avgAccuracy < 60
            ? "Add mixed timed sets and chapter revision flashcards."
            : "Add advanced challenge questions to push top performers.";
      return {
        chapter,
        demandScore,
        avgAccuracy,
        totalAttempts: stats.attempted,
        suggestion,
      };
    })
    .sort((a, b) => b.demandScore - a.demandScore)
    .slice(0, 8);
}

export function buildAnalyticsSummary<T extends AttemptLike>(attempts: T[]): AnalyticsSummary {
  if (attempts.length === 0) {
    return {
      totalTests: 0,
      avgAccuracy: 0,
      avgScore: 0,
      strongestTopic: "-",
      weakChapters: [],
      weakTopics: [],
      topicInsights: [],
      recentAccuracy: [],
    };
  }

  const totalAccuracy = attempts.reduce((sum, row) => sum + row.accuracy, 0);
  const totalScore = attempts.reduce((sum, row) => {
    const score = row.totalQuestions ? row.correctAnswers / row.totalQuestions : 0;
    return sum + score * 100;
  }, 0);

  const chapterWeakness: Record<string, number> = {};
  const topicAccuracy: Record<string, { attempted: number; correct: number }> = {};

  attempts.forEach((attempt) => {
    attempt.weakChapters.forEach((chapter) => {
      chapterWeakness[chapter] = (chapterWeakness[chapter] ?? 0) + 1;
    });

    Object.entries(attempt.topicPerformance ?? {}).forEach(([topic, stats]) => {
      const current = topicAccuracy[topic] ?? { attempted: 0, correct: 0 };
      current.attempted += stats.attempted;
      current.correct += stats.correct;
      topicAccuracy[topic] = current;
    });
  });

  const strongestTopic =
    Object.entries(topicAccuracy)
      .filter(([, value]) => value.attempted > 0)
      .sort((a, b) => b[1].correct / b[1].attempted - a[1].correct / a[1].attempted)[0]?.[0] ?? "-";

  const weakChapters = Object.entries(chapterWeakness)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([chapter]) => chapter);

  const topicInsights = Object.entries(topicAccuracy)
    .map(([topic, stats]) => {
      const accuracy = stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0;
      return {
        topic,
        attempted: stats.attempted,
        correct: stats.correct,
        accuracy,
      };
    })
    .filter((row) => row.attempted > 0)
    .sort((a, b) => {
      if (a.accuracy === b.accuracy) {
        return b.attempted - a.attempted;
      }

      return a.accuracy - b.accuracy;
    });

  const weakTopics = topicInsights.slice(0, 5).map((row) => row.topic);

  const recentAccuracy = [...attempts]
    .slice(0, 8)
    .reverse()
    .map((attempt, index) => ({
      label: `T${index + 1}`,
      accuracy: attempt.accuracy,
    }));

  return {
    totalTests: attempts.length,
    avgAccuracy: Math.round(totalAccuracy / attempts.length),
    avgScore: Math.round(totalScore / attempts.length),
    strongestTopic,
    weakChapters,
    weakTopics,
    topicInsights,
    recentAccuracy,
  };
}