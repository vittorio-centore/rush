type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const EVENT_TYPES = [
  "view",
  "click",
  "follow",
  "unfollow",
  "apply_add",
  "apply",
  "native_apply",
  "search",
  "filter",
  "recommendation_impression",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

type EventInsert = {
  user_id: string;
  club_id: string | null;
  event_type: EventType;
  metadata: Record<string, JsonValue>;
};

const EVENT_TYPE_SET = new Set<EventType>(EVENT_TYPES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  metadata: Record<string, unknown>,
  key: string,
  required = false,
): string | null {
  const value = metadata[key];

  if (typeof value !== "string") {
    if (required) {
      throw new Error(`Missing metadata field: ${key}`);
    }
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    if (required) {
      throw new Error(`Missing metadata field: ${key}`);
    }
    return null;
  }

  return trimmed;
}

function readNullableString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid metadata field: ${key}`);
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function readNumber(
  metadata: Record<string, unknown>,
  key: string,
  required = false,
): number | null {
  const value = metadata[key];
  if (value === null || value === undefined) {
    if (required) {
      throw new Error(`Missing metadata field: ${key}`);
    }
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid metadata field: ${key}`);
  }

  return value;
}

function readStringArray(
  metadata: Record<string, unknown>,
  key: string,
  required = false,
): string[] {
  const value = metadata[key];

  if (value === null || value === undefined) {
    if (required) {
      throw new Error(`Missing metadata field: ${key}`);
    }
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Invalid metadata field: ${key}`);
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function copyOptionalStrings(
  metadata: Record<string, unknown>,
  keys: string[],
): Record<string, JsonValue> {
  const output: Record<string, JsonValue> = {};

  for (const key of keys) {
    if (!(key in metadata)) {
      continue;
    }

    const value = metadata[key];
    if (value === null) {
      output[key] = null;
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      output[key] = trimmed || null;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      output[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      output[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      output[key] = value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return output;
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && EVENT_TYPE_SET.has(value as EventType);
}

export function normalizeEventMetadata(
  eventType: EventType,
  metadata: unknown,
): Record<string, JsonValue> {
  const source = isRecord(metadata) ? metadata : {};

  switch (eventType) {
    case "view":
      return {
        surface: readString(source, "surface", true),
        ...copyOptionalStrings(source, ["referrer_surface", "strategy", "model_version"]),
      };
    case "click":
      return {
        surface: readString(source, "surface", true),
        target: readString(source, "target", true),
        ...copyOptionalStrings(source, ["strategy", "model_version", "reason_code"]),
      };
    case "search":
      return {
        surface: readString(source, "surface", true),
        query: readString(source, "query", true),
        result_count: readNumber(source, "result_count", true) ?? 0,
      };
    case "filter":
      return {
        surface: readString(source, "surface", true),
        category: readNullableString(source, "category"),
        tag: readNullableString(source, "tag"),
        status: readNullableString(source, "status"),
      };
    case "recommendation_impression":
      return {
        surface: readString(source, "surface", true),
        model_version: readString(source, "model_version", true),
        strategy: readString(source, "strategy", true),
        club_ids: readStringArray(source, "club_ids", true),
      };
    case "follow":
    case "unfollow":
    case "apply_add":
    case "apply":
    case "native_apply":
      return copyOptionalStrings(source, ["surface", "source", "strategy", "model_version"]);
  }
}

export function createEventInsert(input: {
  userId: string;
  clubId?: string | null;
  eventType: EventType;
  metadata?: unknown;
}): EventInsert {
  return {
    user_id: input.userId,
    club_id: input.clubId?.trim() || null,
    event_type: input.eventType,
    metadata: normalizeEventMetadata(input.eventType, input.metadata),
  };
}

export async function insertEvent(
  supabase: {
    from: (table: string) => {
      insert: (payload: unknown) => unknown;
    };
  },
  input: Parameters<typeof createEventInsert>[0],
) {
  const payload = createEventInsert(input);
  return Promise.resolve(supabase.from("events").insert(payload));
}

export async function postBrowserEvent(input: {
  eventType: EventType;
  clubId?: string | null;
  metadata?: unknown;
}) {
  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error(`Event request failed with status ${response.status}`);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Event logging failed", error);
    }
  }
}
