import assert from "node:assert/strict";
import test from "node:test";

import { parseCsv } from "@/lib/csv";

test("parseCsv handles quoted commas, escaped quotes, and multiline cells", () => {
  const input = [
    "full_name,email,notes",
    "\"Jane Doe\",jane@umich.edu,\"Line one",
    "Line two with \"\"quotes\"\" and commas, too\"",
  ].join("\n");

  const { headers, rows } = parseCsv(input);

  assert.deepEqual(headers, ["full_name", "email", "notes"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].full_name, "Jane Doe");
  assert.equal(rows[0].email, "jane@umich.edu");
  assert.equal(rows[0].notes, "Line one\nLine two with \"quotes\" and commas, too");
});

test("parseCsv normalizes header casing and trims values", () => {
  const input = [
    " Full_Name , EMAIL , Year ",
    "  Alex Morgan  , alex@umich.edu , Junior ",
  ].join("\n");

  const { headers, rows } = parseCsv(input);

  assert.deepEqual(headers, ["full_name", "email", "year"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].full_name, "Alex Morgan");
  assert.equal(rows[0].email, "alex@umich.edu");
  assert.equal(rows[0].year, "Junior");
});
