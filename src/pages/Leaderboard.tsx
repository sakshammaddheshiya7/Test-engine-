import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { listenToLeaderboard, type LeaderboardDoc } from "../services/questionService";

type RankMode = "daily" | "weekly" | "allTime";

const rankModes: Array<{ key: RankMode; label: string }> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "allTime", label: "All-Time" },
];

const subjectOptions = ["All Subjects", "physics", "chemistry", "biology", "mathematics"];

function computeLevel(allTimeXP: number) {
  const level = Math.max(1, Math.floor(allTimeXP / 250) + 1);
  const currentLevelBase = (level - 1) * 250;
  const nextLevelBase = level * 250;
  const progress = Math.round(((allTimeXP - currentLevelBase) / Math.max(1, nextLevelBase - currentLevelBase)) * 100);
  return { level, progress, xpToNext: Math.max(0, nextLevelBase - allTimeXP) };
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardDoc[]>([]);
  const [mode, setMode] = useState<RankMode>("daily");
  const [subjectFilter, setSubjectFilter] = useState(subjectOptions[0]);

  useEffect(() => {
    return listenToLeaderboard(setRows);
  }, []);

  const rankedRows = useMemo(() => {
    const ranked = [...rows]
      .map((row) => {
        const subjectXP = subjectFilter === "All Subjects" ? null : Number(row.subjectXP?.[subjectFilter] ?? 0);
        const score =
          mode === "daily"
            ? row.dayXP
            : mode === "weekly"
              ? row.weekXP
              : subjectXP !== null
                ? subjectXP
                : row.allTimeXP;
        return { ...row, score };
      })
      .sort((a, b) => b.score - a.score || b.allTimeXP - a.allTimeXP);

    return ranked.map((row, index) => ({ ...row, rank: index + 1 })).filter((row) => row.score > 0);
  }, [mode, rows, subjectFilter]);

  const myRank = rankedRows.find((item) => item.id === user?.uid);
  const myLevel = computeLevel(myRank?.allTimeXP ?? 0);

  return (
    <section className="space-y-4 py-3">
      <motion.div className="panel-3d p-5" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Competitive Rank</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Leaderboard</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Track daily, weekly and all-time rank with XP and level progression.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {rankModes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={mode === item.key ? "btn-pill-primary" : "btn-pill-ghost"}
            >
              {item.label}
            </button>
          ))}
        </div>

        <select
          className="input-soft mt-3"
          value={subjectFilter}
          onChange={(event) => setSubjectFilter(event.target.value)}
        >
          {subjectOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </motion.div>

      <div className="panel-3d p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">Your Progress</p>
          <p className="text-zinc-500 dark:text-zinc-400">Level {myLevel.level}</p>
        </div>
        <div className="h-2 rounded-full bg-zinc-200/80 dark:bg-zinc-700/80">
          <div className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${myLevel.progress}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Rank: {myRank?.rank ?? "-"}</span>
          <span>{myLevel.xpToNext} XP to next level</span>
        </div>
      </div>

      <div className="panel-3d p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top Students</h3>
        <div className="mt-3 space-y-2">
          {rankedRows.slice(0, 25).map((row) => (
            <div
              key={row.id}
              className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm ${
                row.id === user?.uid
                  ? "border-orange-300 bg-orange-50/70 dark:border-orange-500/40 dark:bg-orange-500/10"
                  : "border-zinc-200/80 bg-white/80 dark:border-zinc-700 dark:bg-zinc-900/60"
              }`}
            >
              <div>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">#{row.rank} {row.displayName || row.email?.split("@")[0] || "Student"}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Streak: {row.streak || 0} days</p>
              </div>
              <p className="font-semibold text-orange-500">{row.score} XP</p>
            </div>
          ))}
          {!rankedRows.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No ranking data yet. Complete a test to earn XP.</p> : null}
        </div>
      </div>
    </section>
  );
}
