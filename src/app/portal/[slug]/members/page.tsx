import Link from "next/link";

import { getPortalContext } from "@/lib/portal";
import { isMissingAnySchemaColumn, type SchemaErrorLike } from "@/lib/supabase/compat";

type MemberProfile = {
  id: string;
  email: string;
  full_name: string | null;
  year: string | null;
  major: string | null;
  campus_involvement: string | null;
  experience_summary: string | null;
  phone_number: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
};

type MembershipRow = {
  user_id: string;
  role: "admin" | "reviewer" | "member";
  created_at: string;
};

function roleCopy(role: MembershipRow["role"]) {
  if (role === "admin") {
    return "Full club admin";
  }
  if (role === "reviewer") {
    return "Applicant reviewer";
  }
  return "Club member";
}

function enrichMemberProfile(
  profile: Pick<MemberProfile, "id" | "email" | "full_name" | "year" | "major"> &
    Partial<MemberProfile>,
): MemberProfile {
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name ?? null,
    year: profile.year ?? null,
    major: profile.major ?? null,
    campus_involvement: profile.campus_involvement ?? null,
    experience_summary: profile.experience_summary ?? null,
    phone_number: profile.phone_number ?? null,
    linkedin_url: profile.linkedin_url ?? null,
    portfolio_url: profile.portfolio_url ?? null,
  };
}

async function loadMemberProfiles(
  supabase: Awaited<ReturnType<typeof getPortalContext>>["supabase"],
  memberIds: string[],
) {
  const selectAttempts = [
    {
      select:
        "id, email, full_name, year, major, campus_involvement, experience_summary, phone_number, linkedin_url, portfolio_url",
      missingColumns: [
        "campus_involvement",
        "experience_summary",
        "phone_number",
        "linkedin_url",
        "portfolio_url",
      ],
    },
    {
      select: "id, email, full_name, year, major, linkedin_url, portfolio_url",
      missingColumns: ["linkedin_url", "portfolio_url"],
    },
    {
      select: "id, email, full_name, year, major",
      missingColumns: [],
    },
  ] as const;

  let lastError: SchemaErrorLike | null = null;

  for (const attempt of selectAttempts) {
    const response = await supabase.from("profiles").select(attempt.select).in("id", memberIds);

    if (!response.error) {
      const rows = (response.data ?? []) as unknown as Array<
        Pick<MemberProfile, "id" | "email" | "full_name" | "year" | "major"> & Partial<MemberProfile>
      >;

      return {
        profiles: rows.map(enrichMemberProfile),
        error: null,
      };
    }

    lastError = response.error;

    if (
      attempt.missingColumns.length === 0 ||
      !isMissingAnySchemaColumn(response.error, [...attempt.missingColumns])
    ) {
      break;
    }
  }

  return {
    profiles: [] as MemberProfile[],
    error: lastError,
  };
}

export default async function PortalMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { message, error } = await searchParams;
  const { supabase, club, membership } = await getPortalContext(slug);

  const { data: memberships, error: membershipError } = await supabase
    .from("club_admin_memberships")
    .select("user_id, role, created_at")
    .eq("club_id", club.id)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const memberIds = Array.from(new Set((memberships ?? []).map((member) => member.user_id)));
  const { profiles, error: profilesError } = memberIds.length
    ? await loadMemberProfiles(supabase, memberIds)
    : { profiles: [] as MemberProfile[], error: null };

  if (profilesError) {
    throw new Error(profilesError.message ?? "Failed to load member profiles.");
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile as MemberProfile]));

  return (
    <main className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Member directory
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                One place to find everyone on the team.
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Browse contact details, major and year, campus involvement, and recent experience
                for the people who help run {club.name}.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Your access
              </p>
              <p className="mt-1 text-lg font-semibold capitalize tracking-[-0.03em] text-slate-950">
                {membership.role}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Only admins can change recruiting decisions and team access.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-slate-200/80 lg:grid-cols-3">
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Admins</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {(memberships ?? []).filter((member) => member.role === "admin").length}
            </p>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Reviewers</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {(memberships ?? []).filter((member) => member.role === "reviewer").length}
            </p>
          </div>
          <div className="bg-white px-6 py-5">
            <p className="text-sm font-medium text-slate-500">Members</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {(memberships ?? []).filter((member) => member.role === "member").length}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {(memberships ?? []).map((member) => {
          const profile = profileMap.get(member.user_id);

          return (
            <article
              key={member.user_id}
              className="rounded-[24px] border border-slate-200/90 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">
                    {profile?.full_name ?? profile?.email ?? "Unknown member"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{roleCopy(member.role)}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                  {member.role}
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Contact
                  </p>
                  <p className="mt-3 text-sm text-slate-900">{profile?.email ?? "No email added"}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {profile?.phone_number ?? "No phone number added"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    School
                  </p>
                  <p className="mt-3 text-sm text-slate-900">
                    {[profile?.major, profile?.year].filter(Boolean).join(" · ") || "No school details added"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {profile?.campus_involvement ?? "No campus involvement added"}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recent experience
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {profile?.experience_summary ?? "No experience summary added yet."}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {profile?.linkedin_url ? (
                  <Link
                    href={profile.linkedin_url}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                  >
                    LinkedIn
                  </Link>
                ) : null}
                {profile?.portfolio_url ? (
                  <Link
                    href={profile.portfolio_url}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                  >
                    Portfolio
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
