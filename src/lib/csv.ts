import { parse } from "csv-parse/sync";

export type CsvRow = Record<string, string>;

export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeCell(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function parseHeaders(text: string): string[] {
  const parsed = parse(text, {
    bom: true,
    to_line: 1,
    relax_column_count: true,
    trim: true,
    skip_empty_lines: true,
  }) as unknown[][];

  const headerRow = parsed[0] ?? [];
  return headerRow
    .map(normalizeHeader)
    .filter((header) => header.length > 0);
}

export function parseCsv(text: string): ParsedCsv {
  const headers = parseHeaders(text);
  if (headers.length === 0) {
    return { headers: [], rows: [] };
  }

  const records = parse(text, {
    bom: true,
    columns: headers,
    from_line: 2,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  const rows = records.map((record) => {
    const row: CsvRow = {};
    for (const header of headers) {
      row[header] = normalizeCell(record[header]);
    }
    return row;
  });

  return { headers, rows };
}
