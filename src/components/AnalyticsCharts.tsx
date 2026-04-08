import { motion } from "framer-motion";
import type { TopicInsight } from "../services/analyticsService";

type TrendPoint = {
  label: string;
  accuracy: number;
};

type AnalyticsChartsProps = {
  trend: TrendPoint[];
  topics: TopicInsight[];
  titlePrefix?: string;
};

function getHeatColor(accuracy: number) {
  if (accuracy >= 80) {
    return "from-emerald-200 to-emerald-400 text-emerald-900";
  }

  if (accuracy >= 60) {
    return "from-amber-200 to-amber-400 text-amber-900";
  }

  return "from-rose-200 to-rose-400 text-rose-900";
}

export function AnalyticsCharts({ trend, topics, titlePrefix = "" }: AnalyticsChartsProps) {
  const trendTitle = `${titlePrefix}Accuracy Trend`.trim();
  const heatTitle = `${titlePrefix}Topic Weakness Heatmap`.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-[0_14px_28px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{trendTitle}</h3>
        {trend.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No trend yet. Complete more tests to see progress.</p>
        ) : (
          <div className="mt-3 flex items-end gap-2">
            {trend.map((row) => (
              <div key={row.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="relative h-24 w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  <motion.div
                    className="absolute inset-x-0 bottom-0 rounded-lg bg-gradient-to-t from-orange-500 to-amber-300"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(8, row.accuracy)}%` }}
                    transition={{ duration: 0.45 }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500">{row.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-[0_14px_28px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-zinc-700/70 dark:bg-zinc-900/70">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{heatTitle}</h3>
        {topics.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No topic performance data yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {topics.slice(0, 9).map((topic) => (
              <motion.article
                key={topic.topic}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl bg-gradient-to-br p-3 ${getHeatColor(topic.accuracy)}`}
              >
                <p className="line-clamp-2 text-xs font-semibold">{topic.topic}</p>
                <p className="mt-1 text-xs">{topic.accuracy}% accuracy</p>
                <p className="text-[11px] opacity-80">{topic.attempted} attempts</p>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}