import { describe, expect, it } from "vitest";
import {
  BIN_VIEWER,
  IMAGE_VIEWER,
  NEX_VIEWER,
  NPL_EDITOR,
  NXI_EDITOR,
  PAL_EDITOR,
  SCR_VIEWER,
  SHC_VIEWER,
  SHR_VIEWER,
  SL2_VIEWER,
  SLR_VIEWER,
  SPR_EDITOR,
  VID_VIEWER,
  Z88_SNAPSHOT_VIEWER
} from "@common/state/common-ids";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";

/*
 * Binary files open in their viewer or editor whatever the case of their extension: they come from
 * SD cards, NextZXOS and other systems, where SCREEN.SCR or GAME.NEX is as common as screen.scr.
 * Before, an upper-case name fell through to the generic binary viewer.
 */

const store = { getState: () => ({}) } as never;

/** The name in lower case, upper case, and with only the extension's first letter capitalised */
const cases = (ext: string) => [`file${ext}`, `FILE${ext.toUpperCase()}`, `File.${ext[1].toUpperCase()}${ext.slice(2)}`];

describe("binary file types match any case", () => {
  it.each([
    [".scr", SCR_VIEWER],
    [".shc", SHC_VIEWER],
    [".shr", SHR_VIEWER],
    [".slr", SLR_VIEWER],
    [".sl2", SL2_VIEWER],
    [".nxi", NXI_EDITOR],
    [".pal", PAL_EDITOR],
    [".npl", NPL_EDITOR],
    [".spr", SPR_EDITOR],
    [".vid", VID_VIEWER],
    [".nex", NEX_VIEWER],
    [".z88", Z88_SNAPSHOT_VIEWER],
    [".bin", BIN_VIEWER],
    [".rom", BIN_VIEWER],
    ...[".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico", ".svg", ".tiff", ".tif"].map(
      (ext) => [ext, IMAGE_VIEWER] as [string, string]
    )
  ])("opens %s in any case", (ext, editor) => {
    for (const name of cases(ext)) {
      expect(getFileTypeEntry(name, store)?.editor, name).toBe(editor);
    }
  });

  it("does not take a longer extension that starts the same", () => {
    expect(getFileTypeEntry("SCREEN.SCRX", store)?.editor).not.toBe(SCR_VIEWER);
    expect(getFileTypeEntry("GAME.NEXT", store)?.editor).not.toBe(NEX_VIEWER);
  });
});
