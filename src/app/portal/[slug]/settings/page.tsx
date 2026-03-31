import { requirePortalAdmin } from "@/lib/portal";

import { updateClubSettings } from "./actions";

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

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900">Club settings</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage the public information students see on your club page.
        </p>
      </div>

      {message ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <form className="grid gap-5 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
            Club name
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={club.name}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={club.description ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-slate-700">
            Category
          </label>
          <input
            id="category"
            name="category"
            defaultValue={club.category ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="tags" className="mb-1 block text-sm font-medium text-slate-700">
            Tags
          </label>
          <input
            id="tags"
            name="tags"
            defaultValue={tags}
            placeholder="consulting, entrepreneurship, design"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="website_url" className="mb-1 block text-sm font-medium text-slate-700">
            Website URL
          </label>
          <input
            id="website_url"
            name="website_url"
            defaultValue={club.website_url ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="instagram_url" className="mb-1 block text-sm font-medium text-slate-700">
            Instagram URL
          </label>
          <input
            id="instagram_url"
            name="instagram_url"
            defaultValue={club.instagram_url ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="contact_email" className="mb-1 block text-sm font-medium text-slate-700">
            Contact email
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            defaultValue={club.contact_email ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="recruiting_status" className="mb-1 block text-sm font-medium text-slate-700">
            Recruiting status
          </label>
          <select
            id="recruiting_status"
            name="recruiting_status"
            defaultValue={club.recruiting_status}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="unknown">Unknown</option>
            <option value="open">Open</option>
            <option value="rolling">Rolling</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div>
          <label htmlFor="application_mode" className="mb-1 block text-sm font-medium text-slate-700">
            Application mode
          </label>
          <select
            id="application_mode"
            name="application_mode"
            defaultValue={club.application_mode}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="none">No application</option>
            <option value="external">External application</option>
            <option value="native">Native Rush application</option>
          </select>
        </div>

        <div className="lg:col-span-2">
          <label htmlFor="application_url" className="mb-1 block text-sm font-medium text-slate-700">
            External application URL
          </label>
          <input
            id="application_url"
            name="application_url"
            defaultValue={club.application_url ?? ""}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="lg:col-span-2">
          <button
            formAction={updateClubSettings.bind(null, slug)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
