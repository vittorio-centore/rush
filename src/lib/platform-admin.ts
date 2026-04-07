import { redirect } from "next/navigation";
import { cache } from "react";

import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

function getPlatformAdminEmails() {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const getPlatformAdminAccess = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth?message=Sign+in+to+open+admin+tools.");
  }

  const email = data.user.email?.trim().toLowerCase() ?? "";
  const isPlatformAdmin = email.length > 0 && getPlatformAdminEmails().has(email);

  return {
    user: data.user,
    email,
    isPlatformAdmin,
  };
});

export async function requirePlatformAdmin() {
  const access = await getPlatformAdminAccess();

  if (!access.isPlatformAdmin) {
    redirect(
      `/admin/access?error=${encodeURIComponent("Your account is not allowed to review club claims yet.")}`,
    );
  }

  return {
    ...access,
    supabase: createServiceClient(),
  };
}
