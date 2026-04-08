import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import { createLiveTest, listenToLiveParticipantCount, listenToLiveTests, type LiveTestDoc } from "../services/liveTestService";

type LiveForm = {
  title: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: "" | "easy" | "medium" | "hard";
  type: "" | "PYQ" | "Normal";
  numberOfQuestions: number;
  durationMinutes: number;
  startAtISO: string;
};

const defaultForm: LiveForm = {
  title: "Scheduled Test",
  subject: "",
  chapter: "",
  topic: "",
  difficulty: "",
  type: "",
  numberOfQuestions: 30,
  durationMinutes: 45,
  startAtISO: "",
};

function testStatus(item: LiveTestDoc) {
  const now = Date.now();
  const start = (item.startAt?.seconds ?? 0) * 1000;
  const end = (item.endAt?.seconds ?? 0) * 1000;
  if (now < start) return "Upcoming";
  if (now > end) return "Completed";
  return "Live";
}

export default function AdminLiveTests() {
  const [form, setForm] = useState<LiveForm>(defaultForm);
  const [tests, setTests] = useState<LiveTestDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [participantMap, setParticipantMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = listenToLiveTests(setTests);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubs = tests.slice(0, 8).map((item) =>
      listenToLiveParticipantCount(item.id, (count) => {
        setParticipantMap((prev) => ({ ...prev, [item.id]: count }));
      }),
    );
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [tests]);

  const sorted = useMemo(() => tests.slice().sort((a, b) => (b.startAt?.seconds ?? 0) - (a.startAt?.seconds ?? 0)), [tests]);

  async function onCreate() {
    if (!form.title.trim() || !form.subject.trim() || !form.startAtISO) {
      setMessage("Enter title, subject and start time.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const startDate = new Date(form.startAtISO);
      const endDate = new Date(startDate.getTime() + Math.max(1, form.durationMinutes) * 60_000);
      await createLiveTest({
        title: form.title.trim(),
        subject: form.subject.trim(),
        chapter: form.chapter.trim(),
        topic: form.topic.trim(),
        difficulty: form.difficulty,
        type: form.type,
        numberOfQuestions: Math.max(5, form.numberOfQuestions),
        durationMinutes: Math.max(5, form.durationMinutes),
        startAt: { seconds: Math.floor(startDate.getTime() / 1000) },
        endAt: { seconds: Math.floor(endDate.getTime() / 1000) },
      });
      await addAdminAuditLog("live_test_created", `${form.title} (${form.subject})`);
      setMessage("Scheduled live test created.");
      setForm(defaultForm);
    } catch {
      setMessage("Failed to create live test.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 34</p>
        <h2 className="mt-1 text-2xl font-semibold">Live Test Scheduler</h2>
        <p className="mt-1 text-sm text-zinc-300">Create timed tests with participant tracking and live leaderboard.</p>
      </motion.div>

      <div className="admin-surface space-y-3 p-4">
        <input className="input-soft" placeholder="Test title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input-soft" placeholder="Subject" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
          <input className="input-soft" placeholder="Chapter (optional)" value={form.chapter} onChange={(e) => setForm((p) => ({ ...p, chapter: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input-soft" placeholder="Topic (optional)" value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} />
          <input className="input-soft" type="datetime-local" value={form.startAtISO} onChange={(e) => setForm((p) => ({ ...p, startAtISO: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className="input-soft" value={form.difficulty} onChange={(e) => setForm((p) => ({ ...p, difficulty: e.target.value as LiveForm["difficulty"] }))}>
            <option value="">Any difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select className="input-soft" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as LiveForm["type"] }))}>
            <option value="">Any type</option>
            <option value="Normal">Normal</option>
            <option value="PYQ">PYQ</option>
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input-soft" type="number" min={5} max={180} value={form.numberOfQuestions} onChange={(e) => setForm((p) => ({ ...p, numberOfQuestions: Number(e.target.value) }))} />
          <input className="input-soft" type="number" min={5} max={180} value={form.durationMinutes} onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))} />
        </div>
        <button className="btn-pill-primary w-full px-4 py-2 text-sm" type="button" onClick={onCreate} disabled={saving}>
          {saving ? "Creating..." : "Create Live Test"}
        </button>
        {message ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{message}</p> : null}
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Scheduled Tests</h3>
        <div className="mt-3 space-y-2">
          {sorted.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No scheduled tests yet.</p> : null}
          {sorted.map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.title}</p>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{testStatus(item)}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.subject} {item.chapter ? `| ${item.chapter}` : ""}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Participants: {participantMap[item.id] ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}