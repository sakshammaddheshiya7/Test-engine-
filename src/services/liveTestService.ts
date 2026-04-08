import {
  Timestamp,
  addDoc,
  collection,
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
import { generateCustomTest, type QuestionDoc, type TestFilters } from "./questionService";

export type LiveTestDoc = {
  id: string;
  title: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: "" | "easy" | "medium" | "hard";
  type: "" | "PYQ" | "Normal";
  numberOfQuestions: number;
  durationMinutes: number;
  startAt?: { seconds: number };
  endAt?: { seconds: number };
  createdAt?: { seconds: number };
};

export type LiveTestAttempt = {
  id: string;
  userId: string;
  userName: string;
  score: number;
  accuracy: number;
  submittedAt?: { seconds: number };
  timeTakenSec: number;
};

export async function createLiveTest(input: Omit<LiveTestDoc, "id" | "createdAt">) {
  const startDate = new Date((input.startAt?.seconds ?? Math.floor(Date.now() / 1000)) * 1000);
  const endDate = new Date((input.endAt?.seconds ?? Math.floor(Date.now() / 1000 + input.durationMinutes * 60)) * 1000);

  await addDoc(collection(db, "live_tests"), {
    ...input,
    startAt: Timestamp.fromDate(startDate),
    endAt: Timestamp.fromDate(endDate),
    createdAt: serverTimestamp(),
  });
}

export function listenToLiveTests(onData: (rows: LiveTestDoc[]) => void) {
  const ref = query(collection(db, "live_tests"), orderBy("startAt", "desc"), limit(30));
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as LiveTestDoc[];
    onData(rows);
  });
}

export async function joinLiveTest(testId: string, input: { userId: string; userName: string; userEmail: string }) {
  await setDoc(
    doc(db, "live_tests", testId, "participants", input.userId),
    {
      ...input,
      joinedAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function listenToLiveParticipantCount(testId: string, onData: (count: number) => void) {
  const ref = collection(db, "live_tests", testId, "participants");
  return onSnapshot(ref, (snapshot) => onData(snapshot.size));
}

export async function submitLiveTestAttempt(testId: string, input: Omit<LiveTestAttempt, "id" | "submittedAt">) {
  await addDoc(collection(db, "live_tests", testId, "attempts"), {
    ...input,
    submittedAt: serverTimestamp(),
  });
}

export function listenToLiveLeaderboard(testId: string, onData: (rows: LiveTestAttempt[]) => void) {
  const ref = query(collection(db, "live_tests", testId, "attempts"), orderBy("accuracy", "desc"), limit(40));
  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as DocumentData),
    })) as LiveTestAttempt[];
    onData(rows);
  });
}

export async function loadQuestionsForLiveTest(test: LiveTestDoc): Promise<QuestionDoc[]> {
  const filters: TestFilters = {
    subject: test.subject,
    chapter: test.chapter,
    topic: test.topic,
    difficulty: test.difficulty,
    type: test.type,
    numberOfQuestions: test.numberOfQuestions,
  };

  return generateCustomTest(filters);
}