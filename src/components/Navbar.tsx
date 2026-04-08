import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, CircleUserRound, Sparkles } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { logout } from "../firebase/auth";
import { useTheme } from "../hooks/useTheme";

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const secretTapRef = useRef({ count: 0, startedAt: 0 });
  const [menuOpen, setMenuOpen] = useState(false);

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path === "/") return "Home";
    if (path.startsWith("/practice")) return "Practice Hub";
    if (path.startsWith("/tests")) return "Test Center";
    if (path.startsWith("/ai-assist")) return "AI Assist";
    if (path.startsWith("/library")) return "Resource Library";
    if (path.startsWith("/revision")) return "Revision Zone";
    if (path.startsWith("/profile")) return "Profile";
    if (path.startsWith("/admin")) return "Admin Control";
    return "RankForge";
  }, [location.pathname]);

  function onBrandTap() {
    if (!isAdmin) return;

    const now = Date.now();
    const tapWindowMs = 1200;
    const isSameWindow = now - secretTapRef.current.startedAt <= tapWindowMs;

    if (!isSameWindow) {
      secretTapRef.current = { count: 1, startedAt: now };
      return;
    }

    secretTapRef.current.count += 1;
    if (secretTapRef.current.count >= 5) {
      secretTapRef.current = { count: 0, startedAt: 0 };
      navigate("/admin");
    }
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="sticky top-2 z-30"
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between rounded-[22px] border border-white/70 bg-white/75 px-4 shadow-[0_14px_30px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl dark:border-zinc-700/80 dark:bg-zinc-950/65 dark:shadow-[0_16px_35px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-6">
        <button className="min-w-0 text-left" onClick={onBrandTap} type="button" aria-label="RankForge Prep">
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-500">Saksham Gupta</p>
          <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">RankForge Prep</h1>
        </button>
        <div className="flex max-w-[120px] items-center gap-1 rounded-full border border-zinc-200/80 bg-white/80 px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200 sm:max-w-none sm:px-3 sm:text-xs">
          <Sparkles size={13} className="text-orange-500" />
          <span className="truncate">{pageTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="grid min-h-10 min-w-10 place-items-center rounded-full border border-zinc-200/90 bg-white/90 text-zinc-700 transition hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </button>
          <button
            className="min-h-10 rounded-full border border-zinc-200/90 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:-translate-y-0.5 active:translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            onClick={toggleTheme}
            type="button"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="grid min-h-10 min-w-10 place-items-center rounded-full border border-zinc-200/90 bg-white/90 text-zinc-700 transition hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              aria-label="Profile menu"
            >
              <CircleUserRound size={17} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-12 w-48 rounded-2xl border border-zinc-200/80 bg-white/95 p-2 text-xs shadow-xl dark:border-zinc-700 dark:bg-zinc-900/95">
                <p className="truncate px-2 py-1 text-zinc-500 dark:text-zinc-300">{user?.email}</p>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-2 py-2 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Open Profile
                </Link>
                <button
                  onClick={() => logout()}
                  className="mt-1 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-2 py-2 font-semibold text-white"
                  type="button"
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
