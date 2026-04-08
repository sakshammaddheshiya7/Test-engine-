import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  listenToPdfVersions,
  uploadPdfResource,
  type ContentVersionItem,
  type PdfCategory,
} from "../services/pdfService";
import { defaultModelByProvider, generateQuestionsWithAi, type AiProvider } from "../services/aiService";
import { uploadBulkQuestions } from "../services/questionService";
import { publishNotification } from "../services/notificationService";
import { touchGlobalSync } from "../services/syncService";

const categories: { label: string; value: PdfCategory }[] = [
  { label: "Short Notes", value: "short_notes" },
  { label: "Formula Sheet", value: "formula_sheet" },
  { label: "PYQ Collection", value: "pyq_collection" },
];

export default function AdminUploadPDF() {
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PdfCategory>("short_notes");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [versions, setVersions] = useState<ContentVersionItem[]>([]);
  const [pdfText, setPdfText] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("openrouter");
  const [aiModel, setAiModel] = useState(defaultModelByProvider.openrouter);
  const [aiCount, setAiCount] = useState(12);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const unsub = listenToPdfVersions(setVersions);
    return () => unsub();
  }, []);

  async function onUpload() {
    if (!subject.trim() || !chapter.trim() || !title.trim() || !file) {
      setMessage("Please fill all fields and choose a PDF file.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const result = await uploadPdfResource({
        subject,
        chapter,
        title,
        category,
        file,
      });
      await publishNotification({
        title: `New PDF: ${title.trim()}`,
        body: `${subject.trim()} / ${chapter.trim()} resource is now available in Library.`,
        kind: "pdf_upload",
        audience: "all",
        ctaRoute: "/pdf-library",
      });
      await touchGlobalSync("pdf_upload");
      setMessage(`PDF uploaded successfully as version v${result.version}. It is now live in student library.`);
      setSubject("");
      setChapter("");
      setTitle("");
      setCategory("short_notes");
      setFile(null);
    } catch {
      setMessage("PDF upload failed. Check file and Firebase permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateFromPdfText() {
    if (!subject.trim() || !chapter.trim() || !pdfText.trim()) {
      setMessage("Enter subject, chapter and PDF text first.");
      return;
    }

    setAiLoading(true);
    setMessage("");
    try {
      const generated = await generateQuestionsWithAi({
        provider: aiProvider,
        model: aiModel,
        subject: subject.trim(),
        chapter: chapter.trim(),
        topic: title.trim() || "PDF Derived",
        difficulty: "medium",
        type: category === "pyq_collection" ? "PYQ" : "Normal",
        count: Math.max(5, aiCount),
        prompt: `Generate from this PDF content and keep exam-ready concise quality:\n${pdfText.slice(0, 9000)}`,
      });
      await uploadBulkQuestions(generated);
      await touchGlobalSync("pdf_ai_question_generation");
      setMessage(`${generated.length} AI-generated questions saved to question bank.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI PDF generation failed.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 3 Admin Module</p>
        <h2 className="mt-1 text-2xl font-semibold">PDF Upload Manager</h2>
        <p className="mt-1 text-sm text-zinc-300">Upload chapter-wise study material to Firebase Storage with automatic live sync.</p>
      </motion.div>

      <div className="admin-surface space-y-3 p-4">
        <input
          className="input-soft"
          placeholder="Subject (Physics)"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
        <input
          className="input-soft"
          placeholder="Chapter (Rotational Motion)"
          value={chapter}
          onChange={(event) => setChapter(event.target.value)}
        />
        <input
          className="input-soft"
          placeholder="Title (Quick Revision Notes)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <select
          className="input-soft"
          value={category}
          onChange={(event) => setCategory(event.target.value as PdfCategory)}
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          className="input-soft bg-white file:mr-3 file:rounded-full file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:bg-zinc-900"
          accept="application/pdf"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />

        <button
          className="btn-pill-primary w-full px-4 py-3 text-sm"
          type="button"
          onClick={onUpload}
          disabled={saving}
        >
          {saving ? "Uploading PDF..." : "Upload PDF"}
        </button>

        {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI PDF to Question Generator</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Paste extracted PDF text and auto-generate MCQs into Firebase question bank.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <select
            className="input-soft"
            value={aiProvider}
            onChange={(event) => {
              const next = event.target.value as AiProvider;
              setAiProvider(next);
              setAiModel(defaultModelByProvider[next]);
            }}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="sarvam">Sarvam</option>
            <option value="emergent">Emergent</option>
          </select>
          <input className="input-soft" value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="AI model" />
          <input className="input-soft" type="number" min={5} max={60} value={aiCount} onChange={(event) => setAiCount(Number(event.target.value))} />
        </div>
        <textarea
          className="input-soft mt-2 min-h-28 font-mono text-xs"
          placeholder="Paste PDF text here for AI conversion"
          value={pdfText}
          onChange={(event) => setPdfText(event.target.value)}
        />
        <button className="btn-pill-dark mt-2 w-full px-4 py-2 text-sm" type="button" onClick={onGenerateFromPdfText} disabled={aiLoading}>
          {aiLoading ? "Generating..." : "Generate Questions from PDF Text"}
        </button>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">PDF Content Versions</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Latest upload metadata to preserve continuity across app updates.</p>

        {versions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No versioned PDF uploads yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {versions.slice(0, 10).map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.subject} / {item.chapter} / {item.category}
                </p>
                <p className="mt-1 text-xs font-medium text-orange-700">
                  Latest version: v{item.latestVersion} | Uploads: {item.uploadsCount ?? item.latestVersion}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}