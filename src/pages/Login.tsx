import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { loginWithEmail, loginWithGoogle } from "../firebase/auth";
import { PRIMARY_ADMIN_EMAIL } from "../config/admin";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const titleTapCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const reduceMotion = useReducedMotion();
  const brandChars = "RankForge".split("");

  function onTitleTap() {
    const now = Date.now();
    const withinGestureWindow = now - lastTapAtRef.current < 1500;
    const nextCount = withinGestureWindow ? titleTapCountRef.current + 1 : 1;

    lastTapAtRef.current = now;
    titleTapCountRef.current = nextCount;

    if (nextCount >= 5) {
      setEmail(PRIMARY_ADMIN_EMAIL);
      passwordInputRef.current?.focus();
      titleTapCountRef.current = 0;
    }
  }

  async function onEmailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const safeEmail = email.trim();
      if (!safeEmail || !password) {
        throw new Error("Please enter email and password.");
      }

      await loginWithEmail(safeEmail, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleLogin() {
    setError("");
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-cinematic relative mx-auto flex min-h-[80dvh] max-w-lg flex-col items-center justify-center overflow-hidden py-10">
      <div className="login-wave login-wave-a" />
      <div className="login-wave login-wave-b" />
      <div className="pointer-events-none absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-300/50 blur-3xl" />
      {Array.from({ length: 8 }).map((_, index) => (
        <motion.span
          key={`particle-${index}`}
          className="login-particle"
          style={{ left: `${12 + index * 11}%`, top: `${20 + (index % 3) * 20}%` }}
          animate={
            reduceMotion
              ? { opacity: 0.25 }
              : {
                  y: [0, -8, 0],
                  opacity: [0.2, 0.5, 0.2],
                }
          }
          transition={{ duration: 3 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <motion.div
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98, filter: "blur(4px)" }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45 }}
        className="w-full rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(251,146,60,0.2)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 sm:p-8"
      >
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500"
        >
          Premium Prep Platform
        </motion.p>
        <h2 className="mt-2 cursor-default text-3xl font-semibold tracking-tight text-zinc-900 select-none dark:text-zinc-100">
          {brandChars.map((char, index) => (
            <motion.span
              key={`${char}-${index}`}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + index * 0.015 }}
              className={char === " " ? "inline-block w-2" : "inline-block"}
            >
              {char}
            </motion.span>
          ))}
          <span className="inline-block w-2" />
          <motion.span
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="inline-block cursor-pointer"
            onClick={onTitleTap}
          >
            Login
          </motion.span>
        </h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-2 text-sm text-zinc-600 dark:text-zinc-300"
        >
          Continue with email or Google to access your test-ready dashboard.
        </motion.p>

        <form className="mt-6 space-y-3" onSubmit={onEmailLogin}>
          <motion.input
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm outline-none ring-orange-400 transition focus:ring dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={email}
            disabled={loading}
          />
          <motion.div className="relative" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <input
              ref={passwordInputRef}
              className="w-full rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 pr-20 text-sm outline-none ring-orange-400 transition focus:ring dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type={showPassword ? "text" : "password"}
              value={password}
              disabled={loading}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-200"
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </motion.div>

          <motion.button
            whileTap={{ scale: 0.96 }}
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"
            disabled={loading}
            type="submit"
          >
            {loading ? "Please wait..." : "Login with Email"}
          </motion.button>
        </form>

        <button
          className="mt-3 w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={loading}
          onClick={onGoogleLogin}
          type="button"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-center text-xs text-zinc-600 dark:text-zinc-300">
          New student?{" "}
          <Link className="font-semibold text-zinc-900 underline dark:text-zinc-100" to="/register">
            Create account
          </Link>
        </p>

        {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
        {error ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            If this is first setup, enable Email/Password and Google providers in Firebase Authentication.
          </p>
        ) : null}
      </motion.div>
    </section>
  );
}
