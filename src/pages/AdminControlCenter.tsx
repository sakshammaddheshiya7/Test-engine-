import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import {
  listenUserSegments,
  runAutomationWorkflow,
  runSmartUserSegmentation,
  sendSegmentAnnouncement,
  type UserSegmentDoc,
} from "../services/godModeService";
import {
  generateSystemHealthSnapshot,
  listenErrorLogs,
  listenSystemHealthSnapshots,
  type AppErrorLog,
  type SystemHealthSnapshot,
} from "../services/systemOpsService";

const segmentOptions = ["all_students", "high_performer", "at_risk", "inactive", "streaker"];

export default function AdminControlCenter() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [segments, setSegments] = useState<UserSegmentDoc[]>([]);
  const [errors, setErrors] = useState<AppErrorLog[]>([]);
  const [healthRows, setHealthRows] = useState<SystemHealthSnapshot[]>([]);

  const [targetSegment, setTargetSegment] = useState("at_risk");
  const [title, setTitle] = useState("Targeted Update");
  const [body, setBody] = useState("New focused plan is available for your performance segment.");
  const [ctaRoute, setCtaRoute] = useState("/study-planner");

  useEffect(() => {
    const offSegments = listenUserSegments(setSegments);
    const offErrors = listenErrorLogs(setErrors);
    const offHealth = listenSystemHealthSnapshots(setHealthRows);
    return () => {
      offSegments();
      offErrors();
      offHealth();
    };
  }, []);

  async function runAction(action: () => Promise<void>, okMessage: string) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      setStatus(okMessage);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">Part 41 Ops Layer</p>
        <h2 className="mt-2 text-2xl font-semibold">Admin Control Center</h2>
        <p className="mt-2 text-sm text-zinc-300">Segmentation, targeted broadcast, automation workflows, health monitoring and debug logs.</p>
      </motion.div>

      {status ? <div className="admin-surface p-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">{status}</div> : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Smart User Segmentation System</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                const result = await runSmartUserSegmentation();
                await addAdminAuditLog(
                  "segment_refresh",
                  `Processed ${result.processed} users. high:${result.highPerformers} risk:${result.atRisk} inactive:${result.inactive}`,
                );
              }, "Segmentation refresh complete.");
            }}
          >
            Run Segmentation Refresh
          </button>
          <p className="text-zinc-500 dark:text-zinc-400">Segment docs: {segments.length}</p>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Targeted Announcement System</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className="input-soft" value={targetSegment} onChange={(event) => setTargetSegment(event.target.value)}>
            {segmentOptions.map((segment) => (
              <option key={segment} value={segment}>
                {segment}
              </option>
            ))}
          </select>
          <input className="input-soft" value={ctaRoute} onChange={(event) => setCtaRoute(event.target.value)} placeholder="CTA Route" />
        </div>
        <input className="input-soft mt-2" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
        <textarea className="input-soft mt-2 min-h-24" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Message" />
        <button
          type="button"
          className="btn-pill-dark mt-2 px-4 py-2 text-xs"
          disabled={busy || !title.trim() || !body.trim()}
          onClick={() => {
            void runAction(async () => {
              await sendSegmentAnnouncement({ segment: targetSegment, title, body, ctaRoute });
              await addAdminAuditLog("segment_announcement", `Sent to ${targetSegment}.`);
            }, "Segment announcement sent.");
          }}
        >
          Send to Segment
        </button>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Automation Workflow Engine</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await runAutomationWorkflow("inactive_reminder");
                await addAdminAuditLog("workflow_run", "inactive_reminder workflow executed.");
              }, "Inactive reminder workflow executed.");
            }}
          >
            Run Inactive Reminder
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await runAutomationWorkflow("at_risk_booster");
                await addAdminAuditLog("workflow_run", "at_risk_booster workflow executed.");
              }, "At-risk booster workflow executed.");
            }}
          >
            Run At-Risk Booster
          </button>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">System Health Monitor + Error Logs</h3>
        <button
          type="button"
          className="btn-pill-primary mt-3 px-4 py-2 text-xs"
          disabled={busy}
          onClick={() => {
            void runAction(async () => {
              await generateSystemHealthSnapshot();
              await addAdminAuditLog("health_snapshot", "System health snapshot generated.");
            }, "Health snapshot generated.");
          }}
        >
          Generate Health Snapshot
        </button>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
            <p className="font-semibold text-zinc-800 dark:text-zinc-100">Latest Health</p>
            {healthRows[0] ? (
              <div className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-300">
                <p>Users: {healthRows[0].usersCount}</p>
                <p>Questions: {healthRows[0].questionsCount}</p>
                <p>PDFs: {healthRows[0].pdfCount}</p>
                <p>Notifications: {healthRows[0].notificationsCount}</p>
                <p>Active Sessions: {healthRows[0].liveActivityCount}</p>
                <p>Test Attempts: {healthRows[0].testsCount}</p>
              </div>
            ) : (
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">No snapshot yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
            <p className="font-semibold text-zinc-800 dark:text-zinc-100">Recent Client Errors</p>
            <div className="mt-2 space-y-2">
              {errors.slice(0, 5).map((errorRow) => (
                <div key={errorRow.id} className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/60">
                  <p className="font-medium text-zinc-700 dark:text-zinc-100">{errorRow.source}</p>
                  <p className="text-zinc-500 dark:text-zinc-400">{errorRow.message}</p>
                </div>
              ))}
              {!errors.length ? <p className="text-zinc-500 dark:text-zinc-400">No recent client errors.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}