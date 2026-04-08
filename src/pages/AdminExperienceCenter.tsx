import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import { generatePdfSummary } from "../services/aiService";
import {
  listenAllFeedback,
  listenKnowledgeArticles,
  listenUsagePolicy,
  saveKnowledgeArticle,
  saveUsagePolicy,
  updateFeedbackStatus,
  type FeedbackDoc,
  type KnowledgeArticle,
  type UsagePolicy,
} from "../services/experienceService";

const defaultPolicy: UsagePolicy = {
  dailyAiMessages: 30,
  dailyPdfDownloads: 20,
  dailyTestAttempts: 12,
  premiumModeEnabled: false,
};

export default function AdminExperienceCenter() {
  const [feedbackRows, setFeedbackRows] = useState<FeedbackDoc[]>([]);
  const [knowledgeRows, setKnowledgeRows] = useState<KnowledgeArticle[]>([]);
  const [policy, setPolicy] = useState<UsagePolicy>(defaultPolicy);
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [articleTags, setArticleTags] = useState("");
  const [articleStatus, setArticleStatus] = useState<"draft" | "published">("published");

  useEffect(() => {
    const offFeedback = listenAllFeedback(setFeedbackRows);
    const offKnowledge = listenKnowledgeArticles(true, setKnowledgeRows);
    const offPolicy = listenUsagePolicy(setPolicy);
    return () => {
      offFeedback();
      offKnowledge();
      offPolicy();
    };
  }, []);

  const feedbackPrompt = useMemo(
    () =>
      feedbackRows
        .slice(0, 80)
        .map((row) => `[${row.category}] (${row.status}) ${row.message}`)
        .join("\n"),
    [feedbackRows],
  );

  async function runAction(action: () => Promise<void>, okText: string) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      setStatus(okText);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">Extended Admin Ops</p>
        <h2 className="mt-2 text-2xl font-semibold">Experience Control Center</h2>
        <p className="mt-2 text-sm text-zinc-300">Feedback pipeline, AI feedback analysis, knowledge-base publishing and usage limit management.</p>
      </motion.div>

      {status ? <div className="admin-surface p-3 text-sm text-zinc-700 dark:text-zinc-200">{status}</div> : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">User Feedback Collection + AI Feedback Analysis</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2"
            disabled={busy || !feedbackPrompt.trim()}
            onClick={() => {
              void runAction(async () => {
                const report = await generatePdfSummary("openrouter", "deepseek/deepseek-r1-0528:free", `Summarize key user issues and top actions:\n${feedbackPrompt}`);
                setSummary(report);
                await addAdminAuditLog("feedback_ai_summary", "AI feedback analysis generated.");
              }, "AI summary generated.");
            }}
          >
            Generate AI Feedback Summary
          </button>
        </div>
        {summary ? <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/70">{summary}</pre> : null}
        <div className="mt-3 space-y-2">
          {feedbackRows.slice(0, 10).map((row) => (
            <div key={row.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">[{row.category}] {row.userEmail || row.userId}</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{row.message}</p>
              <div className="mt-2 flex gap-2">
                {(["open", "reviewing", "resolved"] as const).map((state) => (
                  <button
                    key={`${row.id}-${state}`}
                    type="button"
                    className="btn-pill-ghost px-3 py-1 text-[11px]"
                    disabled={busy || row.status === state}
                    onClick={() => {
                      void runAction(async () => {
                        await updateFeedbackStatus(row.id, state);
                        await addAdminAuditLog("feedback_status", `Feedback ${row.id} marked ${state}.`);
                      }, "Feedback status updated.");
                    }}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Base Management</h3>
        <input className="input-soft mt-3" value={articleTitle} onChange={(event) => setArticleTitle(event.target.value)} placeholder="Article title" />
        <textarea className="input-soft mt-2 min-h-28" value={articleBody} onChange={(event) => setArticleBody(event.target.value)} placeholder="Article body" />
        <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_170px]">
          <input className="input-soft" value={articleTags} onChange={(event) => setArticleTags(event.target.value)} placeholder="tags comma separated" />
          <select className="input-soft" value={articleStatus} onChange={(event) => setArticleStatus(event.target.value as "draft" | "published")}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        <button
          type="button"
          className="btn-pill-primary mt-2 px-4 py-2 text-xs"
          disabled={busy || !articleTitle.trim() || !articleBody.trim()}
          onClick={() => {
            void runAction(async () => {
              await saveKnowledgeArticle({
                title: articleTitle.trim(),
                body: articleBody.trim(),
                tags: articleTags
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                status: articleStatus,
              });
              setArticleTitle("");
              setArticleBody("");
              setArticleTags("");
              await addAdminAuditLog("knowledge_article_upsert", "Knowledge base article saved.");
            }, "Article saved.");
          }}
        >
          Save Article
        </button>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">Total articles: {knowledgeRows.length}</p>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Usage Limit Management</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            className="input-soft"
            type="number"
            min={1}
            value={policy.dailyTestAttempts}
            onChange={(event) => setPolicy((prev) => ({ ...prev, dailyTestAttempts: Number(event.target.value || 1) }))}
            placeholder="Daily test attempts"
          />
          <input
            className="input-soft"
            type="number"
            min={1}
            value={policy.dailyAiMessages}
            onChange={(event) => setPolicy((prev) => ({ ...prev, dailyAiMessages: Number(event.target.value || 1) }))}
            placeholder="Daily AI messages"
          />
          <input
            className="input-soft"
            type="number"
            min={1}
            value={policy.dailyPdfDownloads}
            onChange={(event) => setPolicy((prev) => ({ ...prev, dailyPdfDownloads: Number(event.target.value || 1) }))}
            placeholder="Daily PDF downloads"
          />
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={policy.premiumModeEnabled}
            onChange={(event) => setPolicy((prev) => ({ ...prev, premiumModeEnabled: event.target.checked }))}
          />
          Enable premium-mode flag for future paid access
        </label>
        <button
          type="button"
          className="btn-pill-dark mt-2 px-4 py-2 text-xs"
          disabled={busy}
          onClick={() => {
            void runAction(async () => {
              await saveUsagePolicy(policy);
              await addAdminAuditLog("usage_policy_update", "Daily usage limits updated.");
            }, "Usage policy updated.");
          }}
        >
          Save Usage Policy
        </button>
      </div>
    </section>
  );
}
