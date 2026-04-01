export type SchemaErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export type ApplicationSource = "tracked" | "native" | "external_csv";

function containsColumnReference(error: SchemaErrorLike, column: string) {
  const haystack = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  const needle = column.toLowerCase();

  return (
    haystack.includes(needle) ||
    haystack.includes(`column ${needle}`) ||
    haystack.includes(`'${needle}'`) ||
    haystack.includes(`"${needle}"`)
  );
}

export function isMissingSchemaColumn(
  error: SchemaErrorLike | null | undefined,
  column: string,
) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    containsColumnReference(error, column)
  );
}

export function isMissingAnySchemaColumn(
  error: SchemaErrorLike | null | undefined,
  columns: string[],
) {
  return columns.some((column) => isMissingSchemaColumn(error, column));
}

export function normalizeApplicationSource(
  value: string | null | undefined,
): ApplicationSource {
  if (value === "native" || value === "external_csv" || value === "tracked") {
    return value;
  }

  return "tracked";
}

export function normalizeTargetYears(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const years = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  return years.length > 0 ? years : null;
}
