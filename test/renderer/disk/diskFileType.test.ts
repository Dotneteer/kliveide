import { describe, expect, it } from "vitest";
import { DISK_EXPLORER } from "@common/state/common-ids";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";

/*
 * Disk images and Microdrive cartridges open in the Disk Explorer, not in the text editor
 * (`.plans/MICRODRIVE_PLAN.md`: an `.mdr` once opened as text, its bytes shown as NULs)
 */

const store = { getState: () => ({}) } as never;

describe("disk image file types", () => {
  it.each(["game.dsk", "magazine.trd", "demo.scl", "cartridge.mdr", "GAMES.MDR"])("opens %s in the Disk Explorer", (name) => {
    const entry = getFileTypeEntry(name, store);
    expect(entry?.editor).toBe(DISK_EXPLORER);
    expect(entry?.isBinary).toBe(true);
  });

  it("gives a cartridge the Microdrive icon", () => {
    expect(getFileTypeEntry("cartridge.mdr", store)?.icon).toBe("microdrive");
  });
});
