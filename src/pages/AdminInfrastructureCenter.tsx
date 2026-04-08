import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { addAdminAuditLog } from "../services/adminAuditService";
import {
  createSystemBackup,
  listenContentLicensingPolicy,
  listenIndexRecommendations,
  listenLoadMonitorSnapshots,
  listenSystemBackups,
  restoreSystemBackup,
  runLoadMonitorSnapshot,
  runSmartCleanup,
  saveContentLicensingPolicy,
  seedIndexRecommendations,
  updateIndexRecommendationStatus,
  type BackupDoc,
  type ContentLicensingPolicy,
  type FirestoreIndexRecommendation,
  type SystemLoadSnapshot,
} from "../services/adminInfrastructureService";

const defaultLicensing: ContentLicensingPolicy = {
  enablePremiumAccess: false,
  premiumSubjects: [],
  lockedPdfCategories: [],
  premiumMessage: "This content is available in premium access mode.",
};

function csvToList(value: string) {
  return Array.from(new Set(value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)));
}

export default function AdminInfrastructureCenter() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<BackupDoc[]>([]);
  const [indexes, setIndexes] = useState<FirestoreIndexRecommendation[]>([]);
  const [loads, setLoads] = useState<SystemLoadSnapshot[]>([]);
  const [backupLabel, setBackupLabel] = useState("pre_release_snapshot");
  const [subjectsText, setSubjectsText] = useState("");
  const [pdfLocksText, setPdfLocksText] = useState("");
  const [premiumMessage, setPremiumMessage] = useState(defaultLicensing.premiumMessage);
  const [premiumMode, setPremiumMode] = useState(false);

  useEffect(() => {
    const offBackups = listenSystemBackups(setBackups);
    const offIndexes = listenIndexRecommendations(setIndexes);
    const offLoads = listenLoadMonitorSnapshots(setLoads);
    const offLicensing = listenContentLicensingPolicy((policy) => {
      setPremiumMode(policy.enablePremiumAccess);
      setSubjectsText(policy.premiumSubjects.join("\n"));
      setPdfLocksText(policy.lockedPdfCategories.join("\n"));
      setPremiumMessage(policy.premiumMessage);
    });

    return () => {
      offBackups();
      offIndexes();
      offLoads();
      offLicensing();
    };
  }, []);

  const latestLoad = useMemo(() => loads[0] ?? null, [loads]);

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
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">Part 51 Infrastructure</p>
        <h2 className="mt-2 text-2xl font-semibold">Backup, Restore, Index, and Load Control</h2>
        <p className="mt-2 text-sm text-zinc-300">System safety suite for backup snapshots, restore, index advisor, load monitor, and premium licensing controls.</p>
      </motion.div>

      {status ? <div className="admin-surface p-3 text-sm text-zinc-700 dark:text-zinc-200">{status}</div> : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Smart Data Backup and Restore</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input-soft min-w-56 flex-1" value={backupLabel} onChange={(event) => setBackupLabel(event.target.value)} placeholder="Backup label" />
          <button
            type="button"
            className="btn-pill-primary px-4 py-2 text-xs"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await createSystemBackup(backupLabel, user?.email ?? "admin");
                await addAdminAuditLog("backup_create", `Created backup: ${backupLabel}`);
              }, "Backup snapshot created.");
            }}
          >
            Create Backup Snapshot
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {backups.slice(0, 8).map((backup) => (
            <div key={backup.id} className="rounded-2xl border border-zinc-200 bg-white/75 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{backup.label}</p>
                <button
                  type="button"
                  className="btn-pill-ghost px-3 py-1 text-[11px]"
                  disabled={busy}
                  onClick={() => {
                    void runAction(async () => {
                      await restoreSystemBackup(backup.id);
                      await addAdminAuditLog("backup_restore", `Restored backup ${backup.id}`);
                    }, "Backup restored to platform settings.");
                  }}
                >
                  Restore
                </button>
              </div>
              <p className="mt-1 text-zinc-500 dark:text-zinc-300">
                Users {backup.stats?.users ?? 0} · Questions {backup.stats?.questions ?? 0} · PDFs {backup.stats?.pdfs ?? 0}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Real Time Firestore Index Manager</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await seedIndexRecommendations();
                await addAdminAuditLog("index_seed", "Generated index recommendations.");
              }, "Index recommendations generated.");
            }}
          >
            Generate Suggestions
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {indexes.slice(0, 12).map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white/75 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{item.collectionName}</p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-300">{item.fields.join(" + ")} · {item.purpose}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-pill-ghost px-2 py-1 text-[11px]" onClick={() => void updateIndexRecommendationStatus(item.id, "approved")}>
                  Approve
                </button>
                <button type="button" className="btn-pill-ghost px-2 py-1 text-[11px]" onClick={() => void updateIndexRecommendationStatus(item.id, "ignored")}>
                  Ignore
                </button>
                <span className="rounded-full border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">{item.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Load Balancing Monitor + Smart Cleanup</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                await runLoadMonitorSnapshot();
                await addAdminAuditLog("load_monitor_snapshot", "Generated load monitor snapshot.");
              }, "Load snapshot generated.");
            }}
          >
            Refresh Load Snapshot
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy}
            onClick={() => {
              void runAction(async () => {
                const result = await runSmartCleanup();
                await addAdminAuditLog("smart_cleanup", `Cleanup removed ${result.removedFailedJobs} jobs and ${result.removedStaleLogs} logs.`);
              }, "Smart cleanup completed.");
            }}
          >
            Run Smart Cleanup
          </button>
        </div>
        {latestLoad ? (
          <div className="mt-3 rounded-2xl border border-zinc-200 bg-white/75 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
            <p className="font-semibold text-zinc-800 dark:text-zinc-100">Load: {latestLoad.level.toUpperCase()}</p>
            <p className="mt-1 text-zinc-500 dark:text-zinc-300">
              Active users {latestLoad.activeUsers} · Pending jobs {latestLoad.pendingJobs} · Live tests {latestLoad.activeLiveTests} · Errors 24h {latestLoad.errorLogs24h}
            </p>
          </div>
        ) : null}
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Dynamic Pricing and Content Licensing Control</h3>
        <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input type="checkbox" checked={premiumMode} onChange={(event) => setPremiumMode(event.target.checked)} />
          Enable premium access controls
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <textarea className="input-soft min-h-24" value={subjectsText} onChange={(event) => setSubjectsText(event.target.value)} placeholder="Premium subjects (one per line)" />
          <textarea className="input-soft min-h-24" value={pdfLocksText} onChange={(event) => setPdfLocksText(event.target.value)} placeholder="Locked PDF categories (one per line)" />
          <textarea className="input-soft min-h-24 sm:col-span-2" value={premiumMessage} onChange={(event) => setPremiumMessage(event.target.value)} placeholder="Premium locked content message" />
        </div>
        <button
          type="button"
          className="btn-pill-primary mt-2 px-4 py-2 text-xs"
          disabled={busy}
          onClick={() => {
            void runAction(async () => {
              await saveContentLicensingPolicy({
                enablePremiumAccess: premiumMode,
                premiumSubjects: csvToList(subjectsText),
                lockedPdfCategories: csvToList(pdfLocksText),
                premiumMessage: premiumMessage.trim() || defaultLicensing.premiumMessage,
              });
              await addAdminAuditLog("licensing_policy_update", "Updated premium licensing policy.");
            }, "Content licensing policy saved.");
          }}
        >
          Save Licensing Policy
        </button>
      </div>
    </section>
  );
}
