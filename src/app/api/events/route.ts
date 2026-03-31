import { createClient } from "@/lib/supabase/server";

const ALLOWED_EVENT_TYPES = new Set([
  "view",
  "click",
  "follow",
  "unfollow",
  "apply",
  "native_apply",
  "search",
  "filter",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    // Ignore anonymous event pings without surfacing auth errors in client logs.
    return Response.json({ ok: true });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return Response.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const eventType =
    typeof payload.eventType === "string" ? payload.eventType.trim() : "";
  const clubId =
    typeof payload.clubId === "string" && payload.clubId.trim().length > 0
      ? payload.clubId.trim()
      : null;
  const metadata = isRecord(payload.metadata) ? payload.metadata : {};

  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return Response.json({ error: "Unsupported event type" }, { status: 400 });
  }

  const { error } = await supabase.from("events").insert({
    user_id: authData.user.id,
    club_id: clubId,
    event_type: eventType,
    metadata,
  });

  if (error) {
    return Response.json({ error: "Failed to store event" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
