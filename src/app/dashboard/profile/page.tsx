import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";
import ResumeUpload from "./ResumeUpload";

const YEAR_OPTIONS = [
  { value: "", label: "Select year" },
  { value: "Freshman", label: "Freshman" },
  { value: "Sophomore", label: "Sophomore" },
  { value: "Junior", label: "Junior" },
  { value: "Senior", label: "Senior" },
  { value: "Graduate", label: "Graduate" },
];

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
    .select("full_name, year, major, interests, bio, phone, linkedin_url, resume_url")
    .eq("id", data.user.id)
    .single();

  const params = await searchParams;
  const message = typeof params.message === "string" ? params.message : null;
  const error = typeof params.error === "string" ? params.error : null;

  const interestsValue = Array.isArray(profile?.interests)
    ? profile.interests.join(", ")
    : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Update your personal information so clubs can learn more about you.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-lg flex flex-col gap-5">
        {/* Full name */}
        <div>
          <label
            htmlFor="full_name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            defaultValue={profile?.full_name ?? ""}
            placeholder="Your full name"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Year */}
        <div>
          <label
            htmlFor="year"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Year
          </label>
          <select
            id="year"
            name="year"
            defaultValue={profile?.year ?? ""}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {YEAR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Major */}
        <div>
          <label
            htmlFor="major"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Major
          </label>
          <input
            id="major"
            name="major"
            type="text"
            defaultValue={profile?.major ?? ""}
            placeholder="e.g. Computer Science"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Interests */}
        <div>
          <label
            htmlFor="interests"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Interests (comma-separated)
          </label>
          <input
            id="interests"
            name="interests"
            type="text"
            defaultValue={interestsValue}
            placeholder="e.g. music, entrepreneurship, design"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">
            Separate each interest with a comma.
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-slate-700 mb-1">
            Bio
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={profile?.bio ?? ""}
            placeholder="Tell clubs a bit about yourself"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
            placeholder="(555) 123-4567"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* LinkedIn URL */}
        <div>
          <label htmlFor="linkedin_url" className="block text-sm font-medium text-slate-700 mb-1">
            LinkedIn URL
          </label>
          <input
            id="linkedin_url"
            name="linkedin_url"
            type="url"
            defaultValue={profile?.linkedin_url ?? ""}
            placeholder="https://linkedin.com/in/your-profile"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="pt-1">
          <button
            type="submit"
            formAction={updateProfile}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Save changes
          </button>
        </div>
      </form>

      <ResumeUpload
        userId={data.user.id}
        currentResumePath={profile?.resume_url ?? null}
      />
    </div>
  );
}
