/*
 * RFC 4180 cells and rows for the exported trace (`.plans/TRACE_EXPORT_PLAN.md` D1, T6): comma
 * separated, `"`-quoted, CRLF line ends (the caller joins the rows). Pure.
 */

/** The characters a spreadsheet takes as the start of a formula (OWASP's CSV injection list) */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One cell. Text is always quoted, with `"` doubled, and a text that a spreadsheet would run as a
 * formula gets a leading `'` (T6). A numeric cell is written bare, so a spreadsheet parses it as a
 * number - a negative number is not a formula.
 * @param value The cell's value; undefined is an empty cell
 * @param numeric Whether the column holds numbers
 */
export function csvCell(value: string | number | undefined, numeric = false): string {
  if (value === undefined || value === "") return "";
  if (numeric && typeof value === "number") return String(value);
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** One row of already formatted cells */
export function csvRow(cells: readonly string[]): string {
  return cells.join(",");
}
