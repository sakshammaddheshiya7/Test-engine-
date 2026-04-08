import { useState } from "react";
import { motion } from "framer-motion";
import {
  queueBulkQuestions,
  queueSingleQuestion,
  uploadBulkQuestions,
  uploadQuestionImage,
  uploadSingleQuestion,
  validateQuestionsAgainstDatabase,
  validateQuestionsPayload,
  type QuestionDoc,
  type ValidationResult,
} from "../services/questionService";
import { claimRateLimit } from "../services/securityService";
import { touchGlobalSync } from "../services/syncService";

const initialQuestion: QuestionDoc = {
  id: "",
  subject: "",
  chapter: "",
  topic: "",
  difficulty: "easy",
  type: "Normal",
  question: "",
  options: ["", "", "", ""],
  correct_answer: "",
  solution: "",
  pdf_link: "",
  diagram_svg: "",
  question_image: "",
  concept_explanation: "",
  ncert_reference: "",
  formula_hint: "",
};

function parseBulkPayload(rawPayload: string) {
  const trimmed = rawPayload.trim();
  if (!trimmed) {
    throw new Error("Empty payload");
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (Array.isArray(parsed)) {
    return parsed as QuestionDoc[];
  }

  if (typeof parsed === "object" && parsed && Array.isArray((parsed as { questions?: unknown }).questions)) {
    return (parsed as { questions: QuestionDoc[] }).questions;
  }

  throw new Error("Invalid JSON");
}

export default function AdminUploadQuestions() {
  const [question, setQuestion] = useState<QuestionDoc>(initialQuestion);
  const [jsonPayload, setJsonPayload] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [dbValidationMessage, setDbValidationMessage] = useState("");
  const [queueMode, setQueueMode] = useState(false);

  async function onUploadQuestionImage(file: File) {
    setImageUploading(true);
    setMessage("");
    try {
      const imageUrl = await uploadQuestionImage(file);
      setQuestion((prev) => ({ ...prev, question_image: imageUrl }));
      setMessage("Question image uploaded.");
    } catch {
      setMessage("Image upload failed. Check storage rules and file type.");
    } finally {
      setImageUploading(false);
    }
  }

  async function onSingleUpload() {
    const gate = claimRateLimit({ key: "admin_single_question", maxActions: 20, windowMs: 60_000 });
    if (!gate.allowed) {
      setMessage(`Too many uploads. Retry in ${gate.retryAfterSec}s.`);
      return;
    }

    setSaving(true);
    setMessage("");
    setUploadProgress("");

    try {
      if (queueMode) {
        await queueSingleQuestion(question);
        setMessage("Question sent to approval queue.");
      } else {
        await uploadSingleQuestion(question);
        await touchGlobalSync("single_question_upload");
        setMessage("Question uploaded successfully.");
      }
      setQuestion(initialQuestion);
    } catch {
      setMessage("Upload failed. Verify data and admin permissions.");
    } finally {
      setSaving(false);
    }
  }

  async function onBulkUpload() {
    const gate = claimRateLimit({ key: "admin_bulk_question", maxActions: 6, windowMs: 60_000 });
    if (!gate.allowed) {
      setMessage(`Bulk upload rate limit hit. Retry in ${gate.retryAfterSec}s.`);
      return;
    }

    setSaving(true);
    setMessage("");
    setUploadProgress("");

    try {
      const parsed = parseBulkPayload(jsonPayload);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Invalid JSON array");
      }

      if (queueMode) {
        await queueBulkQuestions(parsed, ({ completed, total }) => {
          setUploadProgress(`Queued ${completed}/${total}`);
        });
        setMessage(`${parsed.length} questions queued for approval.`);
      } else {
        await uploadBulkQuestions(parsed, ({ completed, total }) => {
          setUploadProgress(`Uploaded ${completed}/${total}`);
        });
        await touchGlobalSync("bulk_question_upload");
        setMessage(`${parsed.length} questions uploaded successfully.`);
      }
      setJsonPayload("");
      setValidation(null);
    } catch {
      setMessage("Bulk upload failed. Paste a valid JSON array of questions.");
    } finally {
      setSaving(false);
    }
  }

  async function onValidateBulk() {
    setMessage("");
    setDbValidationMessage("");
    try {
      const parsed = parseBulkPayload(jsonPayload);
      const result = validateQuestionsPayload(parsed);
      setValidation(result);
      const dbResult = await validateQuestionsAgainstDatabase(parsed);
      const duplicateHint =
        dbResult.duplicatesWithExisting > 0
          ? `Potential existing duplicates: ${dbResult.duplicatesWithExisting}`
          : "No obvious duplicates found in scanned DB scope.";
      setDbValidationMessage(
        `DB scan combos: ${dbResult.scannedCombos}. ${duplicateHint}${
          dbResult.duplicateSamples.length ? ` Example: ${dbResult.duplicateSamples[0]}` : ""
        }`,
      );
      setMessage(`Validation done. Valid rows: ${result.valid}/${result.total}`);
    } catch {
      setValidation(null);
      setDbValidationMessage("");
      setMessage("Validation failed. Paste a valid JSON array first.");
    }
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 2 Admin Module</p>
        <h2 className="mt-1 text-2xl font-semibold">Question Upload Manager</h2>
        <p className="mt-1 text-sm text-zinc-300">Upload single questions or paste large JSON data. All updates sync live to students.</p>
      </motion.div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Single Question Upload</h3>
        <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          <span>Approval Queue Mode</span>
          <input type="checkbox" checked={queueMode} onChange={(event) => setQueueMode(event.target.checked)} />
        </label>
        <input
          className="input-soft"
          placeholder="Custom ID (optional)"
          value={question.id ?? ""}
          onChange={(event) => setQuestion((prev) => ({ ...prev, id: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Subject"
          value={question.subject}
          onChange={(event) => setQuestion((prev) => ({ ...prev, subject: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Chapter"
          value={question.chapter}
          onChange={(event) => setQuestion((prev) => ({ ...prev, chapter: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Topic"
          value={question.topic}
          onChange={(event) => setQuestion((prev) => ({ ...prev, topic: event.target.value }))}
        />
        <textarea
          className="input-soft min-h-20"
          placeholder="Question text"
          value={question.question}
          onChange={(event) => setQuestion((prev) => ({ ...prev, question: event.target.value }))}
        />
        {question.options.map((option, index) => (
          <input
            key={index}
            className="input-soft"
            placeholder={`Option ${index + 1}`}
            value={option}
            onChange={(event) =>
              setQuestion((prev) => ({
                ...prev,
                options: prev.options.map((item, optionIndex) => (optionIndex === index ? event.target.value : item)),
              }))
            }
          />
        ))}
        <input
          className="input-soft"
          placeholder="Correct Answer"
          value={question.correct_answer}
          onChange={(event) => setQuestion((prev) => ({ ...prev, correct_answer: event.target.value }))}
        />
        <textarea
          className="input-soft min-h-20"
          placeholder="Solution"
          value={question.solution}
          onChange={(event) => setQuestion((prev) => ({ ...prev, solution: event.target.value }))}
        />
        <textarea
          className="input-soft min-h-16"
          placeholder="Concept explanation (optional)"
          value={question.concept_explanation ?? ""}
          onChange={(event) => setQuestion((prev) => ({ ...prev, concept_explanation: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="NCERT reference line (optional)"
          value={question.ncert_reference ?? ""}
          onChange={(event) => setQuestion((prev) => ({ ...prev, ncert_reference: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Formula hint (optional)"
          value={question.formula_hint ?? ""}
          onChange={(event) => setQuestion((prev) => ({ ...prev, formula_hint: event.target.value }))}
        />
        <textarea
          className="input-soft min-h-20 font-mono text-xs"
          placeholder="Optional SVG diagram markup"
          value={question.diagram_svg ?? ""}
          onChange={(event) => setQuestion((prev) => ({ ...prev, diagram_svg: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Question image URL (optional)"
          value={question.question_image ?? ""}
          onChange={(event) => setQuestion((prev) => ({ ...prev, question_image: event.target.value }))}
        />
        <label className="rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          Upload image (JPG/PNG/SVG)
          <input
            type="file"
            accept="image/*,.svg"
            className="mt-2 block w-full text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void onUploadQuestionImage(file);
              }
            }}
          />
        </label>
        {imageUploading ? <p className="text-xs text-zinc-500 dark:text-zinc-400">Uploading image...</p> : null}
        {question.question_image ? (
          <img
            src={question.question_image}
            alt="Question preview"
            className="max-h-48 w-full rounded-2xl border border-zinc-200 bg-white object-contain dark:border-zinc-700 dark:bg-zinc-900"
            loading="lazy"
          />
        ) : null}
        <button
          className="btn-pill-primary w-full px-4 py-3 text-sm"
          type="button"
          onClick={onSingleUpload}
          disabled={saving}
        >
          {saving ? "Uploading..." : queueMode ? "Queue Question" : "Upload Question"}
        </button>
      </div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Smart JSON Paste Upload</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Supports very large JSON arrays and {`{ questions: [] }`} format. Also accepts question_image, diagram_svg, concept_explanation, ncert_reference and formula_hint fields.</p>
        <textarea
          className="input-soft min-h-28 max-h-44 font-mono text-xs"
          placeholder='Paste JSON array: [{"subject":"Physics","chapter":"Laws",...}]'
          value={jsonPayload}
          onChange={(event) => setJsonPayload(event.target.value)}
        />
        <button
          className="btn-pill-dark w-full px-4 py-3 text-sm"
          type="button"
          onClick={onValidateBulk}
          disabled={saving}
        >
          Validate JSON
        </button>
        <button
          className="btn-pill-dark w-full px-4 py-3 text-sm"
          type="button"
          onClick={onBulkUpload}
          disabled={saving}
        >
          {saving ? "Uploading..." : queueMode ? "Queue JSON Data" : "Upload JSON Data"}
        </button>
        {validation ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <p>Total: {validation.total} | Valid: {validation.valid} | Issues: {validation.issues.length}</p>
            {validation.issues.slice(0, 6).map((issue) => (
              <p key={`${issue.index}-${issue.code}`} className="mt-1">
                Row {issue.index + 1}: {issue.message}
              </p>
            ))}
          </div>
        ) : null}
        {dbValidationMessage ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{dbValidationMessage}</p> : null}
        {uploadProgress ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{uploadProgress}</p> : null}
        {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
      </div>
    </section>
  );
}
