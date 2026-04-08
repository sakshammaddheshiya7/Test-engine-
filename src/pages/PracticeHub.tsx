import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookCopy, FolderTree, FlaskConical, GraduationCap } from "lucide-react";

const modules = [
  { title: "Subject Selector", desc: "Browse subjects and focused drills", to: "/chapter-practice", icon: GraduationCap },
  { title: "Chapter Explorer", desc: "Chapter-wise targeted practice", to: "/chapter-practice", icon: FolderTree },
  { title: "Topic Drill", desc: "Fast topic-level MCQ rounds", to: "/chapter-practice", icon: FlaskConical },
  { title: "PYQ Practice Mode", desc: "Year-tagged previous papers", to: "/pyq-practice", icon: BookCopy },
];

export default function PracticeHub() {
  const [activeModule, setActiveModule] = useState<(typeof modules)[number] | null>(null);

  return (
    <section className="space-y-4 py-2">
      <article className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Practice Hub</p>
        <h2 className="mt-1 text-xl font-semibold">
          <GraduationCap size={18} className="mr-1 inline text-orange-500" />
          Dedicated Practice Workspace
        </h2>
      </article>
      <div className="grid gap-3">
        {modules.map((item, index) => (
          <motion.button
            key={item.title}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * index, type: "spring", stiffness: 280, damping: 24 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveModule(item)}
            className="glass-panel rounded-[22px] p-4 text-left transition hover:-translate-y-0.5"
          >
            <item.icon size={16} className="text-orange-500" />
            <p className="mt-2 text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {activeModule ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 260, damping: 25 }}
              className="glass-panel w-full max-w-md rounded-[28px] p-5"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Practice Workspace</p>
              <div className="mt-2 flex items-center gap-2">
                <activeModule.icon size={18} className="text-orange-500" />
                <h3 className="text-lg font-semibold">{activeModule.title}</h3>
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{activeModule.desc}</p>
              <div className="mt-4 flex gap-2">
                <Link to={activeModule.to} className="btn-pill-primary px-4 py-2 text-xs" onClick={() => setActiveModule(null)}>
                  Open Module
                </Link>
                <button type="button" className="btn-pill-ghost px-4 py-2 text-xs" onClick={() => setActiveModule(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
