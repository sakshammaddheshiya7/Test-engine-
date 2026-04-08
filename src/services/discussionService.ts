import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { QuestionDoc } from "./questionService";

export type DiscussionMessage = {
  id: string;
  text: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt?: { seconds: number };
};

export type DiscussionModerationRow = DiscussionMessage & {
  threadId: string;
};

export function getQuestionThreadId(question: Pick<QuestionDoc, "id" | "subject" | "chapter" | "topic" | "question">) {
  if (question.id?.trim()) {
    return `q_${question.id.trim()}`;
  }

  const raw = `${question.subject}__${question.chapter}__${question.topic}__${question.question.slice(0, 80)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `q_${raw.slice(0, 160)}`;
}

export function listenToQuestionDiscussion(threadId: string, onData: (rows: DiscussionMessage[]) => void) {
  const ref = query(
    collection(db, "question_discussions", threadId, "messages"),
    orderBy("createdAt", "asc"),
    limit(80),
  );

  return onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<DiscussionMessage, "id">),
    }));
    onData(rows);
  });
}

export async function postQuestionDiscussion(input: {
  threadId: string;
  text: string;
  userId: string;
  userEmail?: string;
  userName?: string;
}) {
  await addDoc(collection(db, "question_discussions", input.threadId, "messages"), {
    text: input.text.trim(),
    userId: input.userId,
    userEmail: input.userEmail ?? "",
    userName: input.userName ?? "Student",
    createdAt: serverTimestamp(),
  });
}

export function listenRecentDiscussionMessages(onData: (rows: DiscussionModerationRow[]) => void) {
  const feedQuery = query(collectionGroup(db, "messages"), orderBy("createdAt", "desc"), limit(220));

  return onSnapshot(feedQuery, (snapshot) => {
    const rows = snapshot.docs
      .map((docItem) => {
        const parentThread = docItem.ref.parent.parent;
        if (!parentThread || parentThread.parent.id !== "question_discussions") {
          return null;
        }
        return {
          id: docItem.id,
          threadId: parentThread.id,
          ...(docItem.data() as Omit<DiscussionMessage, "id">),
        } satisfies DiscussionModerationRow;
      })
      .filter((row): row is DiscussionModerationRow => Boolean(row));
    onData(rows);
  });
}

export async function deleteDiscussionMessage(threadId: string, messageId: string) {
  await deleteDoc(doc(db, "question_discussions", threadId, "messages", messageId));
}