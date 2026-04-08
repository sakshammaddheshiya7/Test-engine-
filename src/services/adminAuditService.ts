import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export type AdminAuditLog = {
  id: string;
  action: string;
  details: string;
  createdAt?: { seconds: number };
};

export async function addAdminAuditLog(action: string, details: string) {
  await addDoc(collection(db, "admin_audit_logs"), {
    action,
    details,
    createdAt: serverTimestamp(),
  });
}

export function listenAdminAuditLogs(onData: (rows: AdminAuditLog[]) => void) {
  const logsRef = collection(db, "admin_audit_logs");
  const logsQuery = query(logsRef, orderBy("createdAt", "desc"), limit(30));

  return onSnapshot(logsQuery, (snapshot) => {
    const rows = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<AdminAuditLog, "id">),
    }));
    onData(rows);
  });
}
