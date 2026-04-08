import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  ClipboardCheck,
  Clock3,
  Layers,
  Sparkles,
  Target,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { listenToUserTestHistory, type TestAttemptDoc } from "../services/questionService";

const quickActions = [
  { title: "Practice Questions", desc: "Chapter and topic drills", to: "/practice", icon: Layers },
  { title: "Start Custom Test", desc: "Adaptive timed tests", to: "/tests", icon: ClipboardCheck },
  { title: "Open Revision Zone", desc: "Mistakes, saves, flashcards", to: "/revision", icon: BookOpen },
  { title: "Deepu AI Assistance", desc: "Doubt solver and planner", to: "/ai-assist", icon: Brain },
];

const dayPlan = [
  { time: "09:00", item: "Biology Practice", mode: "Practice Hub" },
  { time: "11:30", item: "Physics PYQ", mode: "Test Center" },
  { time: "16:00", item: "Organic Revision", mode: "Revision Zone" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const [history, setHistory] = useState<TestAttemptDoc[]>([]);
  const firstName = user?.email?.split("@")[0] ?? "Student";

  useEffect(() => {
    if (!user) return;
    return listenToUserTestHistory(user.uid, setHistory, 50);
  }, [user]);

  const completion = useMemo(() => {
    if (!history.length) return 24;
    const avg = history.reduce((sum, item) => sum + item.accuracy, 0) / history.length;
    return Math.max(12, Math.min(92, Math.round(avg)));
  }, [history]);

  const progressRows = useMemo(
    () => [
      { label: "Physics", value: Math.min(96, completion + 8) },
      { label: "Chemistry", value: Math.min(96, completion + 2) },
      { label: "Biology / Math", value: Math.max(18, completion - 4) },
    ],
    [completion],
  );

  return (
    <section className="space-y-4 py-2">
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel rounded-[26px] p-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Hero Performance Panel</p>
            <h2 className="mt-1 text-xl font-semibold">Welcome back, {firstName}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Tasks remaining 3, current pace 24 topics/week</p>
          </div>
          <Sparkles size={18} className="text-orange-500" />
        </div>
        <div className="mt-4 grid grid-cols-[124px_1fr] gap-4">
          <div className="relative grid h-[124px] place-items-center">
            <div className="absolute inset-0 rounded-full bg-orange-400/20 blur-xl" />
            <div className="relative grid h-[110px] w-[110px] place-items-center rounded-full border-[10px] border-zinc-200/80 dark:border-zinc-700">
              <div
                className="absolute inset-0 rounded-full border-[10px] border-transparent border-t-orange-500"
                style={{ transform: `rotate(${Math.round((completion / 100) * 360)}deg)` }}
              />
              <p className="text-lg font-semibold">{completion}%</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
              <Target size={13} className="mr-1 inline text-orange-500" />
              Completion percentage synced with recent tests
            </p>
            <p className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
              <Clock3 size={13} className="mr-1 inline text-orange-500" />
              Current pace optimized for NEET/JEE preparation
            </p>
          </div>
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        className="glass-panel rounded-[26px] p-4"
      >
        <h3 className="text-sm font-semibold">
          <Layers size={15} className="mr-1 inline text-orange-500" />
          Quick Actions Grid
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {quickActions.map((action, index) => (
            <motion.div key={action.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + index * 0.03 }}>
              <Link
                to={action.to}
                className="block rounded-2xl border border-zinc-200/80 bg-white/85 p-3 shadow-sm transition hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-800/60"
              >
                <action.icon size={16} className="text-orange-500" />
                <p className="mt-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">{action.title}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{action.desc}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="glass-panel rounded-[26px] p-4"
      >
        <h3 className="text-sm font-semibold">
          <Clock3 size={15} className="mr-1 inline text-orange-500" />
          Today&apos;s Study Plan
        </h3>
        <div className="mt-3 space-y-2">
          {dayPlan.map((entry, index) => (
            <motion.div
              key={entry.time}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.04 }}
              className="grid grid-cols-[56px_1fr_auto] items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/60"
            >
              <p className="text-xs font-semibold text-zinc-500">{entry.time}</p>
              <div>
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{entry.item}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{entry.mode}</p>
              </div>
              <ArrowRight size={14} className="text-zinc-400" />
            </motion.div>
          ))}
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="glass-panel rounded-[26px] p-4"
      >
        <h3 className="text-sm font-semibold">
          <Activity size={15} className="mr-1 inline text-orange-500" />
          Progress Overview
        </h3>
        <div className="mt-3 space-y-3">
          {progressRows.map((row, index) => (
            <div key={row.label}>
              <div className="mb-1 flex justify-between text-xs">
                <p>{row.label}</p>
                <p className="text-zinc-500">{row.value}%</p>
              </div>
              <motion.div className="h-2 rounded-full bg-zinc-200/80 dark:bg-zinc-700">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${row.value}%` }}
                  transition={{ delay: 0.14 + index * 0.05, duration: 0.45 }}
                  className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                />
              </motion.div>
            </div>
          ))}
        </div>
      </motion.article>

      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass-panel rounded-[26px] p-4"
      >
        <h3 className="text-sm font-semibold">
          <BookOpen size={15} className="mr-1 inline text-orange-500" />
          Recent Activity
        </h3>
        <div className="mt-3 space-y-2">
          <p className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
            Last test score: {history[0]?.correctAnswers ?? 0}/{history[0]?.totalQuestions ?? 0}
          </p>
          <p className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
            Last practiced chapter: {history[0]?.weakChapters?.[0] ?? "Not enough attempts yet"}
          </p>
          <p className="rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
            Recent corrections: {(history[0]?.totalQuestions ?? 0) - (history[0]?.correctAnswers ?? 0)} mistakes reviewed
          </p>
        </div>
      </motion.article>
    </section>
  );
}
