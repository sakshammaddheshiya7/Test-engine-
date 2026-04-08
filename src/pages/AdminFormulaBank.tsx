import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import { deleteFormula, listenToFormulas, upsertFormula, type FormulaDoc } from "../services/formulaService";

export default function AdminFormulaBank() {
  const [rows, setRows] = useState<FormulaDoc[]>([]);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [concept, setConcept] = useState("");
  const [formula, setFormula] = useState("");
  const [trick, setTrick] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsub = listenToFormulas(setRows);
    return () => unsub();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !chapter.trim() || !concept.trim() || !formula.trim()) {
      setStatus("Please fill subject, chapter, concept, and formula.");
      return;
    }

    setLoading(true);
    setStatus("");
    try {
      await upsertFormula({
        subject,
        chapter,
        concept,
        formula,
        trick,
      });

      await addAdminAuditLog("FORMULA_UPSERT", `${subject} / ${chapter} / ${concept}`);

      setSubject("");
      setChapter("");
      setConcept("");
      setFormula("");
      setTrick("");
      setStatus("Formula saved successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save formula.");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(row: FormulaDoc) {
    if (!confirm(`Delete formula for ${row.concept}?`)) {
      return;
    }

    try {
      await deleteFormula(row.id);
      await addAdminAuditLog("FORMULA_DELETE", `${row.subject} / ${row.chapter} / ${row.concept}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <h2 className="text-2xl font-semibold">Formula Bank Manager</h2>
        <p className="mt-2 text-sm text-zinc-300">Create and maintain formula library for chapter-wise quick revision.</p>
      </motion.div>

      <form onSubmit={onSubmit} className="admin-surface space-y-3 p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input value={subject} onChange={(event) => setSubject(event.target.value)} className="input-soft" placeholder="Subject" />
          <input value={chapter} onChange={(event) => setChapter(event.target.value)} className="input-soft" placeholder="Chapter" />
          <input value={concept} onChange={(event) => setConcept(event.target.value)} className="input-soft" placeholder="Concept" />
          <input value={trick} onChange={(event) => setTrick(event.target.value)} className="input-soft" placeholder="Trick or memory shortcut" />
        </div>
        <textarea value={formula} onChange={(event) => setFormula(event.target.value)} className="input-soft min-h-20" placeholder="Formula" />
        <button type="submit" disabled={loading} className="btn-pill-primary">
          {loading ? "Saving..." : "Save Formula"}
        </button>
        {status ? <p className="text-sm text-zinc-500 dark:text-zinc-300">{status}</p> : null}
      </form>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Latest Formula Entries</h3>
        <div className="mt-3 space-y-2">
          {rows.slice(0, 120).map((row) => (
            <div key={row.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/70">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-300">
                    {row.subject} / {row.chapter}
                  </p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.concept}</p>
                </div>
                <button type="button" className="btn-pill-ghost" onClick={() => onDelete(row)}>
                  Delete
                </button>
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">{row.formula}</p>
              {row.trick ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">Trick: {row.trick}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}