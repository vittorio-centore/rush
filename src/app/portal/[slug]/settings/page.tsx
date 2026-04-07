import { getPortalCapabilities } from "@/lib/portal-features";
import { requirePortalAdmin } from "@/lib/portal";

import { addOfficer, removeOfficer, updateClubSettings, updateOfficerRole } from "./actions";

const YEAR_OPTIONS = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "Graduate",
] as const;

const INPUT_CLASS =
  "w-full rounded-control border border-border px-3 py-2 text-sm text-ink outline-none focus:border-brand-action focus:ring-1 focus:ring-brand-action";

export default async function PortalSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const { slug } = await params;
  const capabilities = await getPortalCapabilities(slug);
  const { club, supabase, user } = await requirePortalAdmin(slug);
  const { message, error } = await searchParams;

  const tags = Array.isArray(club.tags) ? club.tags.join(", ") : "";
  const targetYears = new Set(Array.isArray(club.target_years) ? club.target_years : []);
  const { data: memberships, error: membershipError } = await supabase
    .from("club_admin_memberships")
    .select("user_id, role, created_at")
    .eq("club_id", club.id)
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const memberIds = Array.from(new Set((memberships ?? []).map((membership) => membership.user_id)));
  const { data: profiles, error: profileError } = memberIds.length
    ? await supabase.from("profiles").select("id, email, full_name").in("id", memberIds)
    : { data: [], error: null };

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const adminCount = (memberships ?? []).filter((membership) => membership.role === "admin").length;

  return (
    <div className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-control border border-brand-oxblood/20 bg-brand-oxblood-soft px-4 py-3 text-sm text-brand-oxblood">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-sm text-status-rejected">
          {error}
        </div>
      ) : null}
      {!capabilities.formBuilder && club.application_mode === "native" ? (
        <div className="rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Native Rush applications are not available on this database yet. Keep this club on an
          external link or no-application flow until the recruiter portal migrations are applied.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Club settings
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Keep the public face accurate.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Update the club page, recruiting status, and application mode so students never
                have to guess what is current.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 capitalize">
                {club.recruiting_status} recruiting
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                {club.application_mode === "native"
                  ? "Native application"
                  : club.application_mode === "external"
                    ? "External application"
                    : "No application"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 sm:px-7">
          <form className="grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink-muted">
                Club name
              </label>
              <input id="name" name="name" required defaultValue={club.name} className={INPUT_CLASS} />
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={club.description ?? ""}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="category" className="mb-1 block text-sm font-medium text-ink-muted">
                Category
              </label>
              <input
                id="category"
                name="category"
                defaultValue={club.category ?? ""}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="tags" className="mb-1 block text-sm font-medium text-ink-muted">
                Tags
              </label>
              <input
                id="tags"
                name="tags"
                defaultValue={tags}
                placeholder="consulting, entrepreneurship, design"
                className={INPUT_CLASS}
              />
            </div>

            <div className="lg:col-span-2">
              <span className="mb-2 block text-sm font-medium text-ink-muted">Target years</span>
              <div className="flex flex-wrap gap-2">
                {YEAR_OPTIONS.map((year) => (
                  <label
                    key={year}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-cool px-3 py-1.5 text-sm text-ink transition-colors hover:bg-border"
                  >
                    <input
                      type="checkbox"
                      name="target_years"
                      value={year}
                      defaultChecked={targetYears.has(year)}
                      className="h-4 w-4 rounded border-border accent-brand-action"
                    />
                    {year}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                These values power year-fit recommendations. Leave blank if your club recruits all
                class years.
              </p>
            </div>

            <div>
              <label
                htmlFor="website_url"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Website URL
              </label>
              <input
                id="website_url"
                name="website_url"
                defaultValue={club.website_url ?? ""}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="instagram_url"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Instagram URL
              </label>
              <input
                id="instagram_url"
                name="instagram_url"
                defaultValue={club.instagram_url ?? ""}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="contact_email"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Contact email
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                defaultValue={club.contact_email ?? ""}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label
                htmlFor="recruiting_status"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Recruiting status
              </label>
              <select
                id="recruiting_status"
                name="recruiting_status"
                defaultValue={club.recruiting_status}
                className={INPUT_CLASS}
              >
                <option value="unknown">Unknown</option>
                <option value="open">Open</option>
                <option value="rolling">Rolling</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="application_mode"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                Application mode
              </label>
              <select
                id="application_mode"
                name="application_mode"
                defaultValue={club.application_mode}
                className={INPUT_CLASS}
              >
                <option value="none">No application</option>
                <option value="external">External application</option>
                <option value="native">Native Rush application</option>
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                Use native mode if you want students to apply inside Rush. Use external mode if your
                club collects applications elsewhere.
              </p>
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="application_url"
                className="mb-1 block text-sm font-medium text-ink-muted"
              >
                External application URL
              </label>
              <input
                id="application_url"
                name="application_url"
                defaultValue={club.application_url ?? ""}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-ink-muted">
                Leave blank for native Rush applications. Fill in for Google Forms or another external
                system.
              </p>
            </div>

            <div className="lg:col-span-2">
              <button
                formAction={updateClubSettings.bind(null, slug)}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Save settings
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Officer access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                Manage who can run this portal.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The first admin is approved from the platform claims inbox. After that, keep it
                simple: admins run recruiting, members use the shared club directory, and reviewers
                are optional if you want a read-only recruiting layer.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Active officers
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
                {memberships?.length ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7">
          <form className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_220px_auto] lg:items-end">
            <div>
              <label htmlFor="officer-email" className="mb-1 block text-sm font-medium text-ink-muted">
                Rush account email
              </label>
              <input
                id="officer-email"
                name="email"
                type="email"
                placeholder="officer@umich.edu"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="officer-role" className="mb-1 block text-sm font-medium text-ink-muted">
                Access level
              </label>
              <select id="officer-role" name="role" defaultValue="member" className={INPUT_CLASS}>
                <option value="member">Member</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                Members can use the club directory. Only admins can change recruiting settings and access.
              </p>
            </div>
            <div>
              <button
                formAction={addOfficer.bind(null, slug)}
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:bg-slate-800"
              >
                Add officer
              </button>
            </div>
          </form>
        </div>

        <div className="divide-y divide-slate-200/80">
          {memberships?.length ? (
            memberships.map((membership) => {
              const profile = profileMap.get(membership.user_id);
              const isSelf = membership.user_id === user.id;
              const isOnlyAdmin = membership.role === "admin" && adminCount <= 1;

              return (
                <div
                  key={membership.user_id}
                  className="flex flex-col gap-4 px-6 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-950">
                        {profile?.full_name ?? profile?.email ?? "Unknown officer"}
                      </p>
                      {isSelf ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          You
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{profile?.email ?? "No email found"}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                      {membership.role}
                    </span>

                    {membership.role === "admin" ? (
                      <>
                        <form>
                          <button
                            formAction={updateOfficerRole.bind(null, slug, membership.user_id, "reviewer")}
                            disabled={isOnlyAdmin}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Make reviewer
                          </button>
                        </form>
                        <form>
                          <button
                            formAction={updateOfficerRole.bind(null, slug, membership.user_id, "member")}
                            disabled={isOnlyAdmin}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Make member
                          </button>
                        </form>
                      </>
                    ) : (
                      <>
                        <form>
                          <button
                            formAction={updateOfficerRole.bind(null, slug, membership.user_id, "admin")}
                            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                          >
                            Make admin
                          </button>
                        </form>
                        {membership.role === "member" ? (
                          <form>
                            <button
                              formAction={updateOfficerRole.bind(null, slug, membership.user_id, "reviewer")}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                            >
                              Make reviewer
                            </button>
                          </form>
                        ) : (
                          <form>
                            <button
                              formAction={updateOfficerRole.bind(null, slug, membership.user_id, "member")}
                              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                            >
                              Make member
                            </button>
                          </form>
                        )}
                      </>
                    )}

                    <form>
                      <button
                        formAction={removeOfficer.bind(null, slug, membership.user_id)}
                        disabled={isOnlyAdmin}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-[var(--transition-interact)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-6 py-8 text-sm text-slate-600 sm:px-7">
              No officers found for this club yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
