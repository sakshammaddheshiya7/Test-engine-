import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import {
  generateDailyAdminReport,
  listenAccessPolicy,
  listenDailyAdminReports,
  listenUserSessions,
  revokeUserSession,
  saveAccessPolicy,
  type AccessPolicy,
  type DailyAdminReport,
  type UserSessionDoc,
} from "../services/adminSecurityService";

const emptyPolicy: AccessPolicy = {
  enforce: false,
  blockedIps: [],
  allowedIps: [],
  blockedCountries: [],
};

function listToText(value: string[]) {
  return value.join("\n");
}

function textToList(value: string) {
  return Array.from(new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)));
}

export default function AdminSecurityOps() {
  const [sessions, setSessions] = useState<UserSessionDoc[]>([]);
  const [reports, setReports] = useState<DailyAdminReport[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [enforce, setEnforce] = useState(false);
  const [blockedIpsText, setBlockedIpsText] = useState("");
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [blockedCountriesText, setBlockedCountriesText] = useState("");

  useEffect(() => {
    const offPolicy = listenAccessPolicy((policy) => {
      setEnforce(policy.enforce);
      setBlockedIpsText(listToText(policy.blockedIps));
      setAllowedIpsText(listToText(policy.allowedIps));
      setBlockedCountriesText(listToText(policy.blockedCountries));
    });
    const offSessions = listenUserSessions(setSessions);
    const offReports = listenDailyAdminReports(setReports);

    return () => {
      offPolicy();
      offSessions();
      offReports();
    };
  }, []);

  const activeNow = useMemo(() => {
    const nowSec = Date.now() / 1000;
    return sessions.filter((session) => {
      const ts = session.lastSeenAt?.seconds ?? 0;
      return nowSec - ts <= 5 * 60;
    }).length;
  }, [sessions]);

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      setStatus(successMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">Part 43 Security Ops</p>
        <h2 className="mt-2 text-2xl font-semibold">Security and Device Control</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Manage IP policy, device sessions, remote session revocation, and automated daily admin reports.
        </p>
      </motion.div>

      {status ? <div className="admin-surface p-3 text-sm text-zinc-700 dark:text-zinc-200">{status}</div> : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">IP Based Access Control</h3>
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input type="checkbox" checked={enforce} onChange={(event) => setEnforce(event.target.checked)} />
          Enforce policy on student sessions
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <textarea
            className="input-soft min-h-24"
            value={allowedIpsText}
            onChange={(event) => setAllowedIpsText(event.target.value)}
            placeholder="Allowed IPs (one per line)"
          />
          <textarea
            className="input-soft min-h-24"
            value={blockedIpsText}
            onChange={(event) => setBlockedIpsText(event.target.value)}
            placeholder="Blocked IPs (one per line)"
          />
          <textarea
            className="input-soft min-h-24"
            value={blockedCountriesText}
            onChange={(event) => setBlockedCountriesText(event.target.value.toUpperCase())}
            placeholder="Blocked countries (IN, US)"
          />
        </div>
        <button
          type="button"
          className="btn-pill-primary mt-2 px-4 py-2 text-xs"
          disabled={busy}
          onClick={() => {
            void runAction(async () => {
              await saveAccessPolicy({
                ...emptyPolicy,
                enforce,
                allowedIps: textToList(allowedIpsText),
                blockedIps: textToList(blockedIpsText),
                blockedCountries: textToList(blockedCountriesText),
              });
              await addAdminAuditLog("access_policy_update", "Updated IP and country access policy.");
            }, "Access policy saved.");
          }}
        >
          Save Access Policy
        </button>
      </div>

      <div className="admin-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Device Management and Sessions</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Active now: {activeNow}</p>
        </div>
        <div className="mt-3 space-y-2">
          {sessions.slice(0, 40).map((session) => (
            <div key={session.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">{session.email || session.userId}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{session.currentPath || "/"}</p>
                  <p className="text-[11px] text-zinc-400">{session.platform} · {session.timezone}</p>
                </div>
                <button
                  type="button"
                  className="btn-pill-ghost px-3 py-1 text-[11px]"
                  disabled={busy || Boolean(session.revoked)}
                  onClick={() => {
                    void runAction(async () => {
                      await revokeUserSession(session.id, "Session revoked by admin security policy.");
                      await addAdminAuditLog("session_revoke", `Revoked session ${session.id}`);
                    }, "Session revoked.");
                  }}
                >
                  {session.revoked ? "Revoked" : "Revoke"}
                </button>
              </div>
            </div>
          ))}
          {!sessions.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No sessions found yet.</p> : null}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Automated Daily Report System</h3>
        <button
          type="button"
          className="btn-pill-dark mt-2 px-4 py-2 text-xs"
          disabled={busy}
          onClick={() => {
            void runAction(async () => {
              await generateDailyAdminReport();
              await addAdminAuditLog("daily_report_generate", "Generated daily admin report.");
            }, "Daily report generated.");
          }}
        >
          Generate Daily Report
        </button>
        <div className="mt-3 space-y-2">
          {reports.slice(0, 10).map((report) => (
            <div key={report.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
              <p className="font-semibold text-zinc-700 dark:text-zinc-100">{report.reportDate}</p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-300">
                Users: {report.newUsers} · Active: {report.activeUsers} · Test Stats: {report.testsAttempted}
              </p>
              <p className="mt-1 text-zinc-400">Top routes: {(report.topActiveRoutes || []).map((row) => row.route).join(", ") || "-"}</p>
            </div>
          ))}
          {!reports.length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No reports generated yet.</p> : null}
        </div>
      </div>
    </section>
  );
}