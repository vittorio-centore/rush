import { TrackedLink } from "@/components/TrackedLink";
import { getDashboardRecommendations } from "@/lib/recommendations/server";
import RecommendationImpressionLogger from "./RecommendationImpressionLogger";

type Props = {
  userId: string;
};

const STATUS_BADGE: Record<string, string> = {
  open: "inline-flex items-center rounded-control bg-brand-oxblood-soft px-2.5 py-0.5 text-xs font-medium text-brand-oxblood",
  closed:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed",
  rolling:
    "inline-flex items-center rounded-control bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-status-interview",
  unknown:
    "inline-flex items-center rounded-control bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-status-closed",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  rolling: "Rolling",
  unknown: "Updates soon",
};

export default async function RecommendationRail({ userId }: Props) {
  const recommendations = await getDashboardRecommendations(userId, 6);

  if (recommendations.items.length === 0) {
    return null;
  }

  return (
    <section>
      <RecommendationImpressionLogger
        clubIds={recommendations.items.map((item) => item.id)}
        modelVersion={recommendations.modelVersion}
        strategy={recommendations.strategy}
      />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-oxblood">
            Recommended next
          </p>
          <h2 className="mt-2 text-2xl leading-tight tracking-[-0.03em] text-ink">
            Clubs worth opening now
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">
            Ranked from your profile, your recent actions, and active recruiting signals.
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">
          {recommendations.strategy}
        </p>
      </div>

      <div className="divide-y divide-border-warm border-y border-border-warm">
        {recommendations.items.map((club) => (
          <TrackedLink
            key={club.id}
            href={`/clubs/${club.slug ?? club.id}`}
            clubId={club.id}
            metadata={{
              surface: "dashboard_recommendations",
              target: "club_page",
              strategy: club.recommendation.strategy,
              model_version: club.recommendation.model_version,
              reason_code: club.recommendation.reason_code,
            }}
            className="grid gap-4 px-1 py-5 transition-colors hover:bg-white/60 lg:grid-cols-[0.8fr_1.2fr_0.6fr]"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-oxblood">
                #{club.recommendation.rank}
              </p>
              <h3 className="mt-2 text-lg font-medium text-ink">{club.name}</h3>
              {club.category ? (
                <p className="mt-1 text-sm text-ink-muted">{club.category}</p>
              ) : null}
            </div>

            <div>
              <p className="text-sm leading-7 text-ink">
                {club.recommendation.reason_text}
              </p>
              {club.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink-muted">
                  {club.description}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <span className={STATUS_BADGE[club.recruiting_status] ?? STATUS_BADGE.unknown}>
                {STATUS_LABELS[club.recruiting_status] ?? club.recruiting_status}
              </span>

              {Array.isArray(club.target_years) && club.target_years.length > 0 ? (
                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted lg:text-right">
                  {club.target_years.join(" · ")}
                </p>
              ) : null}

              {(club.tags ?? []).slice(0, 2).length > 0 ? (
                <div className="flex flex-wrap gap-1.5 lg:justify-end">
                  {(club.tags ?? []).slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border-warm bg-white px-2.5 py-1 text-[11px] font-medium text-ink-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </TrackedLink>
        ))}
      </div>
    </section>
  );
}
