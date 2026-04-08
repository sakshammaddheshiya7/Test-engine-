export const PRIMARY_ADMIN_EMAIL = (import.meta.env.VITE_PRIMARY_ADMIN_EMAIL ?? "deepu75245564@gmail.com").trim().toLowerCase();
export const PRIMARY_ADMIN_PASSWORD = import.meta.env.VITE_PRIMARY_ADMIN_PASSWORD ?? "deepu5564";

export function isPrimaryAdminEmail(email?: string | null) {
  return (email ?? "").trim().toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase();
}