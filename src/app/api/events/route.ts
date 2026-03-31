import { createClient } from "@/lib/supabase/server";
import { createEventInsert, isEventType } from "@/lib/events";

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

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return Response.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const record = payload as Record<string, unknown>;
  const eventType =
    typeof record.eventType === "string" ? record.eventType.trim() : "";
  const clubId =
    typeof record.clubId === "string" && record.clubId.trim().length > 0
      ? record.clubId.trim()
      : null;
  const metadata = "metadata" in record ? record.metadata : {};

  if (!isEventType(eventType)) {
    return Response.json({ error: "Unsupported event type" }, { status: 400 });
  }

  let eventInsert;
  try {
    eventInsert = createEventInsert({
      userId: authData.user.id,
      clubId,
      eventType,
      metadata,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid event metadata" },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("events").insert(eventInsert);

  if (error) {
    return Response.json({ error: "Failed to store event" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
