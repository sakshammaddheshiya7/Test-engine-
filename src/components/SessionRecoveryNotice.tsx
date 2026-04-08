import { Link } from "react-router-dom";

type SessionRecoveryNoticeProps = {
  message: string;
};

export function SessionRecoveryNotice({ message }: SessionRecoveryNoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
      <p>{message}</p>
      <Link to="/login" className="mt-1 inline-block font-semibold underline">
        Open Login
      </Link>
    </div>
  );
}
