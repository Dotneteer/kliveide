import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import { documentPanelRegistry, fileTypeRegistry, unknownFileType } from "@renderer/registry";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

/**
 * A document's TYPE does not earn a colour.
 *
 * Every one of the ~50 registry entries used to tint its tab icon from `--console-ansi-*` - the
 * console's palette, which is a fixed external contract ("a program emitting ANSI red expects
 * red") and so can never follow the accent. It looked like a VS Code file-icon theme and was not
 * one: seven hues over fifty entries, the same `vm` glyph in five colours, `code`+magenta and
 * `chip`+magenta each used for two different types, one hue on all ten image formats - and the
 * most-opened tab of all, the code editor, neutral. Colour that cannot identify a type is
 * decoration, and this is the same call `WatchPanel` and `BreakpointIndicator` already got.
 *
 * The glyph carries the type; the filename beside it carries the rest. Where two types still share
 * a glyph, the fix is to draw the second glyph - not to reach for a hue.
 *
 * A genuinely *stateful* icon may still take a colour, from `--status-*` or the accent, the way
 * `WatchPanel`'s unresolved row does. That is not what these entries were doing.
 */
describe("document type icons are neutral", () => {
  it("no registry entry tints its icon", () => {
    const tinted = [...documentPanelRegistry, ...fileTypeRegistry, unknownFileType]
      .filter((e) => (e as { iconFill?: string }).iconFill !== undefined)
      .map((e) => JSON.stringify(e));
    expect(tinted).toEqual([]);
  });

  it("the console's ANSI palette is not spent on document icons", () => {
    // Source text rather than the parsed registry, so a commented-out entry cannot smuggle the
    // pattern back in for the next person to uncomment.
    const files = [
      "src/renderer/registry.ts",
      "src/renderer/features/documents/specialDocuments.ts",
      "src/renderer/features/memory/StaticMemoryDump.tsx"
    ];
    for (const f of files) {
      expect(readFileSync(join(repoRoot, f), "utf8"), f).not.toContain("--console-ansi");
    }
  });
});
