import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { AdminLinks } from "../firebase/firestore";
import { db, storage } from "../firebase/firebaseConfig";

type AnnouncementPayload = {
  title: string;
  message: string;
};

function sanitizeSegment(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
}

export async function saveAdminLinks(links: AdminLinks) {
  await setDoc(
    doc(db, "platform_settings", "admin_links"),
    {
      instagram: links.instagram?.trim() ?? "",
      telegram: links.telegram?.trim() ?? "",
      youtube: links.youtube?.trim() ?? "",
      qrCodeUrl: links.qrCodeUrl?.trim() ?? "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function uploadAdminQrCode(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeName = sanitizeSegment(file.name.replace(/\.[^/.]+$/, "")) || "admin-qr";
  const storagePath = `platform_settings/admin_links/qr-${Date.now()}-${safeName}.${ext}`;
  const fileRef = ref(storage, storagePath);

  await uploadBytes(fileRef, file, { contentType: file.type || "image/png" });
  return getDownloadURL(fileRef);
}

export async function createAnnouncement(payload: AnnouncementPayload) {
  await addDoc(collection(db, "announcements"), {
    title: payload.title.trim(),
    message: payload.message.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAnnouncementById(announcementId: string) {
  await deleteDoc(doc(db, "announcements", announcementId));
}