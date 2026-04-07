import { redirect } from "next/navigation";

import { getPlatformAdminAccess } from "@/lib/platform-admin";

export default async function AdminIndexPage() {
  const access = await getPlatformAdminAccess();

  redirect(access.isPlatformAdmin ? "/admin/claims" : "/admin/access");
}
