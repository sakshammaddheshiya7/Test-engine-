import { Link } from "react-router-dom";
import { Bot, Brain, CalendarClock, Sparkles } from "lucide-react";

const tools = [
  { title: "AI Study Planner", to: "/study-planner", icon: CalendarClock },
  { title: "Deepu AI Doubt Solver", to: "/assistant", icon: Bot },
  { title: "AI Question Generator", to: "/custom-test", icon: Sparkles },
  { title: "Performance Predictor", to: "/analytics", icon: Brain },
];

export default function AIAssistCenter() {
  return (
    <section className="space-y-4 py-2">
      <article className="glass-panel rounded-[26px] p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-orange-500">AI Assist Center</p>
        <h2 className="mt-1 text-xl font-semibold">
          <Bot size={18} className="mr-1 inline text-orange-500" />
          Dedicated AI Workspaces
        </h2>
      </article>
      <div className="grid gap-3">
        {tools.map((tool) => (
          <Link key={tool.title} to={tool.to} className="glass-panel rounded-[22px] p-4 transition hover:-translate-y-0.5">
            <tool.icon size={16} className="text-orange-500" />
            <p className="mt-2 text-sm font-semibold">{tool.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
