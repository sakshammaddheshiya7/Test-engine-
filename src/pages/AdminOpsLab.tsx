import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import { runSmartUserSegmentation } from "../services/godModeService";
import { generateSystemHealthSnapshot } from "../services/systemOpsService";
import {
  createQuestionVersionSnapshot,
  createScheduledJob,
  listenPlatformStatus,
  listenQuestionVersions,
  listenScheduledJobs,
  processDueScheduledJobs,
  refreshPlatformStatus,
  rollbackQuestionVersion,
  runScheduledJobNow,
  type PlatformStatus,
  type QuestionVersionDoc,
  type ScheduledJob,
  type SchedulerJobType,
} from "../services/adminOpsLabService";

export default function AdminOpsLab() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus | null>(null);

  const [jobType, setJobType] = useState<SchedulerJobType>("announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"info" | "warning" | "critical">("info");
  const [ctaRoute, setCtaRoute] = useState("");
  const [scheduleAt, setScheduleAt] = useState(() => {
    const date = new Date(Date.now() + 10 * 60 * 1000);
    return date.toISOString().slice(0, 16);
  });

  const [questionId, setQuestionId] = useState("");
  const [snapshotNote, setSnapshotNote] = useState("manual pre-update snapshot");
  const [versions, setVersions] = useState<QuestionVersionDoc[]>([]);

  useEffect(() => {
    const offJobs = listenScheduledJobs(setJobs);
    const offStatus = listenPlatformStatus(setPlatformStatus);
    return () => {
      offJobs();
      offStatus();
    };
  }, []);

  useEffect(() => {
    if (!questionId.trim()) {
      setVersions([]);
      return;
    }
    const offVersions = listenQuestionVersions(questionId.trim(), setVersions);
    return () => offVersions();
  }, [questionId]);

  const pendingJobs = useMemo(() => jobs.filter((item) => item.status === "pending").length, [jobs]);

  async function runAction(action: () => Promise<void>, successText: string) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      setStatus(successText);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">Part 44 Ops Lab</p>
        <h2 className="mt-2 text-2xl font-semibold">Scheduler, Version Control, and Status Engine</h2>
        <p className="mt-2 text-sm text-zinc-300">Advanced operations console for scheduled publishing, rollback, safe scripts, and platform status.</p>
      </motion.div>

      {status ? <div className="admin-surface p-3 text-sm text-zinc-700 dark:text-zinc-200">{status}</div> : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bulk Content Scheduler</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className="input-soft" value={jobType} onChange={(event) => setJobType(event.target.value as SchedulerJobType)}>
            <option value="announcement">Announcement</option>
            <option value="notification">In-App Notification</option>
            <option value="banner">Top Banner</option>
          </select>
          <input className="input-soft" type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
          <input className="input-soft" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <select className="input-soft" value={tone} onChange={(event) => setTone(event.target.value as "info" | "warning" | "critical") }>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <input className="input-soft sm:col-span-2" value={ctaRoute} onChange={(event) => setCtaRoute(event.target.value)} placeholder="CTA route (optional) e.g. /custom-test" />
          <textarea className="input-soft min-h-24 sm:col-span-2" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2"
            disabled={busy || !title.trim() || !message.trim() || !scheduleAt}
            onClick={() => {
              void runAction(async () => {
                await createScheduledJob({
                  type: jobType,
                  title,
                  message,
                  tone,
                  ctaRoute,
                  scheduleAtMs: new Date(scheduleAt).getTime(),
                });
                await addAdminAuditLog("scheduler_create", `Created ${jobType} job.`);
                setTitle("");
                setMessage("");
                setCtaRoute("");
              }, "Scheduled job created.");
            }}
          >
            Schedule Job
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                const count = await processDueScheduledJobs();
                await addAdminAuditLog("scheduler_run_due", `Processed ${count} due jobs.`);
              }, "Due jobs processed.");
            }}
          >
            Run Due Jobs Now
          </button>
          <span className="rounded-full border border-zinc-200 bg-white/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
            Pending jobs: {pendingJobs}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {jobs.slice(0, 12).map((job) => (
            <div key={job.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{job.title}</p>
                <span className="text-zinc-500 dark:text-zinc-400">{job.status}</span>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">{job.type} · {job.message.slice(0, 130)}</p>
              {job.status !== "executed" ? (
                <button
                  type="button"
                  className="btn-pill-ghost mt-2 px-3 py-1 text-[11px]"
                  disabled={busy}
                  onClick={() => {
                    void runAction(async () => {
                      await runScheduledJobNow(job.id);
                      await addAdminAuditLog("scheduler_run_manual", `Executed scheduled job ${job.id}`);
                    }, "Job executed.");
                  }}
                >
                  Execute Now
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Content Version Control and Rollback</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="input-soft" value={questionId} onChange={(event) => setQuestionId(event.target.value)} placeholder="Question ID" />
          <input className="input-soft" value={snapshotNote} onChange={(event) => setSnapshotNote(event.target.value)} placeholder="Snapshot note" />
        </div>
        <button
          type="button"
          className="btn-pill-primary mt-2 px-4 py-2 text-xs"
          disabled={busy || !questionId.trim()}
          onClick={() => {
            void runAction(async () => {
              await createQuestionVersionSnapshot(questionId.trim(), snapshotNote);
              await addAdminAuditLog("question_snapshot", `Created version snapshot for ${questionId.trim()}`);
            }, "Question snapshot created.");
          }}
        >
          Create Snapshot
        </button>
        <div className="mt-3 space-y-2">
          {versions.map((version) => (
            <div key={version.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{version.note || "snapshot"}</p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">{new Date((version.createdAt?.seconds ?? 0) * 1000).toLocaleString()}</p>
              <button
                type="button"
                className="btn-pill-dark mt-2 px-3 py-1 text-[11px]"
                disabled={busy}
                onClick={() => {
                  void runAction(async () => {
                    await rollbackQuestionVersion(version.id);
                    await addAdminAuditLog("question_rollback", `Rolled back question ${questionId.trim()} using version ${version.id}`);
                  }, "Rollback complete.");
                }}
              >
                Rollback to This Version
              </button>
            </div>
          ))}
          {!versions.length ? <p className="text-xs text-zinc-500 dark:text-zinc-400">No versions found for this question yet.</p> : null}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Real Time Platform Status Panel</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2 text-xs"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await refreshPlatformStatus();
                await addAdminAuditLog("platform_status_refresh", "Refreshed platform status panel.");
              }, "Platform status refreshed.");
            }}
          >
            Refresh Status
          </button>
          <span className="rounded-full border border-zinc-200 bg-white/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
            Users: {platformStatus?.usersCount ?? 0}
          </span>
          <span className="rounded-full border border-zinc-200 bg-white/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
            Questions: {platformStatus?.questionsCount ?? 0}
          </span>
          <span className="rounded-full border border-zinc-200 bg-white/70 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300">
            PDFs: {platformStatus?.pdfCount ?? 0}
          </span>
          <span className={`rounded-full border px-3 py-2 text-[11px] ${platformStatus?.aiRuntimeConfigured ? "border-emerald-300 bg-emerald-500/10 text-emerald-600" : "border-amber-300 bg-amber-500/10 text-amber-600"}`}>
            AI Runtime: {platformStatus?.aiRuntimeConfigured ? "Configured" : "Missing"}
          </span>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Custom Script Execution Tool</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Safe templates only. No raw code execution.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await generateSystemHealthSnapshot();
                await addAdminAuditLog("script_health_snapshot", "Executed script: generate_system_health_snapshot");
              }, "Script executed: system health snapshot generated.");
            }}
          >
            generate_system_health_snapshot
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await runSmartUserSegmentation();
                await addAdminAuditLog("script_segmentation", "Executed script: run_smart_segmentation");
              }, "Script executed: smart segmentation refreshed.");
            }}
          >
            run_smart_segmentation
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await processDueScheduledJobs();
                await addAdminAuditLog("script_process_scheduler", "Executed script: process_due_scheduler_jobs");
              }, "Script executed: due scheduler jobs processed.");
            }}
          >
            process_due_scheduler_jobs
          </button>
        </div>
      </div>
    </section>
  );
}
