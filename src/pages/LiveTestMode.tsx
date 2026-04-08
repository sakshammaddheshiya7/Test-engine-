import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import {
  joinLiveTest,
  listenToLiveLeaderboard,
  listenToLiveParticipantCount,
  listenToLiveTests,
  loadQuestionsForLiveTest,
  submitLiveTestAttempt,
  type LiveTestAttempt,
  type LiveTestDoc,
} from "../services/liveTestService";

function formatSec(value: number) {
  const m = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function statusLabel(item: LiveTestDoc) {
  const now = Date.now();
  const start = (item.startAt?.seconds ?? 0) * 1000;
  const end = (item.endAt?.seconds ?? 0) * 1000;
  if (now < start) return "Upcoming";
  if (now > end) return "Completed";
  return "Live";
}

export default function LiveTestMode() {
  const { user } = useAuth();
  const [tests, setTests] = useState<LiveTestDoc[]>([]);
  const [selected, setSelected] = useState<LiveTestDoc | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LiveTestAttempt[]>([]);
  const [questions, setQuestions] = useState<
    Array<{ id?: string; question: string; options: string[]; correct_answer: string }>
  >([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [joined, setJoined] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadingTest, setLoadingTest] = useState(false);

  useEffect(() => {
    const unsub = listenToLiveTests(setTests);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!selected) {
      return;
    }

    const unsubCount = listenToLiveParticipantCount(selected.id, setParticipantCount);
    const unsubBoard = listenToLiveLeaderboard(selected.id, setLeaderboard);
    return () => {
      unsubCount();
      unsubBoard();
    };
  }, [selected]);

  useEffect(() => {
    if (!joined || submitted || !secondsLeft) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [joined, submitted, secondsLeft]);

  const activeQuestion = questions[index];
  const finished = joined && (submitted || index >= questions.length || secondsLeft <= 0);
  const sortedTests = useMemo(() => tests.slice().sort((a, b) => (b.startAt?.seconds ?? 0) - (a.startAt?.seconds ?? 0)), [tests]);

  async function onJoinAndStart(item: LiveTestDoc) {
    if (!user) {
      return;
    }

    setLoadingTest(true);
    try {
      await joinLiveTest(item.id, {
        userId: user.uid,
        userEmail: user.email ?? "",
        userName: user.displayName ?? "Student",
      });
      const rows = await loadQuestionsForLiveTest(item);
      setSelected(item);
      setQuestions(rows);
      setIndex(0);
      setCorrect(0);
      setSelectedOption(null);
      setSecondsLeft(Math.max(1, item.durationMinutes) * 60);
      setSubmitted(false);
      setJoined(true);
    } finally {
      setLoadingTest(false);
    }
  }

  function onSelect(option: string) {
    if (!activeQuestion || selectedOption) {
      return;
    }
    setSelectedOption(option);
    if (option === activeQuestion.correct_answer) {
      setCorrect((prev) => prev + 1);
    }
  }

  async function onNext() {
    if (!selected) {
      return;
    }

    if (index + 1 >= questions.length) {
      const accuracy = questions.length ? Math.round((correct / questions.length) * 100) : 0;
      if (!submitted && user) {
        await submitLiveTestAttempt(selected.id, {
          userId: user.uid,
          userName: user.displayName ?? "Student",
          score: correct,
          accuracy,
          timeTakenSec: Math.max(0, selected.durationMinutes * 60 - secondsLeft),
        });
      }
      setSubmitted(true);
      setIndex(questions.length);
      return;
    }

    setIndex((prev) => prev + 1);
    setSelectedOption(null);
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel-3d p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Part 34</p>
        <h2 className="mt-1 text-2xl font-semibold">Live Test Mode</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Scheduled exam mode with auto-submit, participant count and live leaderboard.</p>
      </motion.div>

      {joined && selected ? (
        <div className="panel-3d space-y-3 p-4">
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <p>{selected.title}</p>
            <p>{formatSec(secondsLeft)}</p>
          </div>

          {finished ? (
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Test completed</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Score: {correct}/{questions.length}</p>
            </div>
          ) : activeQuestion ? (
            <>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Q{index + 1}. {activeQuestion.question}</p>
              <div className="space-y-2">
                {activeQuestion.options.map((option) => (
                  <button
                    key={option}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${selectedOption === option ? "border-orange-300 bg-orange-50 dark:bg-orange-500/10" : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}
                    type="button"
                    onClick={() => onSelect(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button className="btn-pill-primary px-4 py-2 text-xs" type="button" onClick={() => void onNext()} disabled={!selectedOption}>
                {index + 1 >= questions.length ? "Submit Test" : "Next"}
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="panel-3d p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Scheduled Exams</h3>
          <div className="mt-3 space-y-2">
            {sortedTests.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No live tests scheduled.</p> : null}
            {sortedTests.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.title}</p>
                  <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] dark:bg-zinc-800">{statusLabel(item)}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.subject} | {item.numberOfQuestions}Q | {item.durationMinutes}m</p>
                <button
                  className="btn-pill-primary mt-2 px-4 py-2 text-xs"
                  type="button"
                  onClick={() => void onJoinAndStart(item)}
                  disabled={statusLabel(item) !== "Live" || loadingTest}
                >
                  {loadingTest ? "Loading..." : "Join Live Test"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selected ? (
        <div className="panel-3d p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live Leaderboard</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Participants: {participantCount}</p>
          </div>
          <div className="mt-2 space-y-2">
            {leaderboard.slice(0, 6).map((row, i) => (
              <div key={row.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="font-semibold text-zinc-700 dark:text-zinc-200">#{i + 1} {row.userName}</p>
                <p className="text-zinc-500 dark:text-zinc-400">{row.accuracy}%</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}