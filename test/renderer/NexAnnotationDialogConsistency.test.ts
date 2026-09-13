import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

/**
 * The annotation dialogs are one family and have to read like one.
 *
 * Seven of them were written in sequence, each copying the last, and each drifting a little: two
 * namings for the same pair of scopes, two focus treatments, three ways to size a list, the console
 * palette used for a form error. They open one on top of another — the label editor over the label
 * list, the delete confirmation over that — so the drift is visible in a single glance.
 *
 * These assert the conventions over the *folder* rather than over the dialogs someone remembered to
 * check, which is the only way an eighth dialog inherits them.
 */

const DIALOG_DIR = join(
  process.cwd(),
  "src/renderer/appIde/DocumentPanels/Next"
);

/** Blanks comments, so prose describing a rule cannot satisfy or violate it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function dialogFiles(extension: string): { name: string; text: string }[] {
  return readdirSync(DIALOG_DIR)
    .filter((file) => /^Nex.*Dialog\./.test(file) && file.endsWith(extension))
    .map((file) => ({ name: file, text: code(readFileSync(join(DIALOG_DIR, file), "utf8")) }));
}

describe("NEX annotation dialogs", () => {
  it("all use the app's single focus treatment", () => {
    // --- `:focus` lights a ring on every mouse click; `focus-ring` is `:focus-visible`.
    const offenders = dialogFiles(".module.scss")
      .filter(({ text }) => /&:focus\s*\{/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("all size their lists and previews to a stated height", () => {
    /*
     * A `max-height` box grows and shrinks with whatever the search or filter matched, which moves
     * the footer and resizes the dialog under the pointer. Every one of these is a viewport now.
     */
    const offenders = dialogFiles(".module.scss")
      .filter(({ text }) => /max-height\s*:/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("keep the console's ANSI palette out of dialog chrome", () => {
    // --- `--console-ansi-*` is a fixed external contract for program output, not a semantic.
    const offenders = dialogFiles(".module.scss")
      .filter(({ text }) => text.includes("--console-ansi"))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("name the two label scopes the same way everywhere", () => {
    /*
     * "Local to Bank 5" in the editor against "Bank 5" in the list was one pair of concepts under
     * two names, in two dialogs that stack on each other.
     */
    const offenders = dialogFiles(".tsx")
      .filter(({ text }) => /Local to Bank|Create Local Label|Local Label/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("use the app's dropdown rather than a bare select", () => {
    const offenders = dialogFiles(".tsx")
      .filter(({ text }) => /<select[\s>]/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("draw their footer with the shared band", () => {
    /*
     * Each dialog used to carry its own copy of the band, breaking out of the body's padding with a
     * hardcoded `-20px` against a body that pads with `var(--space-4)` — 16px — so every one of them
     * overhung by 4px a side.
     */
    const withFooter = dialogFiles(".tsx").filter(({ text }) => text.includes("DialogFooter"));
    expect(withFooter.length).toBeGreaterThan(0);

    const offenders = dialogFiles(".module.scss")
      .filter(({ text }) => /\.footer\s*\{/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  /*
   * The five rules below were added in Phase 41, and each one was red across the whole family when
   * it was written. They cover the drift the original six did not: the family was written in
   * sequence, each dialog copying the last, so every defect here appeared seven times.
   */

  it("size their type from the scale, never in `em`", () => {
    // --- M1. This folder held 19 of the 54 `em` font sizes that existed when the mandate finally
    // --- got a test — better than a third of them, in code written years after the rule.
    const offenders = dialogFiles(".module.scss")
      .filter(({ text }) => /font-size\s*:\s*[^;{}]*?[\d.]+em\b/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("use the app's text input and radio group rather than bare form controls", () => {
    /*
     * `<textarea>` is deliberately not covered.
     *
     * There is no shared multi-line control — `TextInput` is single-line, and pressing one into
     * service for `NexSynopsisCommentDialog`'s comment body would be a functional regression to
     * satisfy a lint. The one textarea in this folder still gets its border, its type size and its
     * focus treatment from the rules above, which is what the reader actually sees. Building a
     * shared `TextArea` is the real fix and is recorded in the batch-2 plan rather than smuggled in
     * here.
     */
    const offenders = dialogFiles(".tsx")
      .filter(({ text }) => /<input[\s>]/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("give their fields a border", () => {
    /*
     * `border: none` over `--bgcolor-input` is the exact case `--border-input` was introduced for:
     * `--bgcolor-input` is `--surface-raised`, which is `#ffffff` in the light tone, so a
     * borderless field on a white dialog body is not a field at all — it is invisible.
     */
    const offenders = dialogFiles(".module.scss")
      .filter(({ text }) => /border\s*:\s*none/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("distinguish the committing button from the ones beside it", () => {
    /*
     * `Button`'s default is the filled accent. These seven are the only dialogs in the app that
     * draw their own footer (via `DialogFooter`) instead of the shell's, so they are the only ones
     * that lost the primary/secondary distinction `DialogForm` and `Modal` apply for free — every
     * footer here was two or more identical filled primaries, saying nothing about which one
     * commits. See the doc comment on `Button`'s `variant`.
     */
    const offenders = dialogFiles(".tsx")
      .filter(({ text }) => text.includes("<Button") && !text.includes('variant="secondary"'))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });

  it("announce their validation errors", () => {
    /*
     * An error rendered into a plain `<div>` is never spoken: a screen-reader user submits, nothing
     * is announced, and the dialog appears to have ignored them. `BreakpointDialog` and
     * `DialogField` both get this right.
     */
    const offenders = dialogFiles(".tsx")
      .filter(({ text }) => /styles\.error/.test(text) && !/role=["']alert["']/.test(text))
      .map(({ name }) => name);
    expect(offenders).toEqual([]);
  });
});
