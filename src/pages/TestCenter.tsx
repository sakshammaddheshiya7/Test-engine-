import { Link } from "react-router-dom";
import { BarChart3, ClipboardCheck, History, RadioTower } from "lucide-react";

const items = [
  { title: "Custom Test Generator", to: "/custom-test", icon: ClipboardCheck },
  { title: "Live Test Mode", to: "/live-test", icon: RadioTower },
  { title: "Previous Tests", to: "/test-history", icon: History },
  { title: "Performance Insights", to: "/analytics", icon: BarChart3 },
];

export default function TestCenter() {
  return (
    <section className="space-y-4 py-2">
      <article className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Test Center</p>
        <h2 className="mt-1 text-xl font-semibold">
          <ClipboardCheck size={18} className="mr-1 inline text-orange-500" />
          Distraction-Free Test Environment
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
