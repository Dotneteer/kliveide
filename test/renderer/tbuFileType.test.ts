import { describe, expect, it } from "vitest";
import { TBU_VIEWER } from "@common/state/common-ids";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";

/*
 * The Next's core update file opens in the TBU viewer by its exact name only
 * (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` D1): the matcher is given full paths, and other `.tbu` files
 * are not this format.
 */

const store = { getState: () => ({}) } as never;

describe("TBBLUE.TBU file type", () => {
  it.each([
    "TBBLUE.TBU",
    "tbblue.tbu",
    "/Volumes/NEXT/TBBLUE.TBU",
    "/Users/me/KliveProjects/next/TbBlue.Tbu",
    "C:\\sdcard\\TBBLUE.TBU"
  ])("opens %s in the TBU viewer", (path) => {
    const entry = getFileTypeEntry(path, store);
    expect(entry?.editor).toBe(TBU_VIEWER);
    expect(entry).toMatchObject({ isBinary: true, isReadOnly: true });
  });

  it.each(["GAME.TBU", "/x/MYTBBLUE.TBU", "/x/TBBLUE.HDMI.TBU", "/x/TBBLUE.TBU.bak", "/TBBLUE.TBU/readme.txt"])(
    "does not open %s in it",
    (path) => {
      expect(getFileTypeEntry(path, store)?.editor).not.toBe(TBU_VIEWER);
    }
  );
});
