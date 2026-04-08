import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import {
  announcementConstraints,
  listenToCollection,
  type AdminLinks,
  type Announcement,
} from "../firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import {
  createAnnouncement,
  deleteAnnouncementById,
  saveAdminLinks,
  uploadAdminQrCode,
} from "../services/adminContentService";
import { addAdminAuditLog } from "../services/adminAuditService";
import { publishNotification } from "../services/notificationService";
import { touchGlobalSync } from "../services/syncService";

const initialLinks: AdminLinks = {
  instagram: "",
  telegram: "",
  youtube: "",
  qrCodeUrl: "",
};

export default function AdminLiveContent() {
  const [links, setLinks] = useState<AdminLinks>(initialLinks);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [feedback, setFeedback] = useState("");
  const [savingLinks, setSavingLinks] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);

  useEffect(() => {
    const unsubscribeLinks = onSnapshot(doc(db, "platform_settings", "admin_links"), (snapshot) => {
      if (snapshot.exists()) {
        setLinks((snapshot.data() as AdminLinks) ?? initialLinks);
      }
    });

    const unsubscribeAnnouncements = listenToCollection<Announcement>(
      "announcements",
      announcementConstraints(),
      setAnnouncements,
    );

    return () => {
      unsubscribeLinks();
      unsubscribeAnnouncements();
    };
  }, []);

  async function onSaveLinks() {
    setSavingLinks(true);
    setFeedback("");

    try {
      await saveAdminLinks(links);
      await addAdminAuditLog("update_admin_links", "Updated social handles and QR link for student dashboard");
      await touchGlobalSync("admin_links_update");
      setFeedback("Admin links updated. Students will see changes instantly.");
    } catch {
      setFeedback("Failed to save links. Please verify Firebase permissions.");
    } finally {
      setSavingLinks(false);
    }
  }

  async function onUploadQr(file: File) {
    setUploadingQr(true);
    setFeedback("");

    try {
      const qrCodeUrl = await uploadAdminQrCode(file);
      setLinks((prev) => ({ ...prev, qrCodeUrl }));
      await addAdminAuditLog("upload_qr", `Uploaded new admin QR asset: ${file.name}`);
      setFeedback("QR uploaded. Click Save Links to publish it for students.");
    } catch {
      setFeedback("QR upload failed. Try a smaller PNG or JPG image.");
    } finally {
      setUploadingQr(false);
    }
  }

  async function onCreateAnnouncement() {
    if (!title.trim() || !message.trim()) {
      setFeedback("Announcement title and message are required.");
      return;
    }

    setSavingAnnouncement(true);
    setFeedback("");

    try {
      await createAnnouncement({ title, message });
      await addAdminAuditLog("publish_announcement", `Published announcement: ${title.trim()}`);
      await publishNotification({
        title: title.trim(),
        body: message.trim().slice(0, 240),
        kind: "announcement",
        audience: "all",
        ctaRoute: "/",
      });
      await touchGlobalSync("announcement_publish");
      setTitle("");
      setMessage("");
      setFeedback("Announcement published.");
    } catch {
      setFeedback("Failed to publish announcement.");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  async function onDeleteAnnouncement(id: string) {
    try {
      const item = announcements.find((announcement) => announcement.id === id);
      await deleteAnnouncementById(id);
      await addAdminAuditLog("delete_announcement", `Deleted announcement: ${item?.title ?? id}`);
      await touchGlobalSync("announcement_delete");
      setFeedback("Announcement removed.");
    } catch {
      setFeedback("Delete failed. Check admin permissions.");
    }
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 4 Admin Module</p>
        <h2 className="mt-1 text-2xl font-semibold">Live Updates and Social Handles</h2>
        <p className="mt-1 text-sm text-zinc-300">
          Manage Instagram, Telegram, YouTube, QR link, and announcements. All changes sync to students in real-time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="admin-surface space-y-3 p-4"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Social Handles and QR</h3>
        <input
          className="input-soft"
          placeholder="Instagram URL"
          value={links.instagram ?? ""}
          onChange={(event) => setLinks((prev) => ({ ...prev, instagram: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="Telegram URL"
          value={links.telegram ?? ""}
          onChange={(event) => setLinks((prev) => ({ ...prev, telegram: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="YouTube URL"
          value={links.youtube ?? ""}
          onChange={(event) => setLinks((prev) => ({ ...prev, youtube: event.target.value }))}
        />
        <input
          className="input-soft"
          placeholder="QR destination URL (optional if you upload image)"
          value={links.qrCodeUrl ?? ""}
          onChange={(event) => setLinks((prev) => ({ ...prev, qrCodeUrl: event.target.value }))}
        />
        <input
          className="input-soft bg-white file:mr-3 file:rounded-full file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white dark:bg-zinc-900"
          accept="image/png,image/jpeg,image/jpg"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void onUploadQr(file);
            }
          }}
        />
        {links.qrCodeUrl ? (
          <a className="text-xs text-orange-600 underline" href={links.qrCodeUrl} target="_blank" rel="noreferrer">
            Current QR URL
          </a>
        ) : null}
        <button
          className="btn-pill-primary w-full px-4 py-3 text-sm"
          type="button"
          onClick={onSaveLinks}
          disabled={savingLinks || uploadingQr}
        >
          {savingLinks ? "Saving..." : uploadingQr ? "Uploading QR..." : "Save Links"}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="admin-surface space-y-3 p-4"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Publish Announcement</h3>
        <input
          className="input-soft"
          placeholder="Announcement title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="input-soft min-h-28"
          placeholder="Announcement message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          className="btn-pill-dark w-full px-4 py-3 text-sm"
          type="button"
          onClick={onCreateAnnouncement}
          disabled={savingAnnouncement}
        >
          {savingAnnouncement ? "Publishing..." : "Publish Announcement"}
        </button>
      </motion.div>

      <div className="admin-surface space-y-2 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live Announcements</h3>
        {announcements.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No announcements yet.</p>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/70">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{announcement.title}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{announcement.message}</p>
                </div>
                <button
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                  type="button"
                  onClick={() => onDeleteAnnouncement(announcement.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {feedback ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{feedback}</p> : null}
    </section>
  );
}