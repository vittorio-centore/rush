import { getDashboardRecommendations } from "@/lib/recommendations/server";
import RecommendationImpressionLogger from "./RecommendationImpressionLogger";
import { TrackedLink } from "@/components/TrackedLink";

type Props = {
  userId: string;
};

const STATUS_BADGE: Record<string, string> = {
  open: "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20",
  closed: "inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 ring-1 ring-inset ring-red-500/20",
  rolling:
    "inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
  unknown:
    "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-400/20",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Status unknown",
};

export default async function RecommendationRail({ userId }: Props) {
  const recommendations = await getDashboardRecommendations(userId, 6);

  if (recommendations.items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-cyan-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.16),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(240,249,255,0.96))] p-6 shadow-sm">
      <RecommendationImpressionLogger
        clubIds={recommendations.items.map((item) => item.id)}
        modelVersion={recommendations.modelVersion}
        strategy={recommendations.strategy}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700/70">
            Recommended for you
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            Clubs worth looking at next
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Ranked from your Rush profile, recent behavior, and active recruiting signals.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Strategy: <span className="font-medium text-slate-700">{recommendations.strategy}</span>
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {recommendations.items.map((club) => (
          <TrackedLink
            key={club.id}
            href={`/clubs/${club.slug}`}
            clubId={club.id}
            metadata={{
              surface: "dashboard_recommendations",
              target: "club_page",
              strategy: club.recommendation.strategy,
              model_version: club.recommendation.model_version,
              reason_code: club.recommendation.reason_code,
            }}
            className="group flex h-full flex-col rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  #{club.recommendation.rank}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{club.name}</h3>
              </div>
              <span
                className={
                  STATUS_BADGE[club.recruiting_status] ?? STATUS_BADGE.unknown
                }
              >
                {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
              </span>
            </div>

            {club.category ? (
              <p className="mt-2 text-xs font-medium text-slate-500">{club.category}</p>
            ) : null}

            {club.description ? (
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                {club.description}
              </p>
            ) : null}

            {Array.isArray(club.target_years) && club.target_years.length > 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                Best fit: <span className="font-medium text-slate-700">{club.target_years.join(", ")}</span>
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {(club.tags ?? []).slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[11px] font-medium text-cyan-700"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800/70">
                Why this showed up
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {club.recommendation.reason_text}
              </p>
            </div>
          </TrackedLink>
        ))}
      </div>
    </section>
  );
}
