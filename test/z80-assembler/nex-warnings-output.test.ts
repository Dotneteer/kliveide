import { describe, expect, it } from "vitest";
import { writeNexWarnings } from "@renderer/appIde/commands/KliveCompilerCommands";
import { OutputPaneBuffer } from "@renderer/appIde/ToolArea/OutputPaneBuffer";

/**
 * The NEX writer's warnings reach the user through the build output, marked and coloured like the
 * assembler's own warnings, so the Output pane can count and filter them the same way.
 */
describe("writeNexWarnings", () => {
  it("writes each warning as its own warning-severity line", () => {
    const out = new OutputPaneBuffer();

    writeNexWarnings(out, [
      "Unbanked code at $C000 is above bank 2 range ($bfff). Code may be truncated.",
      "Unbanked code at $6000 is below bank 2 range ($8000). Code will be ignored."
    ]);

    const lines = out.getContents();
    expect(lines.map((line) => line.spans.map((span) => span.text).join(""))).toEqual([
      "NEX export: Unbanked code at $C000 is above bank 2 range ($bfff). Code may be truncated.",
      "NEX export: Unbanked code at $6000 is below bank 2 range ($8000). Code will be ignored."
    ]);
    expect(lines.map((line) => line.severity)).toEqual(["warning", "warning"]);
    expect(lines[0].spans.every((span) => span.foreground === "yellow")).toBe(true);
    expect(lines[0].spans[0].isBold).toBe(true);
  });

  it("leaves the style reset, so the next line is not a warning", () => {
    const out = new OutputPaneBuffer();

    writeNexWarnings(out, ["Unbanked code at $C000 is above bank 2 range ($bfff)."]);
    out.writeLine("NEX file successfully exported");

    const last = out.getContents().at(-1)!;
    expect(last.severity).toBeUndefined();
    expect(last.spans[0].foreground).toBeUndefined();
  });

  it("writes nothing when there are no warnings", () => {
    const out = new OutputPaneBuffer();

    writeNexWarnings(out, []);

    expect(out.getContents()).toEqual([]);
  });
});
