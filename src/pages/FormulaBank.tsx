import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { listenToFormulas, type FormulaDoc } from "../services/formulaService";

export default function FormulaBank() {
  const [formulas, setFormulas] = useState<FormulaDoc[]>([]);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    const unsub = listenToFormulas(setFormulas);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return formulas.filter((row) => {
      if (subject.trim() && row.subject !== subject.trim()) {
        return false;
      }

      if (chapter.trim() && row.chapter !== chapter.trim()) {
        return false;
      }

      if (!queryText.trim()) {
        return true;
      }

      const bag = `${row.subject} ${row.chapter} ${row.concept} ${row.formula} ${row.trick ?? ""}`.toLowerCase();
      return bag.includes(queryText.trim().toLowerCase());
    });
  }, [chapter, formulas, queryText, subject]);

  const subjects = [...new Set(formulas.map((item) => item.subject).filter(Boolean))];
  const chapters = [...new Set(formulas.filter((item) => !subject || item.subject === subject).map((item) => item.chapter).filter(Boolean))];

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[26px] p-5">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Smart Formula Bank</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Fast concept recall with chapter filters and revision tricks.</p>
      </motion.div>

      <div className="glass-panel rounded-[24px] p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            className="input-soft"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              setChapter("");
            }}
          >
            <option value="">All subjects</option>
            {subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="input-soft" value={chapter} onChange={(event) => setChapter(event.target.value)}>
            <option value="">All chapters</option>
            {chapters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            className="input-soft"
            placeholder="Search concept/formula"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-4 text-sm text-zinc-500 dark:text-zinc-300">No formula found for selected filters.</div>
        ) : (
          filtered.map((row) => (
            <article key={row.id} className="glass-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-300">
                <span className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">{row.subject}</span>
                <span className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">{row.chapter}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.concept}</p>
              <p className="mt-2 rounded-xl border border-orange-200/70 bg-orange-50/70 px-3 py-2 text-sm text-zinc-800 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-zinc-100">
                {row.formula}
              </p>
              {row.trick ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">Trick: {row.trick}</p> : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}