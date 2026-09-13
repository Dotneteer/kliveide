/**
 * Stripping ANSI/VT control sequences out of external tool output.
 *
 * Klive's console does not interpret escape sequences: colour is carried structurally on an
 * `OutputSpan`, set through the output-buffer API. So an escape sequence that reaches an output
 * buffer is not colour — it is literal garbage rendered in the middle of a compiler diagnostic,
 * and `OutputPaneBuffer.write` even NBSP-substitutes its spaces on the way in.
 *
 * The quieter damage is upstream of the display. `CliRunner.parseErrorMessage` matches each output
 * line against a per-compiler regex to recover the filename, line and column that become a
 * clickable navigation link. A colourised filename simply stops matching, and the diagnostic
 * silently loses its link — a failure with no error message anywhere to explain it.
 *
 * So the sequences are removed at the boundary, where the child's output enters Klive.
 */

/** `ESC` (0x1B) and `BEL` (0x07), named rather than embedded as raw control bytes in the source. */
const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);

/**
 * The three sequence families a colourising tool emits, per ECMA-48.
 *
 * - **CSI** — `ESC [`, parameter bytes `0x30-0x3F`, intermediate bytes `0x20-0x2F`, final byte
 *   `0x40-0x7E`. Written as the general grammar rather than as `ESC [ ... m`, so it also takes the
 *   cursor and erase sequences a progress indicator emits. Those are just as unreadable in a log
 *   that has no cursor to move.
 * - **OSC** — `ESC ]` up to a `BEL` or a String Terminator (`ESC \`). Window titles and `ESC ] 8`
 *   hyperlinks.
 * - **Everything else** — `ESC`, optional intermediate bytes `0x20-0x2F`, one final byte
 *   `0x30-0x7E`. This is the general escape-sequence grammar, which covers the private `ESC 7` /
 *   `ESC 8` cursor save-restore pair that a progress indicator uses. Note `0x37` is *below* the
 *   `0x40-0x5F` class the popular `ansi-regex` package uses here, so that pair survives it — hence
 *   the wider rule.
 *
 *   Listed last so that a well-formed CSI or OSC is consumed whole by an earlier alternative,
 *   rather than having only its two leading bytes taken and the remainder left as visible text.
 *
 * Built with `RegExp` rather than written as a literal because the pattern needs `ESC` itself, and
 * a raw 0x1B byte in a source file is invisible in review and easy for tooling to mangle.
 *
 * The 8-bit single-byte forms (CSI as `0x9B`) are deliberately not matched: execa decodes the
 * child's output as UTF-8, in which a bare `0x9B` is not a valid sequence start.
 */
const ANSI_SEQUENCE = new RegExp(
  [
    `${ESC}\\[[0-?]*[ -/]*[@-~]`,
    `${ESC}\\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`,
    `${ESC}[ -/]*[0-~]`
  ].join("|"),
  "g"
);

/**
 * Removes every ANSI/VT control sequence from `text`.
 *
 * `undefined` passes through, because the execa fields this is applied to (`stdout`, `stderr`,
 * `shortMessage`) are optional and a missing one must stay missing rather than become `""`.
 */
export function stripAnsi<T extends string | undefined>(text: T): T {
  return (typeof text === "string" ? text.replace(ANSI_SEQUENCE, "") : text) as T;
}
