import type { SupabaseClient } from "@supabase/supabase-js";

import { createServiceClient } from "@/lib/supabase/service";
import { sendDeadlineReminder, type DeadlineItem } from "@/lib/email";

const REMINDER_OFFSETS = [1, 3, 7] as const;

type DueReminderRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  deadline_id: string;
  club_name: string;
  club_slug: string;
  deadline_title: string;
  deadline_at: string;
  reminder_offset_days: number;
};

type UserDeadlineBundle = {
  userId: string;
  email: string;
  name: string;
  deadlines: DeadlineItem[];
  rows: DueReminderRow[];
};

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

type ReminderLogRow = {
  user_id: string;
  deadline_id: string;
  reminder_offset_days: number;
  sent_at: string;
};

function reminderKey(row: Pick<DueReminderRow, "user_id" | "deadline_id" | "reminder_offset_days">) {
  return `${row.user_id}:${row.deadline_id}:${row.reminder_offset_days}`;
}

async function handleReminderRequest(request: Request): Promise<Response> {
  // Verify shared secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const dueRows = await fetchDueReminderRows(supabase);
  if (dueRows.length === 0) {
    return Response.json({
      sent_users: 0,
      failed_users: 0,
      skipped_already_sent: 0,
      due_rows: 0,
    });
  }

  const dedupedRows = await removeAlreadySentRows(supabase, dueRows);
  if (dedupedRows.length === 0) {
    return Response.json({
      sent_users: 0,
      failed_users: 0,
      skipped_already_sent: dueRows.length,
      due_rows: dueRows.length,
    });
  }

  const bundles = groupRowsByUser(dedupedRows);
  const sentLogRows: ReminderLogRow[] = [];

  const results = await Promise.allSettled(bundles.map(async (bundle) => {
    const result = await sendDeadlineReminder(bundle.email, bundle.name, bundle.deadlines);
    if (!result.error) {
      const sentAt = new Date().toISOString();
      for (const row of bundle.rows) {
        sentLogRows.push({
          user_id: row.user_id,
          deadline_id: row.deadline_id,
          reminder_offset_days: row.reminder_offset_days,
          sent_at: sentAt,
        });
      }
    }
    return result;
  }));

  if (sentLogRows.length > 0) {
    const { error: logError } = await supabase
      .from("deadline_reminder_sends")
      .upsert(sentLogRows, {
        onConflict: "user_id,deadline_id,reminder_offset_days",
        ignoreDuplicates: true,
      });
    if (logError) {
      console.error("deadline-reminders: failed to persist send logs", logError.message);
    }
  }

  const sentUsers = results.filter((result) => result.status === "fulfilled" && !result.value.error)
    .length;
  const failedUsers = results.length - sentUsers;

  if (failedUsers > 0) {
    console.error(`deadline-reminders: ${failedUsers} user bundle(s) failed`);
  }

  return Response.json({
    sent_users: sentUsers,
    failed_users: failedUsers,
    skipped_already_sent: dueRows.length - dedupedRows.length,
    due_rows: dueRows.length,
  });
}

async function fetchDueReminderRows(supabase: SupabaseClient): Promise<DueReminderRow[]> {
  const { data, error } = await supabase.rpc("get_due_deadline_reminders", {
    p_offsets: [...REMINDER_OFFSETS],
  });

  if (!error) {
    return (data ?? []) as DueReminderRow[];
  }

  return fetchDueReminderRowsFallback(supabase);
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const deadline = new Date(dateStr);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function fetchDueReminderRowsFallback(supabase: SupabaseClient): Promise<DueReminderRow[]> {
  const cutoff = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deadlinesData } = await supabase
    .from("club_deadlines")
    .select("id, title, deadline_at, club_id")
    .eq("is_active", true)
    .gt("deadline_at", new Date().toISOString())
    .lte("deadline_at", cutoff)
    .order("deadline_at");

  const deadlines = (deadlinesData ?? []) as DeadlineRow[];
  if (deadlines.length === 0) {
    return [];
  }

  const clubIds = [...new Set(deadlines.map((deadline) => deadline.club_id))];
  const { data: clubsData } = await supabase
    .from("clubs")
    .select("id, name, slug")
    .in("id", clubIds);
  const clubs = (clubsData ?? []) as ClubRow[];
  const clubMap = new Map(clubs.map((club) => [club.id, club]));

  const { data: followsData } = await supabase
    .from("user_follows")
    .select("user_id, club_id")
    .in("club_id", clubIds);
  const follows = (followsData ?? []) as FollowRow[];
  if (follows.length === 0) {
    return [];
  }

  const userIds = [...new Set(follows.map((follow) => follow.user_id))];
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", userIds);
  const profiles = (profilesData ?? []) as ProfileRow[];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const deadlinesByClub = new Map<string, DeadlineRow[]>();
  for (const deadline of deadlines) {
    const current = deadlinesByClub.get(deadline.club_id) ?? [];
    current.push(deadline);
    deadlinesByClub.set(deadline.club_id, current);
  }

  const rows: DueReminderRow[] = [];
  for (const follow of follows) {
    const profile = profileMap.get(follow.user_id);
    const club = clubMap.get(follow.club_id);
    if (!profile?.email || !club) {
      continue;
    }

    const clubDeadlines = deadlinesByClub.get(follow.club_id) ?? [];
    for (const deadline of clubDeadlines) {
      const offset = daysUntil(deadline.deadline_at);
      if (!REMINDER_OFFSETS.includes(offset as (typeof REMINDER_OFFSETS)[number])) {
        continue;
      }

      rows.push({
        user_id: follow.user_id,
        email: profile.email,
        full_name: profile.full_name,
        deadline_id: deadline.id,
        club_name: club.name,
        club_slug: club.slug,
        deadline_title: deadline.title,
        deadline_at: deadline.deadline_at,
        reminder_offset_days: offset,
      });
    }
  }

  return rows;
}

async function removeAlreadySentRows(
  supabase: SupabaseClient,
  rows: DueReminderRow[],
): Promise<DueReminderRow[]> {
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const deadlineIds = [...new Set(rows.map((row) => row.deadline_id))];

  const { data: sentRows } = await supabase
    .from("deadline_reminder_sends")
    .select("user_id, deadline_id, reminder_offset_days")
    .in("user_id", userIds)
    .in("deadline_id", deadlineIds)
    .in("reminder_offset_days", [...REMINDER_OFFSETS]);

  const sentKeys = new Set(
    (sentRows ?? []).map((row) =>
      reminderKey({
        user_id: row.user_id as string,
        deadline_id: row.deadline_id as string,
        reminder_offset_days: row.reminder_offset_days as number,
      }),
    ),
  );

  return rows.filter((row) => !sentKeys.has(reminderKey(row)));
}

function groupRowsByUser(rows: DueReminderRow[]): UserDeadlineBundle[] {
  const byUser = new Map<string, UserDeadlineBundle>();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, {
        userId: row.user_id,
        email: row.email,
        name: row.full_name ?? "",
        deadlines: [],
        rows: [],
      });
    }

    const bundle = byUser.get(row.user_id)!;
    bundle.deadlines.push({
      club_name: row.club_name,
      club_slug: row.club_slug,
      deadline_title: row.deadline_title,
      deadline_at: row.deadline_at,
    });
    bundle.rows.push(row);
  }

  for (const bundle of byUser.values()) {
    bundle.deadlines.sort(
      (a, b) => new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime(),
    );
  }

  return Array.from(byUser.values());
}

export async function POST(request: Request): Promise<Response> {
  return handleReminderRequest(request);
}

export async function GET(request: Request): Promise<Response> {
  return handleReminderRequest(request);
}
