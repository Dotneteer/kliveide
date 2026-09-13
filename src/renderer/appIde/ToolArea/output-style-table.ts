import type { OutputSpan } from "./abstractions";

/**
 * Interning console span styles into small integer ids.
 *
 * A console line is a run of spans, and the renderer turns each span's six style fields into a
 * `CSSProperties` object. It did that **per span, per render** — a fresh object literal every time,
 * so React saw a new `style` prop on every span of every visible row even when nothing about the
 * styling had changed.
 *
 * The set of *distinct* styles in a console is tiny: sixteen foregrounds, sixteen backgrounds and
 * four attribute bits, of which real output uses a couple of dozen combinations. So the style is
 * resolved once, at write time, into an id the renderer can memoise against.
 *
 * The table is module-level rather than per-buffer on purpose. Ids have to mean the same thing in
 * every buffer, because the renderer's memo cache is shared across the four panels — a per-buffer
 * counter would make id 3 mean "red" in the Output pane and "bold cyan" in the Command pane, and
 * the panels would paint each other's colours.
 *
 * Growth is bounded by the number of distinct combinations, not by the volume of output: a 64K
 * disassembly interns a handful of ids and then only ever looks them up.
 */

/** The style-bearing fields of a span — everything `ConsoleOutput.spanStyle` reads. */
type SpanStyle = Pick<
  OutputSpan,
  "foreground" | "background" | "isBold" | "isItalic" | "isUnderline" | "isStrikeThru"
>;

const ids = new Map<string, number>();

/** Key on the *resolved* fields, so two spans that will paint identically share an id. */
const keyOf = (style: SpanStyle): string =>
  `${style.foreground ?? ""}|${style.background ?? ""}|${style.isBold ? 1 : 0}${
    style.isItalic ? 1 : 0
  }${style.isUnderline ? 1 : 0}${style.isStrikeThru ? 1 : 0}`;

/**
 * Returns the id for a style combination, allocating one the first time it is seen.
 *
 * Ids start at 0 and are stable for the lifetime of the renderer process.
 */
export function internStyle(style: SpanStyle): number {
  const key = keyOf(style);
  let id = ids.get(key);
  if (id === undefined) {
    id = ids.size;
    ids.set(key, id);
  }
  return id;
}

/** Number of distinct styles interned so far. Exists for tests and diagnostics. */
export function internedStyleCount(): number {
  return ids.size;
}
