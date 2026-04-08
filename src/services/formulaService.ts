import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type FormulaDoc = {
  id: string;
  subject: string;
  chapter: string;
  concept: string;
  formula: string;
  trick?: string;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
};

export type FormulaInput = {
  subject: string;
  chapter: string;
  concept: string;
  formula: string;
  trick?: string;
};

export async function upsertFormula(input: FormulaInput, formulaId?: string) {
  const payload = {
    subject: input.subject.trim(),
    chapter: input.chapter.trim(),
    concept: input.concept.trim(),
    formula: input.formula.trim(),
    trick: input.trick?.trim() ?? "",
    updatedAt: serverTimestamp(),
  };

  if (formulaId?.trim()) {
    await setDoc(
      doc(db, "formulas", formulaId.trim()),
      {
        ...payload,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  await addDoc(collection(db, "formulas"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function deleteFormula(formulaId: string) {
  await deleteDoc(doc(db, "formulas", formulaId));
}

export function listenToFormulas(onData: (rows: FormulaDoc[]) => void) {
  const formulasQuery = query(collection(db, "formulas"), orderBy("updatedAt", "desc"), limit(800));
  return onSnapshot(formulasQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as FormulaDoc[];
    onData(rows);
  });
}