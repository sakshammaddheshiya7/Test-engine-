import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { addAdminAuditLog } from "../services/adminAuditService";
import {
  archiveBroadcast,
  closeSupportThread,
  createBroadcast,
  createRoadmapItem,
  listenStudentRegistry,
  listenAdminRoles,
  listenBroadcastRows,
  listenRoadmapItems,
  listenSupportMessages,
  listenSupportThreads,
  sendBulkInAppMessage,
  sendSupportMessage,
  upsertBulkStudentRegistry,
  upsertAdminRole,
  updateRoadmapBeta,
  type AdminRole,
  type AdminRoleDoc,
  type BroadcastDoc,
  type RegistryStudentDoc,
  type RoadmapItemDoc,
  type SupportMessageDoc,
  type SupportThreadDoc,
} from "../services/adminCommandService";
import { PRIMARY_ADMIN_EMAIL } from "../config/admin";

const roleOptions: AdminRole[] = ["super_admin", "content_manager", "analytics_viewer", "moderator"];

export default function AdminCommandCenter() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [roles, setRoles] = useState<AdminRoleDoc[]>([]);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleUserId, setRoleUserId] = useState("");
  const [role, setRole] = useState<AdminRole>("moderator");
  const [permissions, setPermissions] = useState("review_questions,moderate_discussions");

  const [broadcasts, setBroadcasts] = useState<BroadcastDoc[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState("System notice");
  const [broadcastMessage, setBroadcastMessage] = useState("A focused platform update is live. Please refresh your dashboard.");
  const [broadcastTone, setBroadcastTone] = useState<"info" | "warning" | "critical">("info");
  const [broadcastRoute, setBroadcastRoute] = useState("/");

  const [threads, setThreads] = useState<SupportThreadDoc[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [threadMessages, setThreadMessages] = useState<SupportMessageDoc[]>([]);
  const [threadReply, setThreadReply] = useState("We reviewed your issue. Please retry after refreshing the app.");

  const [roadmapRows, setRoadmapRows] = useState<RoadmapItemDoc[]>([]);
  const [roadmapTitle, setRoadmapTitle] = useState("Adaptive test v2");
  const [roadmapDescription, setRoadmapDescription] = useState("Rollout dynamic difficulty + smarter time analysis for selected beta students.");
  const [roadmapState, setRoadmapState] = useState<"planned" | "in_progress" | "released">("planned");
  const [roadmapBeta, setRoadmapBeta] = useState(true);

  const [registryRows, setRegistryRows] = useState<RegistryStudentDoc[]>([]);
  const [importPayload, setImportPayload] = useState("email,fullName,uid,tags\nstudent1@example.com,Student One,,neet|batchA");
  const [bulkMode, setBulkMode] = useState<"all" | "segment" | "uids" | "emails">("segment");
  const [bulkSegment, setBulkSegment] = useState("at_risk");
  const [bulkTitle, setBulkTitle] = useState("Important platform update");
  const [bulkBody, setBulkBody] = useState("A focused practice update has been assigned. Open your dashboard now.");
  const [bulkTargetText, setBulkTargetText] = useState("");
  const [bulkRoute, setBulkRoute] = useState("/study-planner");

  useEffect(() => {
    const offRoles = listenAdminRoles(setRoles);
    const offBroadcasts = listenBroadcastRows(setBroadcasts);
    const offThreads = listenSupportThreads((rows) => {
      setThreads(rows);
      setActiveThreadId((prev) => (prev || rows[0]?.id || ""));
    });
    const offRoadmap = listenRoadmapItems(setRoadmapRows);
    const offRegistry = listenStudentRegistry(setRegistryRows);
    return () => {
      offRoles();
      offBroadcasts();
      offThreads();
      offRoadmap();
      offRegistry();
    };
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setThreadMessages([]);
      return;
    }
    return listenSupportMessages(activeThreadId, setThreadMessages);
  }, [activeThreadId]);

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

  function parseImportRows(raw: string) {
    const text = raw.trim();
    if (!text) {
      return [] as Array<{ email: string; fullName?: string; uid?: string; tags?: string[]; source?: "csv" | "json" | "manual" }>;
    }

    if (text.startsWith("[") || text.startsWith("{")) {
      const parsed = JSON.parse(text) as unknown;
      const rows = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed && Array.isArray((parsed as { users?: unknown[] }).users)
          ? ((parsed as { users: unknown[] }).users ?? [])
          : [];

      return rows
        .map((item) => {
          const row = item as Record<string, unknown>;
          return {
            email: String(row.email ?? "").trim(),
            fullName: String(row.fullName ?? row.name ?? "").trim(),
            uid: String(row.uid ?? "").trim(),
            tags: String(row.tags ?? "")
              .split(/[|,]/)
              .map((tag) => tag.trim())
              .filter(Boolean),
            source: "json" as const,
          };
        })
        .filter((row) => row.email.includes("@"));
    }

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return [];
    }

    const hasHeader = /email/i.test(lines[0]);
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines
      .map((line) => {
        const [email = "", fullName = "", uid = "", tags = ""] = line.split(",").map((item) => item.trim());
        return {
          email,
          fullName,
          uid,
          tags: tags
            .split(/[|,]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
          source: "csv" as const,
        };
      })
      .filter((row) => row.email.includes("@"));
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="admin-hero p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-200">Part 42 Advanced Ops</p>
        <h2 className="mt-2 text-2xl font-semibold">Admin Command Center</h2>
        <p className="mt-2 text-sm text-zinc-300">Role management, broadcast control, live support operations, and roadmap beta planning.</p>
      </motion.div>

      {status ? <div className="admin-surface p-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">{status}</div> : null}

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Role Management System</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="input-soft" value={roleUserId} onChange={(event) => setRoleUserId(event.target.value)} placeholder="User UID" />
          <input className="input-soft" value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} placeholder="Email" />
          <select className="input-soft" value={role} onChange={(event) => setRole(event.target.value as AdminRole)}>
            {roleOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input className="input-soft" value={permissions} onChange={(event) => setPermissions(event.target.value)} placeholder="comma separated permissions" />
        </div>
        <button
          type="button"
          className="btn-pill-primary mt-2 px-4 py-2 text-xs"
          disabled={busy || !roleUserId.trim() || !roleEmail.trim()}
          onClick={() => {
            void runAction(async () => {
              await upsertAdminRole({
                userId: roleUserId.trim(),
                email: roleEmail.trim(),
                role,
                permissions: permissions.split(","),
              });
              await addAdminAuditLog("admin_role_update", `Role ${role} assigned to ${roleEmail.trim()}`);
            }, "Admin role updated.");
          }}
        >
          Save Admin Role
        </button>
        <div className="mt-3 space-y-2 text-xs">
          {roles.slice(0, 6).map((row) => (
            <div key={row.id} className="rounded-xl border border-zinc-200 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.email || row.userId}</p>
              <p className="text-zinc-500 dark:text-zinc-400">{row.role} | {row.permissions.join(", ") || "no permission tags"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Broadcast System</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="input-soft" value={broadcastTitle} onChange={(event) => setBroadcastTitle(event.target.value)} placeholder="Broadcast title" />
          <input className="input-soft" value={broadcastRoute} onChange={(event) => setBroadcastRoute(event.target.value)} placeholder="CTA route" />
          <select className="input-soft" value={broadcastTone} onChange={(event) => setBroadcastTone(event.target.value as "info" | "warning" | "critical")}>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </div>
        <textarea className="input-soft mt-2 min-h-20" value={broadcastMessage} onChange={(event) => setBroadcastMessage(event.target.value)} placeholder="Broadcast message" />
        <button
          type="button"
          className="btn-pill-dark mt-2 px-4 py-2 text-xs"
          disabled={busy || !broadcastTitle.trim() || !broadcastMessage.trim()}
          onClick={() => {
            void runAction(async () => {
              await createBroadcast({ title: broadcastTitle, message: broadcastMessage, tone: broadcastTone, ctaRoute: broadcastRoute });
              await addAdminAuditLog("broadcast_publish", `Broadcast published: ${broadcastTitle.trim()}`);
            }, "Broadcast published.");
          }}
        >
          Publish Broadcast
        </button>
        <div className="mt-3 space-y-2 text-xs">
          {broadcasts.slice(0, 6).map((row) => (
            <div key={row.id} className="rounded-xl border border-zinc-200 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.title}</p>
              <p className="text-zinc-500 dark:text-zinc-400">{row.status} | tone: {row.tone}</p>
              <button
                type="button"
                className="btn-pill-ghost mt-2 px-3 py-1 text-[11px]"
                disabled={busy || row.status !== "active"}
                onClick={() => {
                  void runAction(async () => {
                    await archiveBroadcast(row.id);
                    await addAdminAuditLog("broadcast_archive", `Broadcast archived: ${row.title}`);
                  }, "Broadcast archived.");
                }}
              >
                Archive
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Live Support Panel</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-900/60">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`w-full rounded-xl border px-2 py-2 text-left text-xs ${
                  thread.id === activeThreadId
                    ? "border-orange-300 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-500/10"
                    : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                }`}
                onClick={() => setActiveThreadId(thread.id)}
              >
                <p className="font-semibold text-zinc-800 dark:text-zinc-100">{thread.userEmail || thread.id}</p>
                <p className="text-zinc-500 dark:text-zinc-400">{thread.status} | {thread.lastMessage?.slice(0, 36) || "No message"}</p>
              </button>
            ))}
            {!threads.length ? <p className="p-2 text-xs text-zinc-500 dark:text-zinc-400">No support threads yet.</p> : null}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {threadMessages.map((msg) => (
                <div key={msg.id} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900/70">
                  <p className="font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{msg.senderRole}</p>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-100">{msg.text}</p>
                </div>
              ))}
              {!threadMessages.length ? <p className="text-xs text-zinc-500 dark:text-zinc-400">Select a thread to view messages.</p> : null}
            </div>
            <textarea className="input-soft mt-2 min-h-20" value={threadReply} onChange={(event) => setThreadReply(event.target.value)} placeholder="Reply to student" />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-pill-primary px-4 py-2 text-xs"
                disabled={busy || !activeThreadId || !threadReply.trim()}
                onClick={() => {
                  void runAction(async () => {
                    await sendSupportMessage({
                      threadId: activeThreadId,
                      senderRole: "admin",
                      senderId: "admin",
                      senderEmail: PRIMARY_ADMIN_EMAIL,
                      text: threadReply,
                    });
                    await addAdminAuditLog("support_reply", `Reply sent for thread ${activeThreadId}`);
                  }, "Support reply sent.");
                }}
              >
                Send Reply
              </button>
              <button
                type="button"
                className="btn-pill-ghost px-4 py-2 text-xs"
                disabled={busy || !activeThreadId}
                onClick={() => {
                  void runAction(async () => {
                    await closeSupportThread(activeThreadId);
                    await addAdminAuditLog("support_close", `Support thread closed: ${activeThreadId}`);
                  }, "Support thread closed.");
                }}
              >
                Close Thread
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Platform Feature Roadmap Panel</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="input-soft" value={roadmapTitle} onChange={(event) => setRoadmapTitle(event.target.value)} placeholder="Feature title" />
          <select className="input-soft" value={roadmapState} onChange={(event) => setRoadmapState(event.target.value as "planned" | "in_progress" | "released")}>
            <option value="planned">planned</option>
            <option value="in_progress">in_progress</option>
            <option value="released">released</option>
          </select>
        </div>
        <textarea className="input-soft mt-2 min-h-20" value={roadmapDescription} onChange={(event) => setRoadmapDescription(event.target.value)} placeholder="Roadmap description" />
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={roadmapBeta} onChange={(event) => setRoadmapBeta(event.target.checked)} />
          Enable beta flag
        </label>
        <button
          type="button"
          className="btn-pill-dark mt-2 px-4 py-2 text-xs"
          disabled={busy || !roadmapTitle.trim() || !roadmapDescription.trim()}
          onClick={() => {
            void runAction(async () => {
              await createRoadmapItem({
                title: roadmapTitle,
                description: roadmapDescription,
                status: roadmapState,
                betaEnabled: roadmapBeta,
              });
              await addAdminAuditLog("roadmap_create", `Roadmap item created: ${roadmapTitle.trim()}`);
            }, "Roadmap item saved.");
          }}
        >
          Add Roadmap Item
        </button>
        <div className="mt-3 space-y-2 text-xs">
          {roadmapRows.slice(0, 8).map((row) => (
            <div key={row.id} className="rounded-xl border border-zinc-200 bg-white/80 p-2 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="font-semibold text-zinc-800 dark:text-zinc-100">{row.title}</p>
              <p className="text-zinc-500 dark:text-zinc-400">{row.status} | beta: {row.betaEnabled ? "on" : "off"}</p>
              <button
                type="button"
                className="btn-pill-ghost mt-2 px-3 py-1 text-[11px]"
                disabled={busy}
                onClick={() => {
                  void runAction(async () => {
                    await updateRoadmapBeta(row.id, !row.betaEnabled);
                    await addAdminAuditLog("roadmap_beta_toggle", `Roadmap ${row.id} beta set to ${!row.betaEnabled}`);
                  }, "Roadmap beta flag updated.");
                }}
              >
                Toggle Beta
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Bulk User Import Tool</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Paste CSV or JSON to import student registry records in one action.</p>
        <textarea
          className="input-soft mt-3 min-h-28"
          value={importPayload}
          onChange={(event) => setImportPayload(event.target.value)}
          placeholder="CSV: email,fullName,uid,tags OR JSON: [{ email, fullName, uid, tags }]"
        />
        <button
          type="button"
          className="btn-pill-primary mt-2 px-4 py-2 text-xs"
          disabled={busy}
          onClick={() => {
            void runAction(async () => {
              const rows = parseImportRows(importPayload);
              if (!rows.length) {
                throw new Error("No valid users found in import payload.");
              }
              const imported = await upsertBulkStudentRegistry(rows);
              await addAdminAuditLog("bulk_user_import", `Imported or updated ${imported} student registry records.`);
            }, "Student import completed.");
          }}
        >
          Import Users
        </button>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Registry size: {registryRows.length}</p>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Bulk User Message Tool</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select className="input-soft" value={bulkMode} onChange={(event) => setBulkMode(event.target.value as "all" | "segment" | "uids" | "emails")}>
            <option value="all">all</option>
            <option value="segment">segment</option>
            <option value="uids">uids</option>
            <option value="emails">emails</option>
          </select>
          <input className="input-soft" value={bulkRoute} onChange={(event) => setBulkRoute(event.target.value)} placeholder="CTA route" />
        </div>
        {bulkMode === "segment" ? (
          <input className="input-soft mt-2" value={bulkSegment} onChange={(event) => setBulkSegment(event.target.value)} placeholder="Segment key" />
        ) : null}
        {bulkMode === "uids" || bulkMode === "emails" ? (
          <textarea
            className="input-soft mt-2 min-h-20"
            value={bulkTargetText}
            onChange={(event) => setBulkTargetText(event.target.value)}
            placeholder={bulkMode === "uids" ? "uid1,uid2,uid3" : "email1@example.com,email2@example.com"}
          />
        ) : null}
        <input className="input-soft mt-2" value={bulkTitle} onChange={(event) => setBulkTitle(event.target.value)} placeholder="Message title" />
        <textarea className="input-soft mt-2 min-h-20" value={bulkBody} onChange={(event) => setBulkBody(event.target.value)} placeholder="Message body" />
        <button
          type="button"
          className="btn-pill-dark mt-2 px-4 py-2 text-xs"
          disabled={busy || !bulkTitle.trim() || !bulkBody.trim()}
          onClick={() => {
            void runAction(async () => {
              const parsedTargets = bulkTargetText
                .split(/[\n,]/)
                .map((item) => item.trim())
                .filter(Boolean);

              const result = await sendBulkInAppMessage({
                title: bulkTitle,
                body: bulkBody,
                ctaRoute: bulkRoute,
                mode: bulkMode,
                segment: bulkMode === "segment" ? bulkSegment : undefined,
                userIds: bulkMode === "uids" ? parsedTargets : undefined,
                emails: bulkMode === "emails" ? parsedTargets : undefined,
              });

              await addAdminAuditLog("bulk_user_message", `Bulk message sent in mode ${result.mode}. units:${result.sent}`);
            }, "Bulk message dispatched.");
          }}
        >
          Send Bulk Message
        </button>
      </div>
    </section>
  );
}