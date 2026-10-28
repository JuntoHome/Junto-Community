import { requireAdmin } from "@/lib/auth";

/**
 * Every admin page except login lives in this group. The check here covers direct
 * links to any page in it; each page still calls requireAdmin() itself, because
 * layouts don't re-run when moving between pages inside the app.
 */
export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  return children;
}
