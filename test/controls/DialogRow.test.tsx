import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { DialogRow } from "@renderer/controls/DialogRow";

afterEach(() => {
  cleanup();
});

/**
 * `DialogRow` is the label-over-control unit twenty dialogs are built from, so its spacing is not a
 * detail of any one of them.
 *
 * It carried a `gap` separating a row's label from its own control, and nothing at all separating
 * one row from the next — so a label sat flush against the control above it and read as that
 * control's caption rather than as the next field's name. Most visible under a tall field, which is
 * where it was reported: "Comment" and "Preview" in the synopsis dialog, and most of the
 * end-of-line comment dialog.
 */
describe("DialogRow", () => {
  it("puts the label above its own control", () => {
    const { container } = render(
      <DialogRow label="Comment" rows={true}>
        <textarea defaultValue="" />
      </DialogRow>
    );

    const row = container.firstElementChild as HTMLElement;
    expect(row.children).toHaveLength(2);
    expect(row.children[0].textContent).toBe("Comment");
    expect(row.children[1].querySelector("textarea")).not.toBeNull();
  });

  /*
   * Asserted against the stylesheet: jsdom resolves every CSS-module rule to `auto`, so a
   * `getComputedStyle` check here would pass whatever the rule says. Same approach as
   * `row-size-contract.test.ts`.
   */
  it("separates consecutive rows without pushing the footer down", () => {
    const sheet = readFileSync(
      join(process.cwd(), "src/renderer/controls/DialogRow.module.scss"),
      "utf8"
    );

    // --- The gap inside a row stays: it is what binds a label to its control. 8px, and the same for
    // --- a row whose children stack (a prompt line over its field: Rename, New File)
    expect(sheet).toMatch(/\.dialogRow\s*\{[^}]*gap:\s*var\(--space-2\)/);
    expect(sheet).toMatch(/\.rows\s*\{[^}]*gap:\s*var\(--space-2\)/);

    /*
     * A *top* margin on all but the first. A bottom margin on every row would add space above the
     * footer, which brings its own; an adjacent-sibling selector would drop the separation wherever
     * something that is not a row sits between two — a validation message, a toolbar — and both of
     * those occur in the annotation dialogs.
     */
    expect(sheet).toMatch(/\.dialogRow:not\(:first-child\)\s*\{[^}]*margin-top:\s*var\(--space-3\)/);
    expect(sheet).not.toMatch(/\.dialogRow\s*\+\s*\.dialogRow/);
    expect(sheet).not.toMatch(/margin-bottom/);
  });

  it("puts a field's error under it, closer than its label, never on its border", () => {
    const input = readFileSync(join(process.cwd(), "src/renderer/controls/TextInput.module.scss"), "utf8");
    expect(input).toMatch(/\.error\s*\{[^}]*margin-top:\s*var\(--space-1_5\)/);
    const field = readFileSync(join(process.cwd(), "src/renderer/controls/DialogField.module.scss"), "utf8");
    expect(field).toMatch(/\.field\s*\{[^}]*gap:\s*var\(--space-2\)/);
    expect(field).toMatch(/\.error\s*\{[^}]*margin-top:\s*calc\(var\(--space-1_5\) - var\(--space-2\)\)/);
  });
});
