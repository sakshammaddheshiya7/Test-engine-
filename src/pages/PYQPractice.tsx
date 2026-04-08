import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import QuestionSupport from "../components/QuestionSupport";
import {
  bookmarkQuestion,
  generateCustomTest,
  saveWrongQuestion,
  type QuestionDoc,
} from "../services/questionService";

type PyqFilters = {
  subject: string;
  chapter: string;
  topic: string;
  numberOfQuestions: number;
};

const defaultFilters: PyqFilters = {
  subject: "",
  chapter: "",
  topic: "",
  numberOfQuestions: 15,
};

export default function PYQPractice() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<PyqFilters>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [error, setError] = useState("");

  const currentQuestion = questions[currentIndex];
  const progress = questions.length ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0;

  async function loadPyqs() {
    setLoading(true);
    setError("");
    try {
      const generated = await generateCustomTest({
        ...filters,
        difficulty: "",
        type: "PYQ",
      });
      setQuestions(generated);
      setCurrentIndex(0);
      setSelectedOption(null);
      setShowSolution(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to fetch PYQ set right now.");
    } finally {
      setLoading(false);
    }
  }

  async function onSelect(option: string) {
    if (!currentQuestion || selectedOption) {
      return;
    }

    setSelectedOption(option);
    if (option !== currentQuestion.correct_answer && user) {
      await saveWrongQuestion(user.uid, currentQuestion);
    }
  }

  async function onBookmark() {
    if (!currentQuestion || !user) {
      return;
    }

    await bookmarkQuestion(user.uid, currentQuestion);
  }

  function onNext() {
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setShowSolution(false);
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel-3d p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Part 8</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">PYQ Practice</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Focus on previous-year question patterns with fast mobile-first practice flow.</p>
      </motion.div>

      <div className="panel-3d grid gap-3 p-4 sm:grid-cols-2">
        <input
          className="input-soft"
          placeholder="Subject"
          value={filters.subject}
          onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Chapter"
          value={filters.chapter}
          onChange={(event) => setFilters((prev) => ({ ...prev, chapter: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Topic"
          value={filters.topic}
          onChange={(event) => setFilters((prev) => ({ ...prev, topic: event.target.value }))}
        />
        <input
          className="input-soft"
          type="number"
          min={1}
          max={60}
          value={filters.numberOfQuestions}
          onChange={(event) => setFilters((prev) => ({ ...prev, numberOfQuestions: Number(event.target.value || 15) }))}
        />
        <button
          className="btn-pill-primary sm:col-span-2 px-4 py-3 text-sm"
          onClick={loadPyqs}
          type="button"
          disabled={loading}
        >
          {loading ? "Fetching PYQs..." : "Start PYQ Practice"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      {currentQuestion ? (
        <motion.article
          key={currentQuestion.id ?? currentQuestion.question}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-3d space-y-4 p-5"
        >
          <div className="h-2 w-full rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {currentQuestion.subject} / {currentQuestion.chapter} / {currentQuestion.topic}
          </p>
          <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">{currentQuestion.question}</p>
          <QuestionSupport
            svgMarkup={currentQuestion.diagram_svg}
            imageUrl={currentQuestion.question_image}
            conceptExplanation={currentQuestion.concept_explanation}
            ncertReference={currentQuestion.ncert_reference}
            formulaHint={currentQuestion.formula_hint}
          />

          <div className="space-y-2">
            {currentQuestion.options.map((option) => {
              const isCorrect = option === currentQuestion.correct_answer;
              const isSelected = option === selectedOption;
              const wrongChoice = Boolean(selectedOption && isSelected && !isCorrect);

              return (
                <button
                  key={option}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm transition ${
                    isCorrect && selectedOption
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : wrongChoice
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                  onClick={() => onSelect(option)}
                  type="button"
                >
                  {option}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="btn-pill-ghost bg-zinc-900 px-4 py-2 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
              onClick={() => setShowSolution((prev) => !prev)}
              type="button"
            >
              {showSolution ? "Hide Solution" : "Show Solution"}
            </button>
            <button
              className="btn-pill-ghost px-4 py-2 text-xs"
              onClick={onBookmark}
              type="button"
            >
              Save Question
            </button>
            <button
              className="btn-pill-primary px-4 py-2 text-xs"
              onClick={onNext}
              type="button"
            >
              Next PYQ
            </button>
          </div>

          {showSolution ? (
            <p className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{currentQuestion.solution}</p>
          ) : null}
        </motion.article>
      ) : (
        <p className="text-sm text-zinc-500">Load PYQs from Firestore to begin.</p>
      )}

      {questions.length > 0 && currentIndex >= questions.length ? (
        <div className="panel-3d p-4 text-sm text-zinc-600 dark:text-zinc-300">
          PYQ practice complete. You can start another PYQ set.
        </div>
      ) : null}
    </section>
  );
}
