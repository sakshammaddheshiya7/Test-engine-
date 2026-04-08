import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  deleteOfflinePdfPack,
  deleteOfflineQuestionPack,
  getOfflinePdfPacks,
  getOfflineQuestionPacks,
} from "../services/offlineService";

export default function OfflineCenter() {
  const [refreshKey, setRefreshKey] = useState(0);
  const questionPacks = useMemo(() => getOfflineQuestionPacks(), [refreshKey]);
  const pdfPacks = useMemo(() => getOfflinePdfPacks(), [refreshKey]);

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel-3d p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 35 Offline Mode</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Offline Download Center</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Saved chapter tests and PDF resources for no-network study sessions.</p>
      </motion.div>

      <div className="panel-3d p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Question Packs</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{questionPacks.length} saved</span>
        </div>
        <div className="mt-3 space-y-2">
          {questionPacks.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No test packs saved yet.</p> : null}
          {questionPacks.map((pack) => (
            <div key={pack.id} className="rounded-2xl border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{pack.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{pack.questions.length} questions</p>
              <button
                type="button"
                className="btn-pill-ghost mt-2 px-3 py-1.5 text-[11px]"
                onClick={() => {
                  deleteOfflineQuestionPack(pack.id);
                  setRefreshKey((prev) => prev + 1);
                }}
              >
                Remove
              </button>
              <Link className="btn-pill-primary mt-2 ml-2 inline-block px-3 py-1.5 text-[11px]" to={`/custom-test?offlinePack=${pack.id}`}>
                Start Offline
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="panel-3d p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">PDF Resources</h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{pdfPacks.length} saved</span>
        </div>
        <div className="mt-3 space-y-2">
          {pdfPacks.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No PDFs saved for offline yet.</p> : null}
          {pdfPacks.map((pack) => (
            <div key={pack.id} className="rounded-2xl border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{pack.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {pack.subject} / {pack.chapter}
              </p>
              <div className="mt-2 flex gap-2">
                <a className="btn-pill-primary px-3 py-1.5 text-[11px]" href={pack.fileUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
                <button
                  type="button"
                  className="btn-pill-ghost px-3 py-1.5 text-[11px]"
                  onClick={() => {
                    deleteOfflinePdfPack(pack.id);
                    setRefreshKey((prev) => prev + 1);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
