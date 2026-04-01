import { requirePortalAdmin } from "@/lib/portal";

import { updateClubSettings } from "./actions";

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
  const { club } = await requirePortalAdmin(slug);
  const { message, error } = await searchParams;

  const tags = Array.isArray(club.tags) ? club.tags.join(", ") : "";
  const targetYears = new Set(Array.isArray(club.target_years) ? club.target_years : []);

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

      {/* Public info section */}
      <div className="rounded-card border border-border bg-white p-6 shadow-card">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-ink">Club settings</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Manage the public information students see on your club page.
          </p>
        </div>

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
              className="inline-flex items-center justify-center rounded-control bg-brand-action px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1F2937]"
            >
              Save settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
