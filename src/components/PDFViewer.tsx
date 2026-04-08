import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { PdfLibraryItem } from "../services/pdfService";

type PDFViewerProps = {
  item: PdfLibraryItem;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function PDFViewer({ item, index, total, onClose, onPrev, onNext }: PDFViewerProps) {
  const storageKey = useMemo(() => `pdf_notes_${item.id}`, [item.id]);
  const [notes, setNotes] = useState("");
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    setNotes(saved ?? "");
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, notes);
  }, [notes, storageKey]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const seconds = String(timerSeconds % 60).padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-zinc-950/60 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="mx-auto grid h-full w-full max-w-6xl gap-3 rounded-3xl border border-white/20 bg-white/90 p-3 shadow-2xl backdrop-blur-xl dark:bg-zinc-900/90 sm:grid-cols-[1fr_320px]">
        <div className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-700">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Study Mode</p>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {item.subject} / {item.chapter} / v{item.version ?? 1}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Close
            </button>
          </div>

          <iframe title={item.title} src={item.fileUrl} className="mt-3 h-full min-h-[420px] w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700" />

          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={index <= 0}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              Previous
            </button>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {index + 1} / {total}
            </p>
            <button
              type="button"
              onClick={onNext}
              disabled={index >= total - 1}
              className="rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col rounded-2xl border border-zinc-200 bg-white/85 p-3 dark:border-zinc-700 dark:bg-zinc-900/80">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Focus Timer</h4>
          <p className="mt-1 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
            {minutes}:{seconds}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setRunning((prev) => !prev)}
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-orange-500"
            >
              {running ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRunning(false);
                setTimerSeconds(25 * 60);
              }}
              className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
            >
              Reset
            </button>
          </div>

          <h4 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick Notes</h4>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 h-full min-h-44 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none ring-orange-200 transition focus:ring dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Write formulas, traps, and key ideas while studying this PDF."
          />
        </div>
      </div>
    </motion.div>
  );
}