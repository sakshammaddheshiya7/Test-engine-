import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { loginWithGoogle, registerWithEmail } from "../firebase/auth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const safeEmail = email.trim();

      if (!safeEmail || !password) {
        throw new Error("Please enter email and password.");
      }

      if (password !== confirmPassword) {
        throw new Error("Password and confirm password do not match.");
      }

      await registerWithEmail(safeEmail, password);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleRegister() {
    setError("");
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Google signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative mx-auto flex min-h-[80dvh] max-w-lg flex-col items-center justify-center overflow-hidden py-10">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-300/50 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(251,146,60,0.2)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80 sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Create Student Account</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">RankForge Signup</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Create your profile to start NEET/JEE practice and analytics tracking.</p>

        <form className="mt-6 space-y-3" onSubmit={onRegister}>
          <input
            className="w-full rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 text-sm outline-none ring-orange-400 transition focus:ring dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={email}
            disabled={loading}
          />
          <div className="relative">
            <input
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
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="relative">
            <input
              className="w-full rounded-2xl border border-zinc-200 bg-white/80 px-4 py-3 pr-20 text-sm outline-none ring-orange-400 transition focus:ring dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm Password"
              required
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              disabled={loading}
            />
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-600 dark:border-zinc-700 dark:text-zinc-200"
              type="button"
              onClick={() => setShowConfirmPassword((previous) => !previous)}
            >
              {showConfirmPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            className="w-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5"
            disabled={loading}
            type="submit"
          >
            {loading ? "Please wait..." : "Create Account"}
          </button>
        </form>

        <button
          className="mt-3 w-full rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:-translate-y-0.5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          disabled={loading}
          onClick={onGoogleRegister}
          type="button"
        >
          Signup with Google
        </button>

        <p className="mt-4 text-center text-xs text-zinc-600 dark:text-zinc-300">
          Already have an account?{" "}
          <Link className="font-semibold text-zinc-900 underline dark:text-zinc-100" to="/login">
            Login
          </Link>
        </p>

        {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}
      </motion.div>
    </section>
  );
}
