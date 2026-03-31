import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/service";
import { sendDeadlineReminder, type DeadlineItem } from "@/lib/email";

export async function POST(request: Request): Promise<Response> {
  // Verify shared secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // The nested join structure is complex — use a flat query instead
  const { data: flatRows, error: flatError } = await supabase.rpc(
    "get_upcoming_deadline_reminders"
  );

  // Fallback: use a manual join approach if the RPC doesn't exist yet
  if (flatError) {
    return await sendViaManualJoin(supabase);
  }

  return await processFlatRows(flatRows ?? []);
}

type RpcRow = {
  email: string;
  full_name: string | null;
  club_name: string;
  club_slug: string;
  deadline_title: string;
  deadline_at: string;
};

async function processFlatRows(rows: RpcRow[]): Promise<Response> {
  // Group by email
  const byEmail = new Map<string, { name: string; deadlines: DeadlineItem[] }>();
  for (const row of rows) {
    if (!byEmail.has(row.email)) {
      byEmail.set(row.email, { name: row.full_name ?? "", deadlines: [] });
    }
    byEmail.get(row.email)!.deadlines.push({
      club_name: row.club_name,
      club_slug: row.club_slug,
      deadline_title: row.deadline_title,
      deadline_at: row.deadline_at,
    });
  }

  const results = await Promise.allSettled(
    Array.from(byEmail.entries()).map(([email, { name, deadlines }]) =>
      sendDeadlineReminder(email, name, deadlines)
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled" && !r.value.error).length;
  const failed = results.length - sent;

  if (failed > 0) {
    console.error(`deadline-reminders: ${failed} email(s) failed`);
  }

  return Response.json({ sent, failed });
}

type DeadlineRow = {
  id: string;
  title: string;
  deadline_at: string;
  club_id: string;
};

type ClubRow = {
  id: string;
  name: string;
  slug: string;
};

type FollowRow = {
  user_id: string;
  club_id: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
};

async function sendViaManualJoin(supabase: SupabaseClient): Promise<Response> {
  // Step 1: get all active deadlines in the next 14 days
  const { data: deadlines } = await supabase
    .from("club_deadlines")
    .select("id, title, deadline_at, club_id")
    .eq("is_active", true)
    .gt("deadline_at", new Date().toISOString())
    .lte("deadline_at", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
    .order("deadline_at");

  if (!deadlines || deadlines.length === 0) {
    return Response.json({ sent: 0, failed: 0 });
  }

  const typedDeadlines = deadlines as DeadlineRow[];
  const clubIds = [...new Set(typedDeadlines.map((deadline) => deadline.club_id))];

  // Step 2: get clubs
  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name, slug")
    .in("id", clubIds);

  const typedClubs = (clubs ?? []) as ClubRow[];
  const clubMap = new Map(typedClubs.map((club) => [club.id, club]));
  const deadlineMap = new Map<string, DeadlineRow[]>();

  for (const deadline of typedDeadlines) {
    const current = deadlineMap.get(deadline.club_id) ?? [];
    current.push(deadline);
    deadlineMap.set(deadline.club_id, current);
  }

  // Step 3: get follows for these clubs
  const { data: follows } = await supabase
    .from("user_follows")
    .select("user_id, club_id")
    .in("club_id", clubIds);

  if (!follows || follows.length === 0) {
    return Response.json({ sent: 0, failed: 0 });
  }

  const typedFollows = follows as FollowRow[];
  const userIds = [...new Set(typedFollows.map((follow) => follow.user_id))];

  // Step 4: get profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);

  const profileMap = new Map<string, ProfileRow>(
    (profiles ?? []).map((p: ProfileRow) => [p.id, p])
  );

  // Step 5: group deadlines by user
  const byUser = new Map<string, { email: string; name: string; deadlines: DeadlineItem[] }>();

  for (const follow of typedFollows) {
    const profile = profileMap.get(follow.user_id);
    if (!profile) continue;

    const club = clubMap.get(follow.club_id);
    if (!club) continue;

    const clubDeadlines = deadlineMap.get(follow.club_id) ?? [];

    if (!byUser.has(follow.user_id)) {
      byUser.set(follow.user_id, {
        email: profile.email,
        name: profile.full_name ?? "",
        deadlines: [],
      });
    }

    for (const d of clubDeadlines) {
      byUser.get(follow.user_id)!.deadlines.push({
        club_name: club.name,
        club_slug: club.slug,
        deadline_title: d.title,
        deadline_at: d.deadline_at,
      });
    }
  }

  // Deduplicate deadlines per user (a club could be followed and also appear multiple times)
  for (const entry of byUser.values()) {
    const seen = new Set<string>();
    entry.deadlines = entry.deadlines.filter((d) => {
      const key = `${d.club_slug}:${d.deadline_at}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    entry.deadlines.sort(
      (a, b) => new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
    );
  }

  const results = await Promise.allSettled(
    Array.from(byUser.values()).map(({ email, name, deadlines }) =>
      sendDeadlineReminder(email, name, deadlines)
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled" && !(r.value as { error: Error | null }).error).length;
  const failed = results.length - sent;

  return Response.json({ sent, failed });
}
