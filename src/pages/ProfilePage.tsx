import { Link } from "react-router-dom";
import { Award, Flame, Gauge, Grid3X3, LineChart } from "lucide-react";

const modules = [
  { title: "Overall Performance Graph", to: "/analytics", icon: LineChart },
  { title: "Speed Statistics", to: "/analytics", icon: Gauge },
  { title: "Streak Tracker", to: "/leaderboard", icon: Flame },
  { title: "Progress Heatmap", to: "/analytics", icon: Grid3X3 },
  { title: "Achievements", to: "/leaderboard", icon: Award },
];

export default function ProfilePage() {
  return (
    <section className="space-y-4 py-2">
      <article className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-500">Profile & Analytics</p>
        <h2 className="mt-1 text-xl font-semibold">
          <LineChart size={18} className="mr-1 inline text-orange-500" />
          Personal Growth Dashboard
        </h2>
      </article>
      <div className="grid gap-3">
        {modules.map((module) => (
          <Link key={module.title} to={module.to} className="glass-panel rounded-[22px] p-4 transition hover:-translate-y-0.5">
            <module.icon size={16} className="text-orange-500" />
            <p className="mt-2 text-sm font-semibold">{module.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
