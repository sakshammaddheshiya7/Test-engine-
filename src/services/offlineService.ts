import type { QuestionDoc } from "./questionService";
import type { PdfLibraryItem } from "./pdfService";

const OFFLINE_TESTS_KEY = "rankforge_offline_tests";
const OFFLINE_PDFS_KEY = "rankforge_offline_pdfs";

export type OfflineQuestionPack = {
  id: string;
  title: string;
  createdAt: number;
  questions: QuestionDoc[];
};

export type OfflinePdfPack = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  category: string;
  fileUrl: string;
  createdAt: number;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getOfflineQuestionPacks() {
  return readJson<OfflineQuestionPack[]>(OFFLINE_TESTS_KEY, []);
}

export function getOfflineQuestionPackById(packId: string) {
  return getOfflineQuestionPacks().find((item) => item.id === packId) ?? null;
}

export function saveOfflineQuestionPack(title: string, questions: QuestionDoc[]) {
  const packs = getOfflineQuestionPacks();
  const next: OfflineQuestionPack = {
    id: `${Date.now()}`,
    title,
    createdAt: Date.now(),
    questions,
  };
  writeJson(OFFLINE_TESTS_KEY, [next, ...packs].slice(0, 40));
  return next;
}

export function deleteOfflineQuestionPack(packId: string) {
  const packs = getOfflineQuestionPacks().filter((item) => item.id !== packId);
  writeJson(OFFLINE_TESTS_KEY, packs);
}

export function getOfflinePdfPacks() {
  return readJson<OfflinePdfPack[]>(OFFLINE_PDFS_KEY, []);
}

export async function saveOfflinePdfPack(item: PdfLibraryItem) {
  const packs = getOfflinePdfPacks();
  const next: OfflinePdfPack = {
    id: item.id,
    title: item.title,
    subject: item.subject,
    chapter: item.chapter,
    category: item.category,
    fileUrl: item.fileUrl,
    createdAt: Date.now(),
  };
  writeJson(
    OFFLINE_PDFS_KEY,
    [next, ...packs.filter((pack) => pack.id !== item.id)].slice(0, 120),
  );

  try {
    await fetch(item.fileUrl, { mode: "no-cors" });
  } catch {
    // Ignore warm-cache failures. Metadata is still available offline.
  }

  return next;
}

export function deleteOfflinePdfPack(packId: string) {
  const packs = getOfflinePdfPacks().filter((item) => item.id !== packId);
  writeJson(OFFLINE_PDFS_KEY, packs);
}
