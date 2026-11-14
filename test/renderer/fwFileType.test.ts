import { describe, expect, it } from "vitest";
import { FW_VIEWER, TBU_VIEWER } from "@common/state/common-ids";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";

/*
 * The Next's firmware file opens in the FW viewer by its exact name only
 * (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md` D1), beside the update file's own entry.
 */

const store = { getState: () => ({}) } as never;

describe("TBBLUE.FW file type", () => {
  it.each(["TBBLUE.FW", "tbblue.fw", "/Volumes/NEXT/TBBLUE.FW", "C:\\sdcard\\TbBlue.Fw"])("opens %s in the FW viewer", (path) => {
    const entry = getFileTypeEntry(path, store);
    expect(entry?.editor).toBe(FW_VIEWER);
    expect(entry).toMatchObject({ isBinary: true, isReadOnly: true });
  });

  it.each(["OTHER.FW", "/x/MYTBBLUE.FW", "/x/TBBLUE.FW.bak"])("does not open %s in it", (path) => {
    expect(getFileTypeEntry(path, store)?.editor).not.toBe(FW_VIEWER);
  });

  it("keeps TBBLUE.TBU in its own viewer", () => {
    expect(getFileTypeEntry("/x/TBBLUE.TBU", store)?.editor).toBe(TBU_VIEWER);
  });
});
