import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import {
  listenSupportMessages,
  sendStudentSupportMessageWithBot,
  type SupportMessageDoc,
} from "../services/adminCommandService";

export default function SupportCenter() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessageDoc[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    return listenSupportMessages(user.uid, setMessages);
  }, [user]);

  async function onSend() {
    if (!user || !input.trim()) {
      return;
    }

    setSending(true);
    setStatus("");
    try {
      await sendStudentSupportMessageWithBot({
        threadId: user.uid,
        userId: user.uid,
        userEmail: user.email ?? "",
        text: input,
      });
      setInput("");
      setStatus("Message sent. AI support bot and admin team can respond here.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Support message failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Help Center</p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Live Support</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Send doubts, bug reports, or account issues. AI support bot responds first, then admin can continue.</p>
      </motion.div>

      <div className="glass-panel rounded-[26px] p-4">
        <div className="max-h-[48dvh] space-y-2 overflow-y-auto pr-1">
          {messages.map((row) => (
            <div
              key={row.id}
              className={`rounded-2xl border p-3 text-sm ${
                row.senderRole === "student"
                  ? "border-orange-200 bg-orange-50/90 dark:border-orange-500/40 dark:bg-orange-500/10"
                  : row.senderRole === "bot"
                    ? "border-sky-200 bg-sky-50/90 dark:border-sky-500/40 dark:bg-sky-500/10"
                    : "border-zinc-200 bg-white/90 dark:border-zinc-700 dark:bg-zinc-900/70"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{row.senderRole}</p>
              <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-100">{row.text}</p>
            </div>
          ))}
          {!messages.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No messages yet. Start a support chat.</p> : null}
        </div>

        <textarea
          className="input-soft mt-3 min-h-24"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Describe your issue or doubt..."
        />
        <button type="button" className="btn-pill-primary mt-2 px-4 py-2 text-xs" onClick={onSend} disabled={sending || !input.trim()}>
          {sending ? "Sending..." : "Send Message"}
        </button>
        {status ? <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{status}</p> : null}
      </div>
    </section>
  );
}