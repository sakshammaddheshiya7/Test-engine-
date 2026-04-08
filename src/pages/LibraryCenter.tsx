import { Link } from "react-router-dom";
import { BookOpenText, FileStack, Library, Sigma } from "lucide-react";

const items = [
  { title: "PDF Library", to: "/pdf-library", icon: Library },
  { title: "Short Notes", to: "/knowledge-base", icon: BookOpenText },
  { title: "Formula Bank", to: "/formula-bank", icon: Sigma },
  { title: "PYQ Archives", to: "/pyq-practice", icon: FileStack },
];

export default function LibraryCenter() {
  return (
    <section className="space-y-4 py-2">
      <article className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Resource Library</p>
        <h2 className="mt-1 text-xl font-semibold">
          <Library size={18} className="mr-1 inline text-orange-500" />
          Structured Knowledge Area
        </h2>
      </article>
      <div className="grid gap-3">
        {items.map((item) => (
          <Link key={item.title} to={item.to} className="glass-panel rounded-[22px] p-4 transition hover:-translate-y-0.5">
            <item.icon size={16} className="text-orange-500" />
            <p className="mt-2 text-sm font-semibold">{item.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
