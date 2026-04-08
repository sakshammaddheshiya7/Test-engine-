import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  ensureAutoStudyReminder,
  listenForegroundPush,
  listenNotificationSettings,
  listenUserNotifications,
  markNotificationAsRead,
  registerBrowserPush,
  saveNotificationSettings,
  type AppNotification,
  type NotificationSettings,
} from "../services/notificationService";

const kindLabel: Record<AppNotification["kind"], string> = {
  reminder: "Reminder",
  test_alert: "Test Alert",
  pdf_upload: "PDF Upload",
  announcement: "Announcement",
};

export default function Notifications() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: false,
    reminderEnabled: true,
    testAlertEnabled: true,
    pdfAlertEnabled: true,
  });
  const [status, setStatus] = useState("");
  const [livePush, setLivePush] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }
    const offRows = listenUserNotifications(user.uid, setRows);
    const offSettings = listenNotificationSettings(user.uid, setSettings);
    return () => {
      offRows();
      offSettings();
    };
  }, [user]);

  const unreadCount = useMemo(() => {
    if (!user) {
      return 0;
    }
    return rows.filter((item) => !item.readBy?.[user.uid]).length;
  }, [rows, user]);

  async function onSaveSettings() {
    if (!user) {
      return;
    }
    await saveNotificationSettings(user.uid, settings);
    setStatus("Notification settings saved.");
  }

  useEffect(() => {
    if (!user) {
      return;
    }
    void ensureAutoStudyReminder({
      userId: user.uid,
      reminderEnabled: settings.reminderEnabled,
    });
  }, [settings.reminderEnabled, user]);

  useEffect(() => {
    if (!user || !settings.pushEnabled) {
      return;
    }

    let off: (() => void) | null = null;
    void listenForegroundPush((payload) => {
      setLivePush(payload);
      setTimeout(() => setLivePush(null), 5000);
    }).then((unsubscribe) => {
      off = unsubscribe;
    });

    return () => {
      if (off) {
        off();
      }
    };
  }, [settings.pushEnabled, user]);

  async function onEnablePush() {
    if (!user) {
      return;
    }
    const result = await registerBrowserPush(user.uid);
    if (result.ok) {
      const next = { ...settings, pushEnabled: true };
      setSettings(next);
      await saveNotificationSettings(user.uid, next);
      setStatus("Push token registered successfully.");
      return;
    }
    setStatus(result.reason ?? "Push setup failed.");
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="panel-3d p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 35 Smart Notifications</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Notification Center</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Practice reminders, test alerts, PDF updates, and live announcements in one place.</p>
      </motion.div>

      <div className="panel-3d space-y-3 p-4">
        {livePush ? (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            <p className="font-semibold">{livePush.title}</p>
            <p>{livePush.body}</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Unread: {unreadCount}</p>
        </div>
        <label className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
          Practice reminders
          <input
            type="checkbox"
            checked={settings.reminderEnabled}
            onChange={(event) => setSettings((prev) => ({ ...prev, reminderEnabled: event.target.checked }))}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
          Test alerts
          <input
            type="checkbox"
            checked={settings.testAlertEnabled}
            onChange={(event) => setSettings((prev) => ({ ...prev, testAlertEnabled: event.target.checked }))}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
          PDF update alerts
          <input
            type="checkbox"
            checked={settings.pdfAlertEnabled}
            onChange={(event) => setSettings((prev) => ({ ...prev, pdfAlertEnabled: event.target.checked }))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-pill-primary px-4 py-2 text-xs" onClick={onSaveSettings}>
            Save Settings
          </button>
          <button type="button" className="btn-pill-ghost px-4 py-2 text-xs" onClick={onEnablePush}>
            Enable Push
          </button>
        </div>
        {status ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p> : null}
      </div>

      <div className="panel-3d p-4">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Latest Updates</p>
        <div className="mt-3 space-y-2">
          {rows.length === 0 ? <p className="text-sm text-zinc-500 dark:text-zinc-400">No notifications yet.</p> : null}
          {rows.map((item) => {
            const unread = user ? !item.readBy?.[user.uid] : false;
            return (
              <article key={item.id} className="rounded-2xl border border-zinc-200/70 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold uppercase text-orange-700">
                    {kindLabel[item.kind]}
                  </span>
                  {unread ? <span className="text-[11px] font-semibold text-orange-500">NEW</span> : null}
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{item.body}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn-pill-ghost px-3 py-1.5 text-[11px]"
                    onClick={() => user && markNotificationAsRead(item.id, user.uid)}
                  >
                    Mark Read
                  </button>
                  {item.ctaRoute ? (
                    <Link className="btn-pill-primary px-3 py-1.5 text-[11px]" to={item.ctaRoute}>
                      Open
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
