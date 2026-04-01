import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import ProfileUploadField from "./ProfileUploadField";
import { updateProfile } from "./actions";

const YEAR_OPTIONS = [
  { value: "", label: "Select year" },
  { value: "Freshman", label: "Freshman" },
  { value: "Sophomore", label: "Sophomore" },
  { value: "Junior", label: "Junior" },
  { value: "Senior", label: "Senior" },
  { value: "Graduate", label: "Graduate" },
] as const;

type Deadline = {
  id: string;
  title: string;
  deadline_at: string;
  clubs:
    | { id: string; name: string; slug: string | null }
    | { id: string; name: string; slug: string | null }[]
    | null;
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "email, full_name, year, major, interests, skills, campus_involvement, headshot_url, resume_url, linkedin_url, portfolio_url",
    )
    .eq("id", data.user.id)
    .single();

  const { data: followRows } = await supabase
    .from("user_follows")
    .select("club_id")
    .eq("user_id", data.user.id)
    .limit(12);

  const followedClubIds = (followRows ?? []).map((row) => row.club_id).filter(Boolean);

  let upcomingDeadlines: Deadline[] = [];
  if (followedClubIds.length > 0) {
    const { data: deadlineRows } = await supabase
      .from("club_deadlines")
      .select("id, title, deadline_at, clubs(id, name, slug)")
      .in("club_id", followedClubIds)
      .eq("is_active", true)
      .gt("deadline_at", new Date().toISOString())
      .order("deadline_at")
      .limit(4);

    upcomingDeadlines = (deadlineRows ?? []) as Deadline[];
  }

  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const error = typeof params.error === "string" ? params.error : null;

  const interestsValue = Array.isArray(profile?.interests) ? profile.interests.join(", ") : "";
  const skillsValue = Array.isArray(profile?.skills) ? profile.skills.join(", ") : "";
  const initials = getInitials(profile?.full_name ?? profile?.email ?? "Rush");

  return (
    <div className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-[1.25rem] border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-[1.25rem] border border-status-rejected/25 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-24">
          <section className="rounded-[1.5rem] border border-border-warm bg-[#f7f5f2] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                  Profile preview
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  This is how your profile reads at a glance.
                </p>
              </div>
            </div>

            <div className="mt-5">
              {profile?.headshot_url ? (
                <div className="h-20 w-20 overflow-hidden rounded-[1.1rem] border border-border-warm bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.headshot_url} alt="" className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.1rem] border border-border-warm bg-white text-[2rem] font-semibold text-brand-oxblood">
                  {initials}
                </div>
              )}
            </div>

            <div className="mt-4">
              <h2 className="text-[1.65rem] leading-none tracking-[-0.04em] text-ink">
                {profile?.full_name || "Your name"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {profile?.campus_involvement || "Add a short involvement line so clubs can place you quickly."}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
                {[profile?.major, profile?.year].filter(Boolean).join(" · ") || "Major · Year"}
              </p>
            </div>

            <div className="mt-4 border-t border-border-warm pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                Links
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile?.resume_url ? (
                  <LinkTag href={profile.resume_url} label="Resume" />
                ) : null}
                {profile?.linkedin_url ? (
                  <LinkTag href={profile.linkedin_url} label="LinkedIn" />
                ) : null}
                {profile?.portfolio_url ? (
                  <LinkTag href={profile.portfolio_url} label="Portfolio" />
                ) : null}
                {!profile?.resume_url && !profile?.linkedin_url && !profile?.portfolio_url ? (
                  <span className="text-sm text-ink-muted">Add resume or profile links.</span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 border-t border-border-warm pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                Deadlines
              </p>
              {upcomingDeadlines.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-ink-muted">
                  Save clubs to build your deadline list here.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {upcomingDeadlines.map((deadline) => {
                    const club = getRecord(deadline.clubs);

                    return (
                      <div key={deadline.id} className="border-b border-border-warm pb-3 last:border-b-0 last:pb-0">
                        <p className="text-sm font-medium text-ink">{deadline.title}</p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {club?.name ?? "Club"} · {formatDeadline(deadline.deadline_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-border-warm pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
                Signals
              </p>
              <div className="mt-3">
                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                {(profile?.skills ?? []).slice(0, 6).map((skill: string) => (
                  <span
                    key={skill}
                    className="rounded-full border border-border-warm bg-white px-3 py-1 text-xs font-medium text-ink"
                  >
                    {skill}
                  </span>
                ))}
                {(profile?.skills ?? []).length === 0 ? (
                  <span className="text-sm text-ink-muted">Add skills clubs can scan fast.</span>
                ) : null}
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.16em] text-ink-muted">Interests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile?.interests ?? []).slice(0, 6).map((interest: string) => (
                    <span
                      key={interest}
                      className="rounded-full border border-border-warm bg-brand-oxblood-soft px-3 py-1 text-xs font-medium text-brand-oxblood"
                    >
                      {interest}
                    </span>
                  ))}
                  {(profile?.interests ?? []).length === 0 ? (
                    <span className="text-sm text-ink-muted">Add interests to shape discovery later.</span>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        </aside>

        <form
          className="rounded-[1.5rem] border border-border-warm bg-[#f7f5f2] p-5 sm:p-6"
          action={updateProfile}
        >
          <FormSection
            eyebrow="Identity"
            title="Core details"
            description="Start with the information people need to place you quickly."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="full_name">
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  defaultValue={profile?.full_name ?? ""}
                  placeholder="Alex Morgan"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Campus involvements" htmlFor="campus_involvement" hint="Keep this short, like a positioning line.">
                <input
                  id="campus_involvement"
                  name="campus_involvement"
                  type="text"
                  defaultValue={profile?.campus_involvement ?? ""}
                  placeholder="Atlas Digital, MHacks, Michigan Daily"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Year" htmlFor="year">
                <select
                  id="year"
                  name="year"
                  defaultValue={profile?.year ?? ""}
                  className={INPUT_CLASS}
                >
                  {YEAR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Major" htmlFor="major">
                <input
                  id="major"
                  name="major"
                  type="text"
                  defaultValue={profile?.major ?? ""}
                  placeholder="Computer Science"
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Materials"
            title="Photo and links"
            description="Upload your photo and resume here, then keep your public links current."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileUploadField
                id="headshot_file"
                name="headshot_file"
                label="Profile photo"
                accept="image/png,image/jpeg,image/webp"
                hint="PNG, JPG, or WEBP"
                currentHref={profile?.headshot_url ?? null}
                currentLabel="View current"
                emptyLabel="No photo uploaded"
              />
              <ProfileUploadField
                id="resume_file"
                name="resume_file"
                label="Resume"
                accept="application/pdf"
                hint="PDF only"
                currentHref={profile?.resume_url ?? null}
                currentLabel="View current"
                emptyLabel="No resume uploaded"
              />
              <Field label="LinkedIn URL" htmlFor="linkedin_url">
                <input
                  id="linkedin_url"
                  name="linkedin_url"
                  type="url"
                  defaultValue={profile?.linkedin_url ?? ""}
                  placeholder="https://linkedin.com/in/..."
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Portfolio URL" htmlFor="portfolio_url">
                <input
                  id="portfolio_url"
                  name="portfolio_url"
                  type="url"
                  defaultValue={profile?.portfolio_url ?? ""}
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Signals"
            title="Interests and skills"
            description="Use comma-separated lists so your profile stays easy to scan and easy to update."
          >
            <div className="space-y-4">
              <Field label="Interests" htmlFor="interests" hint="Example: consulting, product, healthcare, startups">
                <input
                  id="interests"
                  name="interests"
                  type="text"
                  defaultValue={interestsValue}
                  placeholder="music, entrepreneurship, design"
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Skills" htmlFor="skills" hint="Example: Figma, Python, public speaking, financial modeling">
                <input
                  id="skills"
                  name="skills"
                  type="text"
                  defaultValue={skillsValue}
                  placeholder="Python, strategy, React, case interviews"
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </FormSection>

          <div className="mt-6 flex items-center justify-between border-t border-border-warm pt-4">
            <p className="text-sm text-ink-muted">
              Save changes to update your profile preview.
            </p>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-control bg-brand-action px-5 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-[#1F2937]"
            >
              Save profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full rounded-[0.95rem] border border-border-warm bg-white px-3.5 py-3 text-sm text-ink placeholder:text-ink-muted/60 outline-none transition-[var(--transition-interact)] focus:border-brand-action focus:ring-1 focus:ring-brand-action/20";

function getRecord<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDeadline(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

function LinkTag({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-border-warm bg-white px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-brand-oxblood/20 hover:text-brand-oxblood"
    >
      {label} ↗
    </a>
  );
}

function FormSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-warm py-5 first:border-t-0 first:pt-0 last:pb-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[2rem] leading-tight tracking-[-0.04em] text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}
