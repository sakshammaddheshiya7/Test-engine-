import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  addChapter,
  addTopic,
  deleteQuestionById,
  listenToCatalog,
  listenToQuestionsForAdmin,
  updateQuestionById,
  type CatalogItem,
  type SavedQuestionDoc,
} from "../services/questionService";

type EditableQuestion = {
  subject: string;
  chapter: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  type: "PYQ" | "Normal";
  question: string;
  options: string[];
  correct_answer: string;
  solution: string;
  diagram_svg?: string;
  question_image?: string;
  concept_explanation?: string;
  ncert_reference?: string;
  formula_hint?: string;
};

const emptyEditState: EditableQuestion = {
  subject: "",
  chapter: "",
  topic: "",
  difficulty: "easy",
  type: "Normal",
  question: "",
  options: ["", "", "", ""],
  correct_answer: "",
  solution: "",
  diagram_svg: "",
  question_image: "",
  concept_explanation: "",
  ncert_reference: "",
  formula_hint: "",
};

export default function AdminQuestionBank() {
  const [questions, setQuestions] = useState<SavedQuestionDoc[]>([]);
  const [chapters, setChapters] = useState<CatalogItem[]>([]);
  const [topics, setTopics] = useState<CatalogItem[]>([]);
  const [filterSubject, setFilterSubject] = useState("");
  const [filterChapter, setFilterChapter] = useState("");
  const [filterTopic, setFilterTopic] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [chapterForm, setChapterForm] = useState({ subject: "", chapter: "" });
  const [topicForm, setTopicForm] = useState({ subject: "", chapter: "", topic: "" });
  const [editingId, setEditingId] = useState("");
  const [editState, setEditState] = useState<EditableQuestion>(emptyEditState);

  useEffect(() => {
    const offQuestions = listenToQuestionsForAdmin(setQuestions);
    const offChapters = listenToCatalog("chapters", setChapters);
    const offTopics = listenToCatalog("topics", setTopics);

    return () => {
      offQuestions();
      offChapters();
      offTopics();
    };
  }, []);

  const filteredQuestions = useMemo(() => {
    return questions.filter((item) => {
      const subjectOk = filterSubject ? item.subject.toLowerCase() === filterSubject.toLowerCase() : true;
      const chapterOk = filterChapter ? item.chapter.toLowerCase() === filterChapter.toLowerCase() : true;
      const topicOk = filterTopic ? item.topic.toLowerCase() === filterTopic.toLowerCase() : true;
      const searchText = search.trim().toLowerCase();
      const searchOk = searchText
        ? item.question.toLowerCase().includes(searchText) || item.solution.toLowerCase().includes(searchText)
        : true;

      return subjectOk && chapterOk && topicOk && searchOk;
    });
  }, [filterSubject, filterChapter, filterTopic, questions, search]);

  const subjects = useMemo(() => {
    const values = new Set<string>();
    chapters.forEach((item) => values.add(item.subject ?? ""));
    questions.forEach((item) => values.add(item.subject));
    return Array.from(values).filter(Boolean).sort();
  }, [chapters, questions]);

  const chapterOptions = useMemo(() => {
    const source = chapters
      .filter((item) => (filterSubject ? (item.subject ?? "") === filterSubject : true))
      .map((item) => item.value);
    const fromQuestions = questions
      .filter((item) => (filterSubject ? item.subject === filterSubject : true))
      .map((item) => item.chapter);
    return Array.from(new Set([...source, ...fromQuestions])).sort();
  }, [chapters, filterSubject, questions]);

  const topicOptions = useMemo(() => {
    const source = topics
      .filter((item) => {
        const subjectOk = filterSubject ? (item.subject ?? "") === filterSubject : true;
        const chapterOk = filterChapter ? item.chapter === filterChapter : true;
        return subjectOk && chapterOk;
      })
      .map((item) => item.value);

    const fromQuestions = questions
      .filter((item) => {
        const subjectOk = filterSubject ? item.subject === filterSubject : true;
        const chapterOk = filterChapter ? item.chapter === filterChapter : true;
        return subjectOk && chapterOk;
      })
      .map((item) => item.topic);

    return Array.from(new Set([...source, ...fromQuestions])).sort();
  }, [filterChapter, filterSubject, questions, topics]);

  function onStartEdit(question: SavedQuestionDoc) {
    setEditingId(question.id);
    setEditState({
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
      difficulty: question.difficulty,
      type: question.type,
      question: question.question,
      options: question.options.length === 4 ? question.options : [...question.options, "", "", ""].slice(0, 4),
      correct_answer: question.correct_answer,
      solution: question.solution,
      diagram_svg: question.diagram_svg ?? "",
      question_image: question.question_image ?? "",
      concept_explanation: question.concept_explanation ?? "",
      ncert_reference: question.ncert_reference ?? "",
      formula_hint: question.formula_hint ?? "",
    });
  }

  async function onSaveEdit() {
    if (!editingId) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await updateQuestionById(editingId, editState);
      setMessage("Question updated successfully.");
      setEditingId("");
      setEditState(emptyEditState);
    } catch {
      setMessage("Failed to update question.");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteQuestion(questionId: string) {
    const shouldDelete = window.confirm("Delete this question permanently?");
    if (!shouldDelete) {
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await deleteQuestionById(questionId);
      setMessage("Question deleted.");
    } catch {
      setMessage("Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  async function onAddChapter() {
    if (!chapterForm.subject.trim() || !chapterForm.chapter.trim()) {
      setMessage("Enter subject and chapter.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await addChapter(chapterForm.subject, chapterForm.chapter);
      setChapterForm({ subject: "", chapter: "" });
      setMessage("Chapter saved.");
    } catch {
      setMessage("Failed to save chapter.");
    } finally {
      setSaving(false);
    }
  }

  async function onAddTopic() {
    if (!topicForm.subject.trim() || !topicForm.chapter.trim() || !topicForm.topic.trim()) {
      setMessage("Enter subject, chapter and topic.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await addTopic(topicForm.subject, topicForm.chapter, topicForm.topic);
      setTopicForm({ subject: "", chapter: "", topic: "" });
      setMessage("Topic saved.");
    } catch {
      setMessage("Failed to save topic.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 10 Admin Moderation</p>
        <h2 className="mt-1 text-2xl font-semibold">Question Bank and Catalog Manager</h2>
        <p className="mt-1 text-sm text-zinc-300">Manage chapter/topic metadata and review, edit, or delete questions with live Firebase sync.</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="admin-surface space-y-3 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Chapter</h3>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Subject"
            value={chapterForm.subject}
            onChange={(event) => setChapterForm((prev) => ({ ...prev, subject: event.target.value }))}
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Chapter"
            value={chapterForm.chapter}
            onChange={(event) => setChapterForm((prev) => ({ ...prev, chapter: event.target.value }))}
          />
          <button
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2.5 text-sm font-semibold text-white"
            type="button"
            onClick={onAddChapter}
            disabled={saving}
          >
            Save Chapter
          </button>
        </div>

        <div className="admin-surface space-y-3 p-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Topic</h3>
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Subject"
            value={topicForm.subject}
            onChange={(event) => setTopicForm((prev) => ({ ...prev, subject: event.target.value }))}
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Chapter"
            value={topicForm.chapter}
            onChange={(event) => setTopicForm((prev) => ({ ...prev, chapter: event.target.value }))}
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Topic"
            value={topicForm.topic}
            onChange={(event) => setTopicForm((prev) => ({ ...prev, topic: event.target.value }))}
          />
          <button
            className="w-full rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-zinc-800"
            type="button"
            onClick={onAddTopic}
            disabled={saving}
          >
            Save Topic
          </button>
        </div>
      </div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Moderate Questions</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={filterSubject}
            onChange={(event) => {
              setFilterSubject(event.target.value);
              setFilterChapter("");
              setFilterTopic("");
            }}
          >
            <option value="">All Subjects</option>
            {subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={filterChapter}
            onChange={(event) => {
              setFilterChapter(event.target.value);
              setFilterTopic("");
            }}
          >
            <option value="">All Chapters</option>
            {chapterOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={filterTopic}
            onChange={(event) => setFilterTopic(event.target.value)}
          >
            <option value="">All Topics</option>
            {topicOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Search question text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">Showing {filteredQuestions.length} questions</p>

        <div className="space-y-3">
          {filteredQuestions.slice(0, 30).map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.subject} / {item.chapter} / {item.topic}
                </p>
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                    type="button"
                    onClick={() => onStartEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600"
                    type="button"
                    onClick={() => onDeleteQuestion(item.id)}
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-100">{item.question}</p>
            </div>
          ))}
        </div>
      </div>

      {editingId ? (
        <div className="admin-surface space-y-3 border-orange-200 p-4 dark:border-orange-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Edit Question</h3>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={editState.subject}
              onChange={(event) => setEditState((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject"
            />
            <input
              className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={editState.chapter}
              onChange={(event) => setEditState((prev) => ({ ...prev, chapter: event.target.value }))}
              placeholder="Chapter"
            />
            <input
              className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={editState.topic}
              onChange={(event) => setEditState((prev) => ({ ...prev, topic: event.target.value }))}
              placeholder="Topic"
            />
            <select
              className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={editState.difficulty}
              onChange={(event) =>
                setEditState((prev) => ({ ...prev, difficulty: event.target.value as EditableQuestion["difficulty"] }))
              }
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
            <select
              className="rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={editState.type}
              onChange={(event) => setEditState((prev) => ({ ...prev, type: event.target.value as EditableQuestion["type"] }))}
            >
              <option value="Normal">Normal</option>
              <option value="PYQ">PYQ</option>
            </select>
          </div>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.question}
            onChange={(event) => setEditState((prev) => ({ ...prev, question: event.target.value }))}
            placeholder="Question text"
          />
          {editState.options.map((option, index) => (
            <input
              key={index}
              className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              value={option}
              onChange={(event) =>
                setEditState((prev) => ({
                  ...prev,
                  options: prev.options.map((item, optionIndex) => (optionIndex === index ? event.target.value : item)),
                }))
              }
              placeholder={`Option ${index + 1}`}
            />
          ))}
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.correct_answer}
            onChange={(event) => setEditState((prev) => ({ ...prev, correct_answer: event.target.value }))}
            placeholder="Correct answer"
          />
          <textarea
            className="min-h-20 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.solution}
            onChange={(event) => setEditState((prev) => ({ ...prev, solution: event.target.value }))}
            placeholder="Solution"
          />
          <textarea
            className="min-h-20 w-full rounded-2xl border border-zinc-200 px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.diagram_svg ?? ""}
            onChange={(event) => setEditState((prev) => ({ ...prev, diagram_svg: event.target.value }))}
            placeholder="Optional SVG diagram markup"
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.question_image ?? ""}
            onChange={(event) => setEditState((prev) => ({ ...prev, question_image: event.target.value }))}
            placeholder="Question image URL"
          />
          <textarea
            className="min-h-16 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.concept_explanation ?? ""}
            onChange={(event) => setEditState((prev) => ({ ...prev, concept_explanation: event.target.value }))}
            placeholder="Concept explanation"
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.ncert_reference ?? ""}
            onChange={(event) => setEditState((prev) => ({ ...prev, ncert_reference: event.target.value }))}
            placeholder="NCERT reference"
          />
          <input
            className="w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            value={editState.formula_hint ?? ""}
            onChange={(event) => setEditState((prev) => ({ ...prev, formula_hint: event.target.value }))}
            placeholder="Formula hint"
          />
          <div className="flex gap-2">
            <button
              className="rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white"
              type="button"
              onClick={onSaveEdit}
              disabled={saving}
            >
              Save Changes
            </button>
            <button
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              type="button"
              onClick={() => {
                setEditingId("");
                setEditState(emptyEditState);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
    </section>
  );
}