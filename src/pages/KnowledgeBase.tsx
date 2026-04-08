import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { listenKnowledgeArticles, type KnowledgeArticle } from "../services/experienceService";

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    return listenKnowledgeArticles(false, setArticles);
  }, []);

  const visible = articles.filter((item) => {
    const key = `${item.title} ${item.body} ${(item.tags ?? []).join(" ")}`.toLowerCase();
    return key.includes(query.toLowerCase());
  });

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-3d p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Base</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">FAQ, guidance, exam strategy, and help articles updated by admin.</p>
        <input
          className="input-soft mt-3"
          placeholder="Search article"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </motion.div>

      <div className="space-y-2">
        {visible.length === 0 ? <div className="panel-3d p-4 text-xs text-zinc-500 dark:text-zinc-400">No published article found.</div> : null}
        {visible.map((item) => (
          <article key={item.id} className="panel-3d p-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
            <p className="mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-200">{item.body}</p>
            {(item.tags ?? []).length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <span key={`${item.id}-${tag}`} className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
