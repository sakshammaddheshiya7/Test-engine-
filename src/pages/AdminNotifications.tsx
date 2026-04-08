import { useState } from "react";
import { motion } from "framer-motion";
import { publishNotification, type NotificationKind } from "../services/notificationService";
import { addAdminAuditLog } from "../services/adminAuditService";
import { claimRateLimit } from "../services/securityService";

type FormState = {
  title: string;
  body: string;
  kind: NotificationKind;
  audience: "all" | "user" | "segment";
  targetUserId: string;
  targetSegment: string;
  ctaRoute: string;
};

const defaultForm: FormState = {
  title: "",
  body: "",
  kind: "announcement",
  audience: "all",
  targetUserId: "",
  targetSegment: "all_students",
  ctaRoute: "/",
};

export default function AdminNotifications() {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function onPublish() {
    const gate = claimRateLimit({ key: "admin_notify", maxActions: 12, windowMs: 60_000 });
    if (!gate.allowed) {
      setStatus(`Rate limit active. Retry in ${gate.retryAfterSec}s.`);
      return;
    }

    if (!form.title.trim() || !form.body.trim()) {
      setStatus("Title and message are required.");
      return;
    }
    if (form.audience === "user" && !form.targetUserId.trim()) {
      setStatus("Target user ID is required for direct notification.");
      return;
    }
    if (form.audience === "segment" && !form.targetSegment.trim()) {
      setStatus("Target segment is required.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      await publishNotification({
        title: form.title,
        body: form.body,
        kind: form.kind,
        audience: form.audience,
        targetUserId: form.targetUserId,
        targetSegments: form.audience === "segment" ? [form.targetSegment] : [],
        ctaRoute: form.ctaRoute,
      });
      await addAdminAuditLog("notification_publish", `${form.kind} notification sent to ${form.audience}.`);
      setStatus("Notification published.");
      setForm(defaultForm);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 35 Smart Notification System</p>
        <h2 className="mt-1 text-2xl font-semibold">Admin Notification Center</h2>
        <p className="mt-1 text-sm text-zinc-300">Push reminders, test alerts, PDF updates, and announcements to student notification center.</p>
      </motion.div>

      <div className="admin-surface space-y-3 p-4">
        <input
          className="input-soft"
          placeholder="Title"
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        />
        <textarea
          className="input-soft min-h-24"
          placeholder="Message"
          value={form.body}
          onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="input-soft"
            value={form.kind}
            onChange={(event) => setForm((prev) => ({ ...prev, kind: event.target.value as NotificationKind }))}
          >
            <option value="announcement">Announcement</option>
            <option value="reminder">Reminder</option>
            <option value="test_alert">Test Alert</option>
            <option value="pdf_upload">PDF Upload</option>
          </select>
          <select
            className="input-soft"
            value={form.audience}
            onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value as "all" | "user" | "segment" }))}
          >
            <option value="all">All Students</option>
            <option value="user">Single Student</option>
            <option value="segment">Segment Group</option>
          </select>
        </div>

        {form.audience === "user" ? (
          <input
            className="input-soft"
            placeholder="Target Student UID"
            value={form.targetUserId}
            onChange={(event) => setForm((prev) => ({ ...prev, targetUserId: event.target.value }))}
          />
        ) : null}

        {form.audience === "segment" ? (
          <select
            className="input-soft"
            value={form.targetSegment}
            onChange={(event) => setForm((prev) => ({ ...prev, targetSegment: event.target.value }))}
          >
            <option value="all_students">all_students</option>
            <option value="high_performer">high_performer</option>
            <option value="at_risk">at_risk</option>
            <option value="inactive">inactive</option>
            <option value="streaker">streaker</option>
          </select>
        ) : null}

        <input
          className="input-soft"
          placeholder="CTA route (example /live-test, /pdf-library)"
          value={form.ctaRoute}
          onChange={(event) => setForm((prev) => ({ ...prev, ctaRoute: event.target.value }))}
        />

        <button type="button" className="btn-pill-primary px-4 py-2 text-sm" disabled={saving} onClick={onPublish}>
          {saving ? "Publishing..." : "Publish Notification"}
        </button>
        {status ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{status}</p> : null}
      </div>
    </section>
  );
}
