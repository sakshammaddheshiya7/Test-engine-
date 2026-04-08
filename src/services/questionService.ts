import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db } from "../firebase/firebaseConfig";
import { storage } from "../firebase/firebaseConfig";
import { shuffleQuestions } from "../utils/shuffleQuestions";
import type { TestSecuritySnapshot } from "./testSecurityService";

export type QuestionDoc = {
  id?: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  type: "PYQ" | "Normal";
  question: string;
  options: string[];
  correct_answer: string;
  solution: string;
  pdf_link?: string;
  diagram_svg?: string;
  question_image?: string;
  concept_explanation?: string;
  ncert_reference?: string;
  formula_hint?: string;
};

export type ApprovalQueueItem = {
  id: string;
  status: "pending" | "approved" | "rejected";
  question: QuestionDoc;
  moderation: {
    score: number;
    flags: string[];
  };
  reason?: string;
  createdAt?: { seconds: number };
};

export type SavedQuestionDoc = QuestionDoc & {
  id: string;
};

export type TestFilters = {
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: string;
  type?: string;
  numberOfQuestions: number;
};

export type SearchFilters = {
  queryText?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  type?: "PYQ" | "Normal" | "";
  difficulty?: "easy" | "medium" | "hard" | "";
};

export type SearchPageResult = {
  rows: QuestionDoc[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

export type CatalogItem = {
  id: string;
  value: string;
  subject?: string;
  chapter?: string;
  createdAt?: { seconds: number };
};

export type TopicPerformance = {
  attempted: number;
  correct: number;
};

export type QuestionDifficultyInsight = {
  questionId: string;
  chapter: string;
  topic: string;
  level: "Easy" | "Medium" | "Hard" | "Very Hard";
  isCorrect: boolean;
  timeTakenSec: number;
};

export type MistakeAnalysis = {
  conceptErrors: number;
  calculationErrors: number;
  sillyMistakes: number;
  suggestions: string[];
};

export type TestAttemptDoc = {
  id: string;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  timeTakenSec: number;
  filters: Omit<TestFilters, "numberOfQuestions"> & { numberOfQuestions: number };
  weakChapters: string[];
  topicPerformance: Record<string, TopicPerformance>;
  adaptiveDifficulty?: "easy" | "medium" | "hard";
  difficultyInsights?: QuestionDifficultyInsight[];
  mistakeAnalysis?: MistakeAnalysis;
  testSecurity?: TestSecuritySnapshot;
  createdAt?: { seconds: number };
};

export type LeaderboardDoc = {
  id: string;
  email: string;
  displayName?: string;
  allTimeXP: number;
  dayXP: number;
  weekXP: number;
  streak: number;
  subjectXP?: Record<string, number>;
  lastActiveDay?: string;
  updatedAt?: { seconds: number };
};

export type ValidationIssue = {
  index: number;
  code: "missing_question" | "invalid_options" | "invalid_correct_answer" | "duplicate_question";
  message: string;
};

export type ValidationResult = {
  total: number;
  valid: number;
  issues: ValidationIssue[];
};

export type DatabaseValidationResult = {
  scannedCombos: number;
  duplicatesWithExisting: number;
  duplicateSamples: string[];
};

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toWeekKey(date: Date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

async function syncLeaderboardAfterAttempt(input: {
  userId: string;
  email?: string;
  displayName?: string;
  xpEarned: number;
  subject?: string;
}) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const weekKey = toWeekKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  const subjectKey = (input.subject ?? "general").trim().toLowerCase() || "general";

  const leaderboardRef = doc(db, "leaderboard_public", input.userId);
  const existing = await getDoc(leaderboardRef);
  const data = existing.exists() ? (existing.data() as Record<string, unknown>) : {};

  const previousDay = String(data.lastActiveDay ?? "");
  const previousStreak = Number(data.streak ?? 0);
  const nextStreak =
    previousDay === todayKey ? previousStreak : previousDay === yesterdayKey ? previousStreak + 1 : 1;

  const previousDayXP = Number(data.dayXP ?? 0);
  const previousWeekXP = Number(data.weekXP ?? 0);
  const previousAllXP = Number(data.allTimeXP ?? 0);
  const previousSubjectXP = (data.subjectXP as Record<string, number> | undefined) ?? {};

  await setDoc(
    leaderboardRef,
    {
      email: input.email ?? String(data.email ?? ""),
      displayName: input.displayName ?? String(data.displayName ?? ""),
      dayKey: todayKey,
      weekKey,
      dayXP: (String(data.dayKey ?? "") === todayKey ? previousDayXP : 0) + input.xpEarned,
      weekXP: (String(data.weekKey ?? "") === weekKey ? previousWeekXP : 0) + input.xpEarned,
      allTimeXP: previousAllXP + input.xpEarned,
      streak: nextStreak,
      lastActiveDay: todayKey,
      subjectXP: {
        ...previousSubjectXP,
        [subjectKey]: Number(previousSubjectXP[subjectKey] ?? 0) + input.xpEarned,
      },
      updatedAt: serverTimestamp(),
      createdAt: data.createdAt ?? serverTimestamp(),
    },
    { merge: true },
  );
}

function cleanQuestionPayload(question: QuestionDoc) {
  const diagramSvg = question.diagram_svg?.trim() ?? "";

  return {
    subject: question.subject.trim(),
    chapter: question.chapter.trim(),
    topic: question.topic.trim(),
    difficulty: question.difficulty,
    type: question.type,
    question: question.question.trim(),
    options: question.options.map((option) => option.trim()),
    correct_answer: question.correct_answer.trim(),
    solution: question.solution.trim(),
    pdf_link: question.pdf_link?.trim() ?? "",
    diagram_svg: diagramSvg,
    question_image: question.question_image?.trim() ?? "",
    concept_explanation: question.concept_explanation?.trim() ?? "",
    ncert_reference: question.ncert_reference?.trim() ?? "",
    formula_hint: question.formula_hint?.trim() ?? "",
    updatedAt: serverTimestamp(),
  };
}

function normalizeQuestionItem(input: Partial<QuestionDoc> & { [key: string]: unknown }): QuestionDoc {
  const options = Array.isArray(input.options) ? input.options.map((item) => String(item ?? "")) : ["", "", "", ""];
  const paddedOptions = [...options, "", "", ""].slice(0, 4);

  return {
    id: input.id ? String(input.id) : undefined,
    subject: String(input.subject ?? "General"),
    chapter: String(input.chapter ?? "General"),
    topic: String(input.topic ?? "General"),
    difficulty: (String(input.difficulty ?? "medium").toLowerCase() as QuestionDoc["difficulty"]) || "medium",
    type: String(input.type ?? "Normal").toUpperCase() === "PYQ" ? "PYQ" : "Normal",
    question: String(input.question ?? ""),
    options: paddedOptions,
    correct_answer: String(input.correct_answer ?? ""),
    solution: String(input.solution ?? ""),
    pdf_link: String(input.pdf_link ?? ""),
    diagram_svg: String(input.diagram_svg ?? input.diagramSvg ?? ""),
    question_image: String(input.question_image ?? input.questionImage ?? ""),
    concept_explanation: String(input.concept_explanation ?? input.conceptExplanation ?? ""),
    ncert_reference: String(input.ncert_reference ?? input.ncertReference ?? ""),
    formula_hint: String(input.formula_hint ?? input.formulaHint ?? ""),
  };
}

function autoModerateQuestion(question: QuestionDoc) {
  const flags: string[] = [];
  let score = 100;
  const trimmedQuestion = question.question.trim();

  if (trimmedQuestion.length < 16) {
    flags.push("question_too_short");
    score -= 18;
  }
  if (question.options.some((item) => !item.trim())) {
    flags.push("empty_option");
    score -= 25;
  }
  if (!question.options.some((item) => item.trim() === question.correct_answer.trim())) {
    flags.push("correct_answer_mismatch");
    score -= 28;
  }
  if ((question.solution ?? "").trim().length < 10) {
    flags.push("weak_solution");
    score -= 12;
  }
  if (/http:\/\//i.test(trimmedQuestion)) {
    flags.push("unsafe_link");
    score -= 20;
  }

  return {
    score: Math.max(0, score),
    flags,
  };
}

export function validateQuestionsPayload(questions: QuestionDoc[]): ValidationResult {
  const normalized = questions.map((item) => normalizeQuestionItem(item));
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();

  normalized.forEach((item, index) => {
    const key = `${item.subject}__${item.chapter}__${item.topic}__${item.question}`.toLowerCase().trim();
    if (seen.has(key)) {
      issues.push({
        index,
        code: "duplicate_question",
        message: `Duplicate with row ${seen.get(key)}`,
      });
    } else {
      seen.set(key, index);
    }

    if (!item.question.trim()) {
      issues.push({ index, code: "missing_question", message: "Question text is empty." });
    }

    if (!Array.isArray(item.options) || item.options.length !== 4 || item.options.some((opt) => !opt.trim())) {
      issues.push({ index, code: "invalid_options", message: "Exactly 4 non-empty options required." });
    }

    if (!item.options.some((opt) => opt.trim() === item.correct_answer.trim())) {
      issues.push({ index, code: "invalid_correct_answer", message: "correct_answer must match one option." });
    }
  });

  const invalidIndexes = new Set(issues.map((issue) => issue.index));
  return {
    total: normalized.length,
    valid: normalized.length - invalidIndexes.size,
    issues,
  };
}

export async function validateQuestionsAgainstDatabase(
  questions: QuestionDoc[],
  maxCombos = 12,
): Promise<DatabaseValidationResult> {
  const normalized = questions.map((item) => normalizeQuestionItem(item));
  const comboMap = new Map<string, { subject: string; chapter: string; topic: string }>();

  normalized.forEach((item) => {
    const subject = item.subject.trim();
    const chapter = item.chapter.trim();
    const topic = item.topic.trim();
    const combo = `${subject}__${chapter}__${topic}`.toLowerCase();
    if (!comboMap.has(combo)) {
      comboMap.set(combo, { subject, chapter, topic });
    }
  });

  const combos = [...comboMap.values()].slice(0, maxCombos);
  if (!combos.length) {
    return {
      scannedCombos: 0,
      duplicatesWithExisting: 0,
      duplicateSamples: [],
    };
  }

  const existingKeySet = new Set<string>();

  for (const combo of combos) {
    const rows = await getDocs(
      query(
        collection(db, "questions"),
        where("subject", "==", combo.subject),
        where("chapter", "==", combo.chapter),
        where("topic", "==", combo.topic),
        limit(1200),
      ),
    );

    rows.docs.forEach((docItem) => {
      const data = docItem.data() as QuestionDoc;
      const key = `${String(data.subject ?? "").trim()}__${String(data.chapter ?? "").trim()}__${String(data.topic ?? "").trim()}__${String(data.question ?? "").trim()}`
        .toLowerCase()
        .trim();
      if (key) {
        existingKeySet.add(key);
      }
    });
  }

  const duplicates: string[] = [];
  normalized.forEach((item) => {
    const key = `${item.subject.trim()}__${item.chapter.trim()}__${item.topic.trim()}__${item.question.trim()}`
      .toLowerCase()
      .trim();
    if (key && existingKeySet.has(key)) {
      duplicates.push(item.question.trim().slice(0, 140));
    }
  });

  return {
    scannedCombos: combos.length,
    duplicatesWithExisting: duplicates.length,
    duplicateSamples: duplicates.slice(0, 8),
  };
}

export async function uploadQuestionImage(file: File) {
  const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const fileRef = ref(storage, `question_media/${Date.now()}-${safeName}`);
  await uploadBytes(fileRef, file, { contentType: file.type || "image/*" });
  return getDownloadURL(fileRef);
}

async function syncCatalogFromQuestions(questions: QuestionDoc[]) {
  const uniqueChapters = new Set<string>();
  const uniqueTopics = new Set<string>();

  questions.forEach((item) => {
    const subject = item.subject.trim();
    const chapter = item.chapter.trim();
    const topic = item.topic.trim();

    if (subject && chapter) {
      uniqueChapters.add(`${subject}__${chapter}`);
    }

    if (subject && chapter && topic) {
      uniqueTopics.add(`${subject}__${chapter}__${topic}`);
    }
  });

  const chunkSize = 350;
  const chapterItems = [...uniqueChapters];
  const topicItems = [...uniqueTopics];

  for (let index = 0; index < chapterItems.length; index += chunkSize) {
    const batch = writeBatch(db);
    chapterItems.slice(index, index + chunkSize).forEach((packed) => {
      const [subject, chapter] = packed.split("__");
      const id = `${subject.toLowerCase()}__${chapter.toLowerCase().replace(/\s+/g, "_")}`;
      batch.set(
        doc(db, "chapters", id),
        {
          subject,
          value: chapter,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }

  for (let index = 0; index < topicItems.length; index += chunkSize) {
    const batch = writeBatch(db);
    topicItems.slice(index, index + chunkSize).forEach((packed) => {
      const [subject, chapter, topic] = packed.split("__");
      const id = `${subject.toLowerCase()}__${chapter.toLowerCase().replace(/\s+/g, "_")}__${topic
        .toLowerCase()
        .replace(/\s+/g, "_")}`;
      batch.set(
        doc(db, "topics", id),
        {
          subject,
          chapter,
          value: topic,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
    await batch.commit();
  }
}

async function syncQuestionAcrossUserCollections(questionId: string, updates: Partial<QuestionDoc>) {
  const syncPayload = {
    subject: updates.subject?.trim(),
    chapter: updates.chapter?.trim(),
    topic: updates.topic?.trim(),
    difficulty: updates.difficulty,
    type: updates.type,
    question: updates.question?.trim(),
    options: updates.options?.map((item) => item.trim()),
    correct_answer: updates.correct_answer?.trim(),
    solution: updates.solution?.trim(),
    pdf_link: updates.pdf_link?.trim(),
    diagram_svg: updates.diagram_svg?.trim(),
    question_image: updates.question_image?.trim(),
    concept_explanation: updates.concept_explanation?.trim(),
    ncert_reference: updates.ncert_reference?.trim(),
    formula_hint: updates.formula_hint?.trim(),
    globalSyncedAt: serverTimestamp(),
  };

  const collectionsToSync = ["mistake_book", "saved_questions"] as const;
  for (const collectionName of collectionsToSync) {
    const snapshot = await getDocs(query(collectionGroup(db, collectionName), where(documentId(), "==", questionId), limit(300)));
    if (!snapshot.docs.length) {
      continue;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((docItem) => {
      batch.set(docItem.ref, syncPayload, { merge: true });
    });
    await batch.commit();
  }
}

export async function uploadSingleQuestion(question: QuestionDoc) {
  const normalizedQuestion = normalizeQuestionItem(question);
  const payload = {
    ...cleanQuestionPayload(normalizedQuestion),
    createdAt: serverTimestamp(),
  };

  if (normalizedQuestion.id?.trim()) {
    const docRef = doc(db, "questions", normalizedQuestion.id.trim());
    await setDoc(docRef, payload, { merge: true });
    await syncCatalogFromQuestions([normalizedQuestion]);
    return;
  }

  await addDoc(collection(db, "questions"), payload);
  await syncCatalogFromQuestions([normalizedQuestion]);
}

export async function queueSingleQuestion(question: QuestionDoc) {
  const normalizedQuestion = normalizeQuestionItem(question);
  const moderation = autoModerateQuestion(normalizedQuestion);
  await addDoc(collection(db, "question_approval_queue"), {
    status: "pending",
    question: {
      ...normalizedQuestion,
      id: normalizedQuestion.id?.trim() || "",
    },
    moderation,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function uploadBulkQuestions(
  questions: QuestionDoc[],
  onProgress?: (status: { completed: number; total: number }) => void,
) {
  const normalized = questions.map((item) => normalizeQuestionItem(item));
  const chunkSize = 350;
  let completed = 0;

  for (let index = 0; index < normalized.length; index += chunkSize) {
    const batch = writeBatch(db);
    const chunk = normalized.slice(index, index + chunkSize);

    chunk.forEach((question) => {
      const payload = {
        ...cleanQuestionPayload(question),
        createdAt: serverTimestamp(),
      };

      if (question.id?.trim()) {
        batch.set(doc(db, "questions", question.id.trim()), payload, { merge: true });
        return;
      }

      const autoDoc = doc(collection(db, "questions"));
      batch.set(autoDoc, payload);
    });

    await batch.commit();
    completed += chunk.length;
    onProgress?.({ completed, total: normalized.length });
  }

  await syncCatalogFromQuestions(normalized);
}

export async function queueBulkQuestions(
  questions: QuestionDoc[],
  onProgress?: (status: { completed: number; total: number }) => void,
) {
  const normalized = questions.map((item) => normalizeQuestionItem(item));
  const chunkSize = 220;
  let completed = 0;

  for (let index = 0; index < normalized.length; index += chunkSize) {
    const batch = writeBatch(db);
    const chunk = normalized.slice(index, index + chunkSize);

    chunk.forEach((question) => {
      const rowRef = doc(collection(db, "question_approval_queue"));
      batch.set(rowRef, {
        status: "pending",
        question: {
          ...question,
          id: question.id?.trim() || "",
        },
        moderation: autoModerateQuestion(question),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    completed += chunk.length;
    onProgress?.({ completed, total: normalized.length });
  }
}

export function listenQuestionApprovalQueue(
  onData: (rows: ApprovalQueueItem[]) => void,
  status: "pending" | "approved" | "rejected" | "all" = "pending",
) {
  const baseRef = collection(db, "question_approval_queue");
  const rowsQuery =
    status === "all"
      ? query(baseRef, orderBy("createdAt", "desc"), limit(200))
      : query(baseRef, where("status", "==", status), orderBy("createdAt", "desc"), limit(200));

  return onSnapshot(rowsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as ApprovalQueueItem[];
    onData(rows);
  });
}

export async function approveQueuedQuestion(queueId: string) {
  const rowRef = doc(db, "question_approval_queue", queueId);
  const rowSnapshot = await getDoc(rowRef);
  if (!rowSnapshot.exists()) {
    throw new Error("Queue item not found.");
  }

  const row = rowSnapshot.data() as {
    status?: string;
    question?: QuestionDoc;
  };

  if (row.status && row.status !== "pending") {
    return;
  }

  const payload = row.question;
  if (!payload) {
    throw new Error("Missing question payload in queue item.");
  }

  await uploadSingleQuestion(payload);
  await setDoc(
    rowRef,
    {
      status: "approved",
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function rejectQueuedQuestion(queueId: string, reason: string) {
  await setDoc(
    doc(db, "question_approval_queue", queueId),
    {
      status: "rejected",
      reason: reason.trim().slice(0, 240),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenToQuestionsForAdmin(onData: (rows: SavedQuestionDoc[]) => void) {
  const questionsQuery = query(collection(db, "questions"), orderBy("updatedAt", "desc"), limit(200));

  return onSnapshot(questionsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as SavedQuestionDoc[];

    onData(rows);
  });
}

export async function updateQuestionById(questionId: string, updates: Partial<QuestionDoc>) {
  const payload = {
    ...updates,
    subject: updates.subject?.trim(),
    chapter: updates.chapter?.trim(),
    topic: updates.topic?.trim(),
    question: updates.question?.trim(),
    options: updates.options?.map((item) => item.trim()),
    correct_answer: updates.correct_answer?.trim(),
    solution: updates.solution?.trim(),
    pdf_link: updates.pdf_link?.trim(),
    question_image: updates.question_image?.trim(),
    concept_explanation: updates.concept_explanation?.trim(),
    ncert_reference: updates.ncert_reference?.trim(),
    formula_hint: updates.formula_hint?.trim(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, "questions", questionId), payload, { merge: true });
  await syncQuestionAcrossUserCollections(questionId, updates);
}

export async function deleteQuestionById(questionId: string) {
  await deleteDoc(doc(db, "questions", questionId));
}

export async function addChapter(subject: string, chapter: string) {
  const id = `${subject.trim().toLowerCase()}__${chapter.trim().toLowerCase().replace(/\s+/g, "_")}`;
  await setDoc(doc(db, "chapters", id), {
    subject: subject.trim(),
    value: chapter.trim(),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function addTopic(subject: string, chapter: string, topic: string) {
  const id = `${subject.trim().toLowerCase()}__${chapter.trim().toLowerCase().replace(/\s+/g, "_")}__${topic
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")}`;
  await setDoc(
    doc(db, "topics", id),
    {
      subject: subject.trim(),
      chapter: chapter.trim(),
      value: topic.trim(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenToCatalog(collectionName: "chapters" | "topics", onData: (rows: CatalogItem[]) => void) {
  const ref = query(collection(db, collectionName), orderBy("updatedAt", "desc"), limit(150));
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as CatalogItem[];

    onData(rows);
  });
}

export async function generateCustomTest(filters: TestFilters) {
  const constraints = [];
  if (filters.subject?.trim()) {
    constraints.push(where("subject", "==", filters.subject.trim()));
  }

  if (filters.chapter?.trim()) {
    constraints.push(where("chapter", "==", filters.chapter.trim()));
  }

  if (filters.topic?.trim()) {
    constraints.push(where("topic", "==", filters.topic.trim()));
  }

  if (filters.difficulty?.trim()) {
    constraints.push(where("difficulty", "==", filters.difficulty.trim()));
  }

  if (filters.type?.trim()) {
    constraints.push(where("type", "==", filters.type.trim()));
  }

  const fetchLimit = filters.subject?.trim() || filters.chapter?.trim() || filters.topic?.trim() ? 3000 : 1200;
  const baseQuery = query(collection(db, "questions"), ...constraints, limit(fetchLimit));
  const snapshot = await getDocs(baseQuery);
  const questions = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...(docItem.data() as DocumentData),
  })) as QuestionDoc[];

  return shuffleQuestions(questions).slice(0, filters.numberOfQuestions);
}

export async function searchQuestionsGlobal(filters: SearchFilters, maxRows = 240) {
  const constraints = [];

  if (filters.subject?.trim()) {
    constraints.push(where("subject", "==", filters.subject.trim()));
  }

  if (filters.chapter?.trim()) {
    constraints.push(where("chapter", "==", filters.chapter.trim()));
  }

  if (filters.topic?.trim()) {
    constraints.push(where("topic", "==", filters.topic.trim()));
  }

  if (filters.type?.trim()) {
    constraints.push(where("type", "==", filters.type.trim()));
  }

  if (filters.difficulty?.trim()) {
    constraints.push(where("difficulty", "==", filters.difficulty.trim()));
  }

  const baseQuery = query(collection(db, "questions"), ...constraints, limit(900));
  const snapshot = await getDocs(baseQuery);
  const rows = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...(docItem.data() as DocumentData),
  })) as QuestionDoc[];

  const queryText = filters.queryText?.trim().toLowerCase() ?? "";
  if (!queryText) {
    return rows.slice(0, maxRows);
  }

  const filtered = rows.filter((item) => {
    const bag = [
      item.question,
      item.solution,
      item.subject,
      item.chapter,
      item.topic,
      item.formula_hint,
      item.ncert_reference,
      item.concept_explanation,
      item.type,
      item.difficulty,
    ]
      .join(" ")
      .toLowerCase();

    return bag.includes(queryText);
  });

  return filtered.slice(0, maxRows);
}

export async function searchQuestionsPage(
  filters: SearchFilters,
  pageSize = 60,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<SearchPageResult> {
  const constraints = [];

  if (filters.subject?.trim()) {
    constraints.push(where("subject", "==", filters.subject.trim()));
  }

  if (filters.chapter?.trim()) {
    constraints.push(where("chapter", "==", filters.chapter.trim()));
  }

  if (filters.topic?.trim()) {
    constraints.push(where("topic", "==", filters.topic.trim()));
  }

  if (filters.type?.trim()) {
    constraints.push(where("type", "==", filters.type.trim()));
  }

  if (filters.difficulty?.trim()) {
    constraints.push(where("difficulty", "==", filters.difficulty.trim()));
  }

  constraints.push(orderBy("updatedAt", "desc"));
  constraints.push(orderBy("question", "asc"));
  constraints.push(limit(pageSize));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const baseQuery = query(collection(db, "questions"), ...constraints);
  const snapshot = await getDocs(baseQuery);
  const queryText = filters.queryText?.trim().toLowerCase() ?? "";
  const mappedRows = snapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...(docItem.data() as DocumentData),
  })) as QuestionDoc[];

  const rows = mappedRows
    .filter((item) => {
      if (!queryText) {
        return true;
      }
      const bag = [
        item.question,
        item.solution,
        item.subject,
        item.chapter,
        item.topic,
        item.formula_hint,
        item.ncert_reference,
        item.concept_explanation,
        item.type,
        item.difficulty,
      ]
        .join(" ")
        .toLowerCase();

      return bag.includes(queryText);
    }) as QuestionDoc[];

  const nextCursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;
  return {
    rows,
    cursor: nextCursor,
    hasMore: snapshot.docs.length === pageSize,
  };
}

export async function saveWrongQuestion(userId: string, question: QuestionDoc) {
  await setDoc(
    doc(db, "users", userId, "mistake_book", question.id ?? question.question.slice(0, 100)),
    {
      ...question,
      savedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function bookmarkQuestion(userId: string, question: QuestionDoc) {
  await setDoc(
    doc(db, "users", userId, "saved_questions", question.id ?? question.question.slice(0, 100)),
    {
      ...question,
      savedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenToUserQuestionCollection(
  userId: string,
  collectionName: "mistake_book" | "saved_questions",
  onData: (rows: SavedQuestionDoc[]) => void,
) {
  const questionsRef = collection(db, "users", userId, collectionName);
  const questionsQuery = query(questionsRef, orderBy("savedAt", "desc"));

  return onSnapshot(questionsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as SavedQuestionDoc[];

    onData(rows);
  });
}

type SaveTestAttemptInput = {
  userId: string;
  userEmail?: string;
  userDisplayName?: string;
  totalQuestions: number;
  correctAnswers: number;
  timeTakenSec: number;
  filters: TestFilters;
  weakChapters: string[];
  topicPerformance: Record<string, TopicPerformance>;
  adaptiveDifficulty?: "easy" | "medium" | "hard";
  difficultyInsights?: QuestionDifficultyInsight[];
  mistakeAnalysis?: MistakeAnalysis;
  testSecurity?: TestSecuritySnapshot;
};

export async function saveTestAttempt(input: SaveTestAttemptInput) {
  const accuracy = input.totalQuestions
    ? Math.round((input.correctAnswers / input.totalQuestions) * 100)
    : 0;

  const xpEarned = Math.max(8, Math.round(input.correctAnswers * 3 + accuracy * 0.6));

  await addDoc(collection(db, "users", input.userId, "test_history"), {
    totalQuestions: input.totalQuestions,
    correctAnswers: input.correctAnswers,
    accuracy,
    timeTakenSec: input.timeTakenSec,
    filters: input.filters,
    weakChapters: input.weakChapters,
    topicPerformance: input.topicPerformance,
    adaptiveDifficulty: input.adaptiveDifficulty ?? null,
    difficultyInsights: input.difficultyInsights ?? [],
    mistakeAnalysis: input.mistakeAnalysis ?? null,
    testSecurity: input.testSecurity ?? null,
    xpEarned,
    createdAt: serverTimestamp(),
  });

  await syncLeaderboardAfterAttempt({
    userId: input.userId,
    email: input.userEmail,
    displayName: input.userDisplayName,
    xpEarned,
    subject: input.filters.subject,
  });
}

export function listenToUserTestHistory(userId: string, onData: (rows: TestAttemptDoc[]) => void, maxRows = 30) {
  const historyRef = collection(db, "users", userId, "test_history");
  const historyQuery = query(historyRef, orderBy("createdAt", "desc"), limit(maxRows));

  return onSnapshot(historyQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as TestAttemptDoc[];

    onData(rows);
  });
}

export function listenToLeaderboard(onData: (rows: LeaderboardDoc[]) => void) {
  const leaderboardQuery = query(collection(db, "leaderboard_public"), orderBy("allTimeXP", "desc"), limit(120));
  return onSnapshot(leaderboardQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as LeaderboardDoc[];
    onData(rows);
  });
}
