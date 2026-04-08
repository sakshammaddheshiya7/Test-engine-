import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import {
  assignUserExperiment,
  bumpForceLogoutVersion,
  defaultGlobalAppConfig,
  deleteStudentData,
  listenGlobalAppConfig,
  listenLiveActivity,
  resetStudentHistory,
  resetStudentStreak,
  setAbTestingConfig,
  setEmergencyBanner,
  setFeatureToggle,
  setStudentAccountControl,
  setSystemFlags,
  type FeatureToggleKey,
  type GlobalAppConfig,
  type LiveActivity,
} from "../services/godModeService";

const featureLabels: Array<{ key: FeatureToggleKey; label: string }> = [
  { key: "tests", label: "Tests" },
  { key: "pdfLibrary", label: "PDF Library" },
  { key: "aiTools", label: "AI Tools" },
  { key: "discussion", label: "Discussion" },
  { key: "notifications", label: "Notifications" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "search", label: "Search" },
  { key: "liveTests", label: "Live Tests" },
];

export default function AdminGodMode() {
  const [config, setConfig] = useState<GlobalAppConfig>(defaultGlobalAppConfig);
  const [activity, setActivity] = useState<LiveActivity[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [bannerText, setBannerText] = useState("");
  const [bannerTone, setBannerTone] = useState<GlobalAppConfig["banner"]["tone"]>("info");

  const [targetUserId, setTargetUserId] = useState("");
  const [abUserId, setAbUserId] = useState("");
  const [abGroup, setAbGroup] = useState<"A" | "B">("A");

  const activeStudents = useMemo(
    () => activity.filter((row) => !row.isAdmin && row.lastSeenAt?.seconds && Date.now() - row.lastSeenAt.seconds * 1000 < 5 * 60 * 1000),
    [activity],
  );

  useEffect(() => {
    const unsubConfig = listenGlobalAppConfig((nextConfig) => {
      setConfig(nextConfig);
      setBannerText(nextConfig.banner.text ?? "");
      setBannerTone(nextConfig.banner.tone ?? "info");
    });

    const unsubActivity = listenLiveActivity(setActivity);

    return () => {
      unsubConfig();
      unsubActivity();
    };
  }, []);

  async function withStatus(action: () => Promise<void>, successText: string) {
    setBusy(true);
    setStatus("");
    try {
      await action();
      setStatus(successText);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Action failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-200">God Mode Admin</p>
        <h2 className="mt-2 text-2xl font-semibold">System Level Control Panel</h2>
        <p className="mt-2 text-sm text-zinc-300">Live feature toggles, maintenance controls, banner engine, force logout and account controls.</p>
      </motion.div>

      {status ? (
        <div className="admin-surface p-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">{status}</div>
      ) : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Remote Feature Toggler</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {featureLabels.map((item) => (
            <label key={item.key} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/70">
              <span className="font-medium text-zinc-800 dark:text-zinc-100">{item.label}</span>
              <input
                type="checkbox"
                checked={config.featureToggles[item.key] !== false}
                disabled={busy}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  void withStatus(async () => {
                    await setFeatureToggle(item.key, enabled);
                    await addAdminAuditLog("feature_toggle", `${item.label} set to ${enabled ? "enabled" : "disabled"}`);
                  }, `${item.label} updated.`);
                }}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Global App Configuration Engine</h3>
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Maintenance Mode</span>
            <input
              type="checkbox"
              checked={config.systemFlags.maintenanceMode}
              disabled={busy}
              onChange={(event) => {
                const enabled = event.target.checked;
                void withStatus(async () => {
                  await setSystemFlags({ maintenanceMode: enabled });
                  await addAdminAuditLog("maintenance_mode", `Maintenance mode ${enabled ? "enabled" : "disabled"}`);
                }, "Maintenance mode updated.");
              }}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/70">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Content Freeze Mode</span>
            <input
              type="checkbox"
              checked={config.systemFlags.contentFreezeMode}
              disabled={busy}
              onChange={(event) => {
                const enabled = event.target.checked;
                void withStatus(async () => {
                  await setSystemFlags({ contentFreezeMode: enabled });
                  await addAdminAuditLog("content_freeze", `Content freeze ${enabled ? "enabled" : "disabled"}`);
                }, "Content freeze updated.");
              }}
            />
          </label>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Announcement Banner Engine</h3>
        <div className="mt-3 space-y-2">
          <textarea className="input-soft min-h-20" value={bannerText} onChange={(event) => setBannerText(event.target.value)} placeholder="Emergency alert or exam notice for all students" />
          <div className="flex gap-2">
            <select className="input-soft max-w-[160px]" value={bannerTone} onChange={(event) => setBannerTone(event.target.value as GlobalAppConfig["banner"]["tone"])}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
            <button
              type="button"
              className="btn-pill-primary px-4 py-2 text-xs"
              disabled={busy}
              onClick={() => {
                void withStatus(async () => {
                  await setEmergencyBanner(true, bannerText.trim(), bannerTone);
                  await addAdminAuditLog("banner_update", `Banner published with ${bannerTone} tone.`);
                }, "Banner published.");
              }}
            >
              Publish Banner
            </button>
            <button
              type="button"
              className="btn-pill-ghost px-4 py-2 text-xs"
              disabled={busy}
              onClick={() => {
                void withStatus(async () => {
                  await setEmergencyBanner(false, "", "info");
                  await addAdminAuditLog("banner_disable", "Banner disabled.");
                }, "Banner disabled.");
              }}
            >
              Disable
            </button>
          </div>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Remote Force Logout</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-pill-dark px-4 py-2 text-xs"
            disabled={busy}
            onClick={() => {
              void withStatus(async () => {
                await bumpForceLogoutVersion("Manual security refresh");
                await addAdminAuditLog("force_logout_all", "Force logout triggered for all student sessions.");
              }, "Force logout signal sent.");
            }}
          >
            Force Logout All Students
          </button>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Student Account Control System</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Use Firebase uid as target identifier.</p>
        <input className="input-soft mt-3" value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="Target user uid" />
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2"
            disabled={busy || !targetUserId.trim()}
            onClick={() => {
              void withStatus(async () => {
                await setStudentAccountControl(targetUserId.trim(), { suspended: true });
                await addAdminAuditLog("student_suspend", `Student ${targetUserId.trim()} suspended.`);
              }, "Student suspended.");
            }}
          >
            Suspend
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy || !targetUserId.trim()}
            onClick={() => {
              void withStatus(async () => {
                await setStudentAccountControl(targetUserId.trim(), { suspended: false, restricted: false });
                await addAdminAuditLog("student_unsuspend", `Student ${targetUserId.trim()} restored.`);
              }, "Student restored.");
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy || !targetUserId.trim()}
            onClick={() => {
              void withStatus(async () => {
                await setStudentAccountControl(targetUserId.trim(), { restricted: true });
                await addAdminAuditLog("student_restrict", `Student ${targetUserId.trim()} restricted.`);
              }, "Student restricted.");
            }}
          >
            Restrict
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy || !targetUserId.trim()}
            onClick={() => {
              void withStatus(async () => {
                await resetStudentStreak(targetUserId.trim());
                await addAdminAuditLog("student_reset_streak", `Streak reset for ${targetUserId.trim()}.`);
              }, "Streak reset complete.");
            }}
          >
            Reset Streak
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2"
            disabled={busy || !targetUserId.trim()}
            onClick={() => {
              void withStatus(async () => {
                await resetStudentHistory(targetUserId.trim());
                await addAdminAuditLog("student_reset_history", `History reset for ${targetUserId.trim()}.`);
              }, "Test history cleared.");
            }}
          >
            Reset History
          </button>
          <button
            type="button"
            className="btn-pill-dark px-4 py-2"
            disabled={busy || !targetUserId.trim()}
            onClick={() => {
              void withStatus(async () => {
                await deleteStudentData(targetUserId.trim());
                await addAdminAuditLog("student_delete_data", `Student data deleted for ${targetUserId.trim()}.`);
              }, "Student data removed.");
            }}
          >
            Delete Student Data
          </button>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">A/B Testing Engine</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-pill-primary px-4 py-2 text-xs"
            disabled={busy}
            onClick={() => {
              void withStatus(async () => {
                await setAbTestingConfig(true, `exp-${Date.now()}`);
                await addAdminAuditLog("ab_test_enable", "A/B testing enabled.");
              }, "A/B testing enabled.");
            }}
          >
            Enable A/B Testing
          </button>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2 text-xs"
            disabled={busy}
            onClick={() => {
              void withStatus(async () => {
                await setAbTestingConfig(false, "");
                await addAdminAuditLog("ab_test_disable", "A/B testing disabled.");
              }, "A/B testing disabled.");
            }}
          >
            Disable
          </button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_auto]">
          <input className="input-soft" placeholder="Student uid" value={abUserId} onChange={(event) => setAbUserId(event.target.value)} />
          <select className="input-soft" value={abGroup} onChange={(event) => setAbGroup(event.target.value as "A" | "B") }>
            <option value="A">Group A</option>
            <option value="B">Group B</option>
          </select>
          <button
            type="button"
            className="btn-pill-ghost px-4 py-2 text-xs"
            disabled={busy || !abUserId.trim() || !config.abTesting.experimentId}
            onClick={() => {
              void withStatus(async () => {
                await assignUserExperiment(abUserId.trim(), config.abTesting.experimentId, abGroup);
                await addAdminAuditLog("ab_assign", `Assigned ${abUserId.trim()} to group ${abGroup}.`);
              }, "Experiment group assigned.");
            }}
          >
            Assign Group
          </button>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live User Activity Monitor</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Active students in last 5 minutes: {activeStudents.length}</p>
        <div className="mt-3 space-y-2">
          {activity.slice(0, 20).map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800/70">
              <div>
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.email || row.userId}</p>
                <p className="text-zinc-500 dark:text-zinc-400">{row.currentPath}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-zinc-700 dark:text-zinc-200">{row.isAdmin ? "Admin" : "Student"}</p>
                <p className="text-zinc-500 dark:text-zinc-400">
                  {row.lastSeenAt?.seconds ? new Date(row.lastSeenAt.seconds * 1000).toLocaleTimeString() : "live"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}