import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase/firebaseConfig";

export type PdfCategory = "short_notes" | "formula_sheet" | "pyq_collection";

export type PdfLibraryItem = {
  id: string;
  subject: string;
  chapter: string;
  title: string;
  category: PdfCategory;
  fileUrl: string;
  storagePath: string;
  contentKey?: string;
  version?: number;
};

export type ContentVersionItem = {
  id: string;
  subject: string;
  chapter: string;
  title: string;
  category: PdfCategory;
  latestVersion: number;
  uploadsCount: number;
};

type UploadPdfPayload = {
  subject: string;
  chapter: string;
  title: string;
  category: PdfCategory;
  file: File;
};

function sanitizeSegment(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
}

function buildContentKey(subject: string, chapter: string, title: string, category: PdfCategory) {
  return `${sanitizeSegment(subject)}__${sanitizeSegment(chapter)}__${sanitizeSegment(title)}__${category}`;
}

export async function uploadPdfResource(payload: UploadPdfPayload) {
  const contentKey = buildContentKey(payload.subject, payload.chapter, payload.title, payload.category);
  const versionRef = doc(db, "content_versions", `pdf_${contentKey}`);
  const existingVersion = await getDoc(versionRef);
  const nextVersion = (existingVersion.data()?.version as number | undefined ?? 0) + 1;

  const fileName = `${Date.now()}-${sanitizeSegment(payload.file.name) || "resource"}.pdf`;
  const subjectSegment = sanitizeSegment(payload.subject) || "general";
  const chapterSegment = sanitizeSegment(payload.chapter) || "general";
  const storagePath = `pdf_library/${subjectSegment}/${chapterSegment}/${fileName}`;

  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, payload.file, { contentType: payload.file.type || "application/pdf" });
  const fileUrl = await getDownloadURL(fileRef);

  const inserted = await addDoc(collection(db, "pdf_library"), {
    subject: payload.subject.trim(),
    chapter: payload.chapter.trim(),
    title: payload.title.trim(),
    category: payload.category,
    fileUrl,
    storagePath,
    contentKey,
    version: nextVersion,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    versionRef,
    {
      type: "pdf",
      contentKey,
      subject: payload.subject.trim(),
      chapter: payload.chapter.trim(),
      title: payload.title.trim(),
      category: payload.category,
      latestVersion: nextVersion,
      latestPdfId: inserted.id,
      uploadsCount: increment(1),
      updatedAt: serverTimestamp(),
      createdAt: existingVersion.exists() ? existingVersion.data()?.createdAt : serverTimestamp(),
    },
    { merge: true },
  );

  return {
    pdfId: inserted.id,
    version: nextVersion,
    contentKey,
  };
}

export function listenToPdfLibrary(onData: (items: PdfLibraryItem[]) => void) {
  const q = query(collection(db, "pdf_library"), orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    })) as PdfLibraryItem[];
    onData(rows);
  });
}

export function listenToPdfVersions(onData: (items: ContentVersionItem[]) => void) {
  const q = query(collection(db, "content_versions"), orderBy("updatedAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs
      .map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      })) as Array<ContentVersionItem & { type?: string }>;
    const filtered = rows.filter((row) => row.type === "pdf");
    onData(filtered);
  });
}