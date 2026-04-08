import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, BookOpen, CircleUserRound, ClipboardCheck, House, Layers } from "lucide-react";

export function BottomNavigation() {
  const baseClass =
    "min-h-10 rounded-full px-2 py-1.5 text-[10px] font-semibold transition-all duration-200 active:scale-95 flex items-center gap-1";

  return (
    <motion.nav
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-1rem)] max-w-[430px] justify-center rounded-full border border-zinc-700/80 bg-zinc-900/92 p-1.5 shadow-[0_22px_55px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.1)] backdrop-blur-xl"
    >
      <div className="flex w-full items-center justify-around">
        <NavLink
          className={({ isActive }) =>
            `${baseClass} ${isActive ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-900/30" : "text-zinc-300"}`
          }
          to="/"
          end
        >
          <House size={14} />
          Home
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `${baseClass} ${isActive ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-900/30" : "text-zinc-300"}`
          }
          to="/practice"
        >
          <Layers size={14} />
          Practice
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `${baseClass} ${isActive ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-900/30" : "text-zinc-300"}`
          }
          to="/tests"
        >
          <ClipboardCheck size={14} />
          Tests
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `${baseClass} ${isActive ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-900/30" : "text-zinc-300"}`
          }
          to="/ai-assist"
        >
          <Bot size={14} />
          AI
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `${baseClass} ${isActive ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-900/30" : "text-zinc-300"}`
          }
          to="/library"
        >
          <BookOpen size={14} />
          Library
        </NavLink>
        <NavLink
          className={({ isActive }) =>
            `${baseClass} ${isActive ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-900/30" : "text-zinc-300"}`
          }
          to="/profile"
        >
          <CircleUserRound size={14} />
          Profile
        </NavLink>
      </div>
    </motion.nav>
  );
}
