import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listenToQuestionDiscussion, postQuestionDiscussion, type DiscussionMessage } from "../services/discussionService";

type QuestionDiscussionProps = {
  threadId: string;
};

export function QuestionDiscussion({ threadId }: QuestionDiscussionProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<DiscussionMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsubscribe = listenToQuestionDiscussion(threadId, setRows);
    return () => unsubscribe();
  }, [threadId]);

  const latest = useMemo(() => rows.slice(-5), [rows]);

  async function onSend() {
    if (!user || !text.trim()) {
      return;
    }

    setSending(true);
    try {
      await postQuestionDiscussion({
        threadId,
        text,
        userId: user.uid,
        userEmail: user.email ?? "",
        userName: user.displayName ?? "Student",
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Discussion</p>
      <div className="mt-2 space-y-2">
        {latest.length ? (
          latest.map((row) => (
            <div key={row.id} className="rounded-xl bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800">
              <p className="font-semibold text-zinc-700 dark:text-zinc-200">{row.userName}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{row.text}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">No discussion yet.</p>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="input-soft flex-1"
          placeholder="Ask doubt or share shortcut"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="btn-pill-ghost px-3 py-2 text-xs" type="button" onClick={onSend} disabled={sending || !text.trim()}>
          {sending ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}