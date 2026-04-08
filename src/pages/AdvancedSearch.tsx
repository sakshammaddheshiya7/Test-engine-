import { useState } from "react";
import { motion } from "framer-motion";
import QuestionSupport from "../components/QuestionSupport";
import { VirtualizedList } from "../components/VirtualizedList";
import {
  searchQuestionsPage,
  type QuestionDoc,
  type SearchPageResult,
} from "../services/questionService";

type SearchState = {
  queryText: string;
  subject: string;
  chapter: string;
  topic: string;
  type: "" | "PYQ" | "Normal";
  difficulty: "" | "easy" | "medium" | "hard";
};

const initialSearch: SearchState = {
  queryText: "",
  subject: "",
  chapter: "",
  topic: "",
  type: "",
  difficulty: "",
};

export default function AdvancedSearch() {
  const [filters, setFilters] = useState<SearchState>(initialSearch);
  const [results, setResults] = useState<QuestionDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [cursor, setCursor] = useState<SearchPageResult["cursor"]>(null);
  const [hasMore, setHasMore] = useState(false);

  async function runSearch() {
    setLoading(true);
    setError("");
    try {
      const page = await searchQuestionsPage(filters, 70, null);
      setResults(page.rows);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
      setExpandedId("");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Search failed. Try different filters.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || loading) {
      return;
    }
    setLoading(true);
    try {
      const page = await searchQuestionsPage(filters, 70, cursor);
      setResults((prev) => [...prev, ...page.rows]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Failed to load next page.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="panel-3d p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 31</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Advanced Search</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Find questions by query, chapter, topic, formula, concept, PYQ type, and difficulty.</p>
      </motion.div>

      <div className="panel-3d grid gap-3 p-4 sm:grid-cols-2">
        <input
          className="input-soft sm:col-span-2"
          value={filters.queryText}
          onChange={(event) => setFilters((prev) => ({ ...prev, queryText: event.target.value }))}
          placeholder="Search question, formula, concept, chapter, or keyword"
        />
        <input
          className="input-soft"
          value={filters.subject}
          onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
          placeholder="Subject"
        />
        <input
          className="input-soft"
          value={filters.chapter}
          onChange={(event) => setFilters((prev) => ({ ...prev, chapter: event.target.value }))}
          placeholder="Chapter"
        />
        <input
          className="input-soft"
          value={filters.topic}
          onChange={(event) => setFilters((prev) => ({ ...prev, topic: event.target.value }))}
          placeholder="Topic"
        />
        <select
          className="input-soft"
          value={filters.type}
          onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value as SearchState["type"] }))}
        >
          <option value="">Any Type</option>
          <option value="Normal">Normal</option>
          <option value="PYQ">PYQ</option>
        </select>
        <select
          className="input-soft"
          value={filters.difficulty}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, difficulty: event.target.value as SearchState["difficulty"] }))
          }
        >
          <option value="">Any Difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button className="btn-pill-primary sm:col-span-2 px-4 py-3 text-sm" type="button" onClick={runSearch} disabled={loading}>
          {loading ? "Searching..." : "Run Search"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}

      <div className="panel-3d p-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Results: {results.length}</p>
        <div className="mt-3">
          {results.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No results yet. Run a search.</p> : null}
          {results.length > 0 ? (
            <VirtualizedList
              items={results}
              rowHeight={270}
              viewportHeight={620}
              renderRow={(item, index) => {
                const rowId = item.id ?? `${index}`;
                const expanded = expandedId === rowId;
                return (
                  <article className="mx-1 my-1 h-[258px] overflow-y-auto rounded-2xl border border-zinc-200/80 bg-white/85 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {item.subject} / {item.chapter} / {item.topic} | {item.type} | {item.difficulty}
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.question}</p>
                    <button
                      type="button"
                      className="btn-pill-ghost mt-2 px-3 py-1.5 text-[11px]"
                      onClick={() => setExpandedId(expanded ? "" : rowId)}
                    >
                      {expanded ? "Hide Details" : "View Details"}
                    </button>
                    {expanded ? (
                      <div className="mt-3 space-y-2">
                        <QuestionSupport
                          svgMarkup={item.diagram_svg}
                          imageUrl={item.question_image}
                          conceptExplanation={item.concept_explanation}
                          ncertReference={item.ncert_reference}
                          formulaHint={item.formula_hint}
                        />
                        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          Correct: {item.correct_answer}
                        </p>
                        <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">{item.solution}</p>
                      </div>
                    ) : null}
                  </article>
                );
              }}
            />
          ) : null}
        </div>
        {hasMore ? (
          <button type="button" className="btn-pill-ghost mt-4 px-4 py-2 text-xs" onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
