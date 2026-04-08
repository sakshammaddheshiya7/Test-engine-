import { Link } from "react-router-dom";
import { BookMarked, BookOpenCheck, BrainCircuit, RotateCcw } from "lucide-react";

const items = [
  { title: "Mistake Book", desc: "Revisit wrong attempts with solutions", to: "/mistake-book", icon: RotateCcw },
  { title: "Saved Questions", desc: "Bookmarks synced for quick revision", to: "/saved-questions", icon: BookMarked },
  { title: "Flashcards", desc: "Swipe-style spaced revision cards", to: "/flashcards", icon: BrainCircuit },
  { title: "Revision Booster", desc: "Weak-topic focused practice sets", to: "/revision-booster", icon: BookOpenCheck },
];

export default function RevisionZone() {
  return (
    <section className="space-y-4 py-2">
      <article className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Revision Zone</p>
        <h2 className="mt-1 text-xl font-semibold">
          <RotateCcw size={18} className="mr-1 inline text-orange-500" />
          Focused Retention Workspace
        </h2>
      </article>
      <div className="grid gap-3">
        {items.map((item) => (
          <Link key={item.title} to={item.to} className="glass-panel rounded-[22px] p-4 transition hover:-translate-y-0.5 active:scale-[0.99]">
            <item.icon size={16} className="text-orange-500" />
            <p className="mt-2 text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
