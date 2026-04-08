import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { db } from "../firebase/firebaseConfig";
import QuestionSupport from "../components/QuestionSupport";
import { QuestionDiscussion } from "../components/QuestionDiscussion";
import {
  generateMistakeAnalysis,
  generateQuestionsWithAiFallback,
  normalizeAiToolsSettings,
  type AiToolsSettings,
} from "../services/aiService";
import { calculateQuestionDifficultyLevel, getAdaptiveDifficultyByAccuracy } from "../services/analyticsService";
import { getQuestionThreadId } from "../services/discussionService";
import {
  bookmarkQuestion,
  generateCustomTest,
  listenToUserTestHistory,
  saveTestAttempt,
  saveWrongQuestion,
  type MistakeAnalysis,
  type QuestionDifficultyInsight,
  type QuestionDoc,
  type TopicPerformance,
} from "../services/questionService";
import { scoreCalculator } from "../utils/scoreCalculator";
import { getOfflineQuestionPackById, saveOfflineQuestionPack } from "../services/offlineService";
import { claimUsage, listenUsagePolicy, type UsagePolicy } from "../services/experienceService";
import { evaluateTestSecurity, shouldShowBreakReminder, type TestSecurityCounters } from "../services/testSecurityService";
import { listenContentLicensingPolicy, type ContentLicensingPolicy } from "../services/adminInfrastructureService";
import { isPrimaryAdminEmail } from "../config/admin";

type FiltersState = {
  subject: string;
  chapter: string;
  topic: string;
  difficulty: string;
  type: string;
  numberOfQuestions: number;
  durationMinutes: number;
  adaptiveMode: boolean;
};

const defaultFilters: FiltersState = {
  subject: "",
  chapter: "",
  topic: "",
  difficulty: "",
  type: "",
  numberOfQuestions: 10,
  durationMinutes: 20,
  adaptiveMode: true,
};

export default function CustomTest() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<FiltersState>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [testStartedAt, setTestStartedAt] = useState<number | null>(null);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [answerLog, setAnswerLog] = useState<
    Array<{ chapter: string; topic: string; isCorrect: boolean; timeTakenSec: number; questionId: string }>
  >([]);
  const [paused, setPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(defaultFilters.durationMinutes * 60);
  const [testElapsedSeconds, setTestElapsedSeconds] = useState(0);
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [aiTools, setAiTools] = useState<AiToolsSettings | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiInfo, setAiInfo] = useState("");
  const [testError, setTestError] = useState("");
  const [recentAvgAccuracy, setRecentAvgAccuracy] = useState(0);
  const [difficultyInsights, setDifficultyInsights] = useState<QuestionDifficultyInsight[]>([]);
  const [mistakeAnalysis, setMistakeAnalysis] = useState<MistakeAnalysis | null>(null);
  const [offlineStatus, setOfflineStatus] = useState("");
  const [isContentFrozen, setIsContentFrozen] = useState(false);
  const [discussionEnabled, setDiscussionEnabled] = useState(true);
  const [securityCounters, setSecurityCounters] = useState<TestSecurityCounters>({
    tabSwitches: 0,
    copyAttempts: 0,
    contextMenuOpens: 0,
  });
  const [breakReminderShown, setBreakReminderShown] = useState(false);
  const [usagePolicy, setUsagePolicy] = useState<UsagePolicy>({
    dailyAiMessages: 30,
    dailyPdfDownloads: 20,
    dailyTestAttempts: 12,
    premiumModeEnabled: false,
  });
  const [licensingPolicy, setLicensingPolicy] = useState<ContentLicensingPolicy>({
    enablePremiumAccess: false,
    premiumSubjects: [],
    lockedPdfCategories: [],
    premiumMessage: "This content is available in premium access mode.",
  });
  const savingAttemptRef = useRef(false);

  const currentQuestion = questions[currentIndex];
  const currentQuestionKey = currentQuestion?.id ?? currentQuestion?.question ?? "";
  const testFinished = questions.length > 0 && currentIndex >= questions.length;
  const progress = questions.length ? Math.round((currentIndex / questions.length) * 100) : 0;
  const currentQuestionTime = currentQuestionKey ? questionTimeSpent[currentQuestionKey] ?? 0 : 0;

  const score = useMemo(
    () => scoreCalculator(questions.length, correctCount),
    [correctCount, questions.length],
  );

  const testInsights = useMemo(() => {
    const chapterStats = new Map<string, { attempted: number; wrong: number }>();
    const topicStats: Record<string, TopicPerformance> = {};

    answerLog.forEach((row) => {
      const chapterKey = row.chapter || "Unknown Chapter";
      const topicKey = row.topic || "Unknown Topic";

      const chapterState = chapterStats.get(chapterKey) ?? { attempted: 0, wrong: 0 };
      chapterState.attempted += 1;
      if (!row.isCorrect) {
        chapterState.wrong += 1;
      }
      chapterStats.set(chapterKey, chapterState);

      const topicState = topicStats[topicKey] ?? { attempted: 0, correct: 0 };
      topicState.attempted += 1;
      if (row.isCorrect) {
        topicState.correct += 1;
      }
      topicStats[topicKey] = topicState;
    });

    const weakChapters = [...chapterStats.entries()]
      .filter(([, value]) => value.wrong > 0)
      .sort((a, b) => b[1].wrong - a[1].wrong)
      .map(([chapter]) => chapter)
      .slice(0, 3);

    return {
      weakChapters,
      topicStats,
    };
  }, [answerLog]);

  const adaptiveDifficulty = useMemo(() => getAdaptiveDifficultyByAccuracy(recentAvgAccuracy), [recentAvgAccuracy]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const unsubscribe = listenToUserTestHistory(user.uid, (rows) => {
      if (!rows.length) {
        setRecentAvgAccuracy(0);
        return;
      }

      const average = Math.round(rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length);
      setRecentAvgAccuracy(average);
    }, 12);

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "platform_settings", "ai_tools"), (snapshot) => {
      if (!snapshot.exists()) {
        setAiTools(null);
        return;
      }

      setAiTools(normalizeAiToolsSettings(snapshot.data() as Partial<AiToolsSettings>));
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "platform_settings", "global_app_config"), (snapshot) => {
      const data = snapshot.data() as {
        systemFlags?: { contentFreezeMode?: boolean };
        featureToggles?: { discussion?: boolean };
      } | undefined;
      const freezeFlag = data?.systemFlags?.contentFreezeMode;
      setIsContentFrozen(Boolean(freezeFlag));
      setDiscussionEnabled(data?.featureToggles?.discussion !== false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return listenUsagePolicy(setUsagePolicy);
  }, []);

  useEffect(() => {
    return listenContentLicensingPolicy(setLicensingPolicy);
  }, []);

  useEffect(() => {
    const packId = searchParams.get("offlinePack");
    if (!packId || questions.length) {
      return;
    }

    const pack = getOfflineQuestionPackById(packId);
    if (!pack) {
      setOfflineStatus("Offline pack not found on this device.");
      return;
    }

    startTestWithQuestions(pack.questions);
    setOfflineStatus(`Loaded offline pack: ${pack.title}`);
  }, [questions.length, searchParams]);

  function startTestWithQuestions(nextQuestions: QuestionDoc[]) {
    setQuestions(nextQuestions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setCorrectCount(0);
    setShowSolution(false);
    setTestStartedAt(Date.now());
    setAttemptSaved(false);
    setAnswerLog([]);
    setPaused(false);
    setRemainingSeconds(Math.max(1, filters.durationMinutes) * 60);
    setTestElapsedSeconds(0);
    setQuestionTimeSpent({});
    setMarkedForReview([]);
    setDifficultyInsights([]);
    setMistakeAnalysis(null);
    setBreakReminderShown(false);
    setSecurityCounters({ tabSwitches: 0, copyAttempts: 0, contextMenuOpens: 0 });
  }

  useEffect(() => {
    if (!questions.length || testFinished || paused) {
      return;
    }

    const activeQuestionId = currentQuestion?.id ?? currentQuestion?.question;
    const timer = window.setInterval(() => {
      setTestElapsedSeconds((prev) => prev + 1);
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setCurrentIndex(questions.length);
          setPaused(true);
          return 0;
        }

        return prev - 1;
      });

      if (activeQuestionId) {
        setQuestionTimeSpent((prev) => ({
          ...prev,
          [activeQuestionId]: (prev[activeQuestionId] ?? 0) + 1,
        }));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentQuestionKey, paused, questions.length, testFinished]);

  useEffect(() => {
    if (!questions.length || testFinished) {
      return;
    }

    const onVisibility = () => {
      if (document.hidden) {
        setSecurityCounters((prev) => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
      }
    };

    const onCopy = () => {
      setSecurityCounters((prev) => ({ ...prev, copyAttempts: prev.copyAttempts + 1 }));
    };

    const onContextMenu = () => {
      setSecurityCounters((prev) => ({ ...prev, contextMenuOpens: prev.contextMenuOpens + 1 }));
    };

    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("copy", onCopy);
    document.addEventListener("contextmenu", onContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, [questions.length, testFinished]);

  useEffect(() => {
    if (breakReminderShown || !questions.length || testFinished) {
      return;
    }

    if (shouldShowBreakReminder(testElapsedSeconds)) {
      setBreakReminderShown(true);
    }
  }, [breakReminderShown, questions.length, testElapsedSeconds, testFinished]);

  useEffect(() => {
    async function syncAttempt() {
      if (!user || !testFinished || attemptSaved || questions.length === 0) {
        return;
      }
      if (savingAttemptRef.current) {
        return;
      }

      savingAttemptRef.current = true;

      try {
        const wrongAttempts = answerLog.filter((row) => !row.isCorrect).map((row) => ({
          chapter: row.chapter,
          topic: row.topic,
          timeTakenSec: row.timeTakenSec,
        }));
        const computedMistakeAnalysis = await generateMistakeAnalysis(
          {
            exam: "NEET/JEE",
            wrongAttempts,
          },
          aiTools ?? undefined,
        );
        setMistakeAnalysis(computedMistakeAnalysis);

        const elapsedSeconds = testElapsedSeconds || (testStartedAt ? Math.max(1, Math.round((Date.now() - testStartedAt) / 1000)) : 0);
        const testSecurity = evaluateTestSecurity({
          counters: securityCounters,
          totalQuestions: questions.length,
          elapsedSec: elapsedSeconds,
        });
        await saveTestAttempt({
          userId: user.uid,
          userEmail: user.email ?? "",
          userDisplayName: user.displayName ?? "",
          totalQuestions: questions.length,
          correctAnswers: correctCount,
          timeTakenSec: elapsedSeconds,
          filters,
          weakChapters: testInsights.weakChapters,
          topicPerformance: testInsights.topicStats,
          adaptiveDifficulty: filters.adaptiveMode && !filters.difficulty ? adaptiveDifficulty : undefined,
          difficultyInsights,
          mistakeAnalysis: computedMistakeAnalysis,
          testSecurity,
        });
        setAttemptSaved(true);
      } finally {
        savingAttemptRef.current = false;
      }
    }

    void syncAttempt();
  }, [
    adaptiveDifficulty,
    aiTools,
    answerLog,
    attemptSaved,
    correctCount,
    difficultyInsights,
    filters,
    questions.length,
    securityCounters,
    testElapsedSeconds,
    testFinished,
    testInsights,
    testStartedAt,
    user,
  ]);

  async function onGenerateTest() {
    if (isContentFrozen) {
      setTestError("Question attempts are temporarily frozen. Please retry later.");
      return;
    }
    setLoading(true);
    setTestError("");
    try {
      const isAdminSession = isPrimaryAdminEmail(user?.email);
      const subjectLocked =
        licensingPolicy.enablePremiumAccess &&
        Boolean(filters.subject.trim()) &&
        licensingPolicy.premiumSubjects.map((item) => item.toLowerCase()).includes(filters.subject.trim().toLowerCase());
      if (subjectLocked && !isAdminSession) {
        setTestError(licensingPolicy.premiumMessage || "Selected subject is locked in premium mode.");
        return;
      }

      if (user) {
        const usage = await claimUsage(user.uid, "test", usagePolicy.dailyTestAttempts);
        if (!usage.allowed) {
          setTestError(`Daily test limit reached (${usage.limit}). Try again tomorrow or ask admin to increase limit.`);
          return;
        }
      }

      const effectiveFilters = {
        ...filters,
        difficulty: filters.difficulty || (filters.adaptiveMode ? adaptiveDifficulty : ""),
      };
      const generated = await generateCustomTest(effectiveFilters);
      startTestWithQuestions(generated);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Unable to generate test right now.");
    } finally {
      setLoading(false);
    }
  }

  async function onGenerateAiTest() {
    if (!aiTools?.enableStudentAi || !aiPrompt.trim()) {
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiInfo("");
    try {
      if (user) {
        const usage = await claimUsage(user.uid, "ai", usagePolicy.dailyAiMessages);
        if (!usage.allowed) {
          setAiError(`Daily AI limit reached (${usage.limit}). Try again tomorrow or ask admin to increase limit.`);
          return;
        }
      }

      const result = await generateQuestionsWithAiFallback(
        {
          provider: aiTools.provider,
          model: aiTools.model,
          subject: filters.subject || "Physics",
          chapter: filters.chapter || "General",
          topic: filters.topic || "Mixed",
          difficulty: (filters.difficulty as "easy" | "medium" | "hard") || "medium",
          type: (filters.type as "PYQ" | "Normal") || "Normal",
          count: Math.max(1, filters.numberOfQuestions),
          prompt: aiPrompt,
        },
        aiTools,
      );
      startTestWithQuestions(result.questions);
      setAiInfo(
        result.fallbackUsed
          ? `AD fallback used: ${result.providerUsed} (${result.modelUsed})`
          : `AI generated via ${result.providerUsed} (${result.modelUsed})`,
      );
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI drill generation failed.");
    } finally {
      setAiLoading(false);
    }
  }

  function onSaveOfflinePack() {
    if (!questions.length) {
      return;
    }
    const title = `${filters.subject || "Mixed"} | ${filters.chapter || "All Chapters"} | ${new Date().toLocaleDateString()}`;
    saveOfflineQuestionPack(title, questions);
    setOfflineStatus("Offline question pack saved in this device.");
  }

  async function onOptionSelect(option: string) {
    if (!currentQuestion || selectedOption || paused || isContentFrozen) {
      return;
    }

    setSelectedOption(option);
    const isCorrect = option === currentQuestion.correct_answer;
    const timeTakenSec = currentQuestionTime;
    const targetSecPerQuestion = (Math.max(1, filters.durationMinutes) * 60) / Math.max(1, questions.length);
    const attemptRatio = (currentIndex + 1) / Math.max(1, questions.length);
    const difficultyLevel = calculateQuestionDifficultyLevel({
      isCorrect,
      timeTakenSec,
      targetSecPerQuestion,
      attemptRatio,
    });

    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
    } else if (user) {
      await saveWrongQuestion(user.uid, currentQuestion);
    }

    setAnswerLog((prev) => [
      ...prev,
      {
        chapter: currentQuestion.chapter,
        topic: currentQuestion.topic,
        isCorrect,
        timeTakenSec,
        questionId: currentQuestion.id ?? `${currentQuestion.chapter}-${currentQuestion.topic}-${currentIndex}`,
      },
    ]);

    setDifficultyInsights((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id ?? `${currentQuestion.chapter}-${currentQuestion.topic}-${currentIndex}`,
        chapter: currentQuestion.chapter,
        topic: currentQuestion.topic,
        level: difficultyLevel,
        isCorrect,
        timeTakenSec,
      },
    ]);
  }

  async function onBookmark() {
    if (!user || !currentQuestion) {
      return;
    }

    await bookmarkQuestion(user.uid, currentQuestion);
  }

  function onNextQuestion() {
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setShowSolution(false);
  }

  function toggleReviewMark() {
    if (!currentQuestionKey) {
      return;
    }

    setMarkedForReview((prev) =>
      prev.includes(currentQuestionKey)
        ? prev.filter((id) => id !== currentQuestionKey)
        : [...prev, currentQuestionKey],
    );
  }

  function formatSeconds(totalSec: number) {
    const safe = Math.max(0, totalSec);
    const min = Math.floor(safe / 60)
      .toString()
      .padStart(2, "0");
    const sec = (safe % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel-3d p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 2</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Custom Test Generator</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Generate random question sets directly from live Firestore content.</p>
      </motion.div>

      <div className="panel-3d grid gap-3 p-4 sm:grid-cols-2">
        {isContentFrozen ? (
          <p className="sm:col-span-2 rounded-2xl border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
            Attempts are temporarily frozen by system mode.
          </p>
        ) : null}
        <input
          className="input-soft"
          placeholder="Subject (Physics)"
          value={filters.subject}
          onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Chapter"
          value={filters.chapter}
          onChange={(event) => setFilters((prev) => ({ ...prev, chapter: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Topic"
          value={filters.topic}
          onChange={(event) => setFilters((prev) => ({ ...prev, topic: event.target.value }))}
        />
        <select
          className="input-soft"
          value={filters.difficulty}
          onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value }))}
        >
          <option value="">All Difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select
          className="input-soft"
          value={filters.type}
          onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
        >
          <option value="">All Type</option>
          <option value="Normal">Normal</option>
          <option value="PYQ">PYQ</option>
        </select>
        <input
          className="input-soft"
          min={1}
          max={100}
          type="number"
          value={filters.numberOfQuestions}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              numberOfQuestions: Number(event.target.value || 10),
            }))
          }
        />
        <input
          className="input-soft"
          min={1}
          max={180}
          type="number"
          value={filters.durationMinutes}
          onChange={(event) =>
            setFilters((prev) => ({
              ...prev,
              durationMinutes: Number(event.target.value || 20),
            }))
          }
          placeholder="Duration (minutes)"
        />
        <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={filters.adaptiveMode}
            onChange={(event) => setFilters((prev) => ({ ...prev, adaptiveMode: event.target.checked }))}
          />
          Adaptive difficulty
        </label>
        <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Adaptive engine: last accuracy {recentAvgAccuracy}% to {adaptiveDifficulty.toUpperCase()} mode
        </p>
        <button
          className="btn-pill-primary sm:col-span-2 px-4 py-3 text-sm"
          type="button"
          onClick={onGenerateTest}
          disabled={loading || isContentFrozen}
        >
          {loading ? "Generating Test..." : "Generate Test"}
        </button>
      </div>

      {breakReminderShown && !testFinished ? (
        <div className="rounded-2xl border border-sky-300/70 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-200">
          Smart break reminder: long session detected. Take a short 3-5 minute break for better focus.
        </div>
      ) : null}

      {securityCounters.tabSwitches > 0 || securityCounters.copyAttempts > 0 ? (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
          Test security active. Tab switches: {securityCounters.tabSwitches} | Copy attempts: {securityCounters.copyAttempts}
        </div>
      ) : null}

      {testError ? <p className="text-sm text-red-600 dark:text-red-300">{testError}</p> : null}

      {aiTools?.enableStudentAi ? (
        <div className="panel-3d space-y-3 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Quick Drill</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">AI practice is available. Prompt a focused test and start instantly.</p>
          <textarea
            className="input-soft min-h-20"
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
            placeholder="Example: Generate conceptual rotational mechanics MCQs with tricky options"
          />
          <button
            className="btn-pill-primary px-4 py-2 text-xs"
            type="button"
            onClick={onGenerateAiTest}
            disabled={aiLoading || !aiPrompt.trim()}
          >
            {aiLoading ? "Generating AI Drill..." : "Start AI Drill"}
          </button>
          {aiError ? <p className="text-xs text-red-500">{aiError}</p> : null}
          {aiInfo ? <p className="text-xs text-emerald-600">{aiInfo}</p> : null}
        </div>
      ) : null}

      {questions.length === 0 && !loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No test loaded yet. Choose filters and generate test.</p>
      ) : null}

      {questions.length > 0 ? (
        <div className="panel-3d flex flex-wrap items-center gap-2 p-3">
          <button type="button" className="btn-pill-ghost px-4 py-2 text-xs" onClick={onSaveOfflinePack}>
            Save This Test Offline
          </button>
          {offlineStatus ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{offlineStatus}</p> : null}
        </div>
      ) : null}

      {testFinished ? (
        <div className="panel-3d p-5">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Test Complete</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Score: {score.score}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Accuracy: {score.accuracy}%</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Time Taken: {formatSeconds(testElapsedSeconds)}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Weak Chapters: {testInsights.weakChapters.join(", ") || "No weak chapter detected"}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Marked for Review: {markedForReview.length}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Difficulty Mix: {difficultyInsights.filter((item) => item.level === "Easy").length} Easy, {" "}
            {difficultyInsights.filter((item) => item.level === "Medium").length} Medium, {" "}
            {difficultyInsights.filter((item) => item.level === "Hard").length} Hard, {" "}
            {difficultyInsights.filter((item) => item.level === "Very Hard").length} Very Hard
          </p>
          {mistakeAnalysis ? (
            <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              <p>
                Mistake Analysis: Concept {mistakeAnalysis.conceptErrors}, Calculation {mistakeAnalysis.calculationErrors}, Silly {mistakeAnalysis.sillyMistakes}
              </p>
              <p className="mt-1">Top fix: {mistakeAnalysis.suggestions[0] ?? "Maintain timed revision."}</p>
            </div>
          ) : null}
          <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {(() => {
              const finalSecurity = evaluateTestSecurity({
                counters: securityCounters,
                totalQuestions: questions.length,
                elapsedSec: testElapsedSeconds,
              });
              return (
                <>
                  <p className="font-semibold">Test Security Check</p>
                  <p className="mt-1">
                    Score: {finalSecurity.suspiciousScore} | Tab switches: {finalSecurity.tabSwitches} | Copy attempts: {finalSecurity.copyAttempts}
                  </p>
                  <p className="mt-1">Status: {finalSecurity.suspicious ? "Flagged for review" : "Normal pattern"}</p>
                </>
              );
            })()}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">This attempt has been saved to your test history.</p>
          <button
            className="btn-pill-primary mt-4 px-4 py-2 text-sm"
            type="button"
            onClick={() => {
              setQuestions([]);
              setAttemptSaved(false);
              setAnswerLog([]);
              setTestStartedAt(null);
              setPaused(false);
              setRemainingSeconds(defaultFilters.durationMinutes * 60);
              setTestElapsedSeconds(0);
              setQuestionTimeSpent({});
              setMarkedForReview([]);
              setDifficultyInsights([]);
              setMistakeAnalysis(null);
            }}
          >
            Generate Another
          </button>
        </div>
      ) : null}

      {currentQuestion && !testFinished ? (
        <motion.article
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-3d space-y-4 p-5"
        >
          <div>
            <div className="h-2 w-full rounded-full bg-zinc-100">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <p>
                Question {currentIndex + 1} of {questions.length}
              </p>
               <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">Total {formatSeconds(testElapsedSeconds)}</span>
               <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">Left {formatSeconds(remainingSeconds)}</span>
               <span className="rounded-full border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900">This Q {formatSeconds(currentQuestionTime)}</span>
              {paused ? <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">Paused</span> : null}
            </div>
          </div>

          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">{currentQuestion.question}</p>
          <QuestionSupport
            svgMarkup={currentQuestion.diagram_svg}
            imageUrl={currentQuestion.question_image}
            conceptExplanation={currentQuestion.concept_explanation}
            ncertReference={currentQuestion.ncert_reference}
            formulaHint={currentQuestion.formula_hint}
          />

          <div className="space-y-2">
            {currentQuestion.options.map((option) => {
              const isCorrect = option === currentQuestion.correct_answer;
              const isSelected = option === selectedOption;
              const answeredWrong = Boolean(selectedOption && isSelected && !isCorrect);

              return (
                <button
                  key={option}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                    isCorrect && selectedOption
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : answeredWrong
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                  onClick={() => onOptionSelect(option)}
                  type="button"
                >
                  {option}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-pill-ghost bg-zinc-900 px-4 py-2 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
              onClick={() => setShowSolution((prev) => !prev)}
              type="button"
            >
              {showSolution ? "Hide Solution" : "Show Solution"}
            </button>
            <button
              className="btn-pill-ghost px-4 py-2 text-xs"
              onClick={onBookmark}
              type="button"
            >
              Bookmark
            </button>
            <button
              className="btn-pill-ghost px-4 py-2 text-xs"
              onClick={toggleReviewMark}
              type="button"
            >
              {markedForReview.includes(currentQuestionKey) ? "Unmark Review" : "Mark for Review"}
            </button>
            <button
              className="btn-pill-ghost px-4 py-2 text-xs"
              onClick={() => setPaused((prev) => !prev)}
              type="button"
            >
              {paused ? "Resume Test" : "Pause Test"}
            </button>
            <button
              className="btn-pill-primary px-4 py-2 text-xs"
              onClick={onNextQuestion}
              type="button"
              disabled={paused}
            >
              Next Question
            </button>
          </div>

          {showSolution ? (
            <p className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{currentQuestion.solution}</p>
          ) : null}

          {discussionEnabled ? <QuestionDiscussion threadId={getQuestionThreadId(currentQuestion)} /> : null}
        </motion.article>
      ) : null}
    </section>
  );
}
