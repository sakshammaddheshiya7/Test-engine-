import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  Bell,
  Bot,
  Boxes,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  Layers,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { listenAdminAuditLogs, type AdminAuditLog } from "../services/adminAuditService";

type AdminTile = {
  title: string;
  to: string;
  icon: typeof Activity;
  desc: string;
};

const adminTiles: AdminTile[] = [
  { title: "Content Manager", to: "/admin/questions", icon: FileText, desc: "Single and JSON uploads" },
  { title: "PDF Manager", to: "/admin/pdfs", icon: FileText, desc: "Library resources and versions" },
  { title: "Question Database", to: "/admin/question-bank", icon: Database, desc: "Edit, filter, and moderate" },
  { title: "User Manager", to: "/admin/users-tests", icon: Users, desc: "Student tracking and attempts" },
  { title: "AI Tools", to: "/admin/ai", icon: Bot, desc: "Providers, models, runtime keys" },
  { title: "Live Updates", to: "/admin/live", icon: Bell, desc: "Announcements and social links" },
  { title: "Analytics", to: "/admin/control-center", icon: Gauge, desc: "Segmentation and insights" },
  { title: "Approval Queue", to: "/admin/approval-queue", icon: Layers, desc: "Review before publish" },
  { title: "Automation Lab", to: "/admin/ops-lab", icon: FlaskConical, desc: "Schedulers and scripts" },
  { title: "Security Ops", to: "/admin/security", icon: Shield, desc: "Sessions, IP policy, reports" },
  { title: "Infrastructure", to: "/admin/infrastructure", icon: Boxes, desc: "Backup, restore, indexing" },
  { title: "Command Center", to: "/admin/command", icon: MessageSquare, desc: "Broadcast and support" },
];

export default function AdminDashboard() {
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  useEffect(() => {
    const unsubscribe = listenAdminAuditLogs(setAuditLogs);
    return () => unsubscribe();
  }, []);

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-6"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 1 Admin Foundation</p>
        <h2 className="mt-2 text-2xl font-semibold">Live Control Hub</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Firebase-connected admin modules for questions, PDFs, and live student-facing updates.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-pill-primary px-4 py-2 text-xs" to="/admin/god-mode">
            <Sparkles size={13} className="mr-1 inline" />
            God Mode
          </Link>
          <Link className="btn-pill-ghost px-4 py-2 text-xs" to="/admin/live-tests">
            <Activity size={13} className="mr-1 inline text-orange-500" />
            Live Test Mode
          </Link>
          <Link className="btn-pill-ghost px-4 py-2 text-xs" to="/admin/formulas">
            <Database size={13} className="mr-1 inline text-orange-500" />
            Formula Bank
          </Link>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {adminTiles.map((tile, index) => (
          <motion.div
            key={tile.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * index }}
            className="admin-surface p-4"
          >
            <Link to={tile.to} className="block">
              <tile.icon size={16} className="text-orange-500" />
              <h3 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tile.title}</h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{tile.desc}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Active Modules</h3>
        <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <li>AI generation, API prompt box, and runtime provider controls are active</li>
          <li>Question approval queue and moderation controls are active</li>
          <li>God Mode and Control Center automation modules are active</li>
          <li>Command Center adds role management, broadcast popups, support chat, and roadmap beta controls</li>
          <li>Security Ops adds IP policy control, device sessions, revoke controls, and daily reports</li>
          <li>Ops Lab adds scheduler, content rollback, platform status, and safe script execution</li>
          <li>Infrastructure adds backup-restore, index advisor, load monitor, cleanup, and licensing controls</li>
        </ul>
      </div>

      <div className="admin-surface p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Admin Activity Timeline</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Track the latest admin changes pushed to live student panels.</p>
        <div className="mt-3 space-y-2">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No activity yet.</p>
          ) : (
            auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="rounded-2xl border border-zinc-200 bg-white/80 p-3 dark:border-zinc-700 dark:bg-zinc-800/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">{log.action.replace(/_/g, " ")}</p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{log.details}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
