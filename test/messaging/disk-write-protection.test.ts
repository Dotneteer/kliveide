import { describe, expect, it, vi } from "vitest";

import { attachStoredMedia } from "@emu/machines/MachineController";
import { mediaStore } from "@emu/machines/media/media-info";
import { DISK_A_WP, DISK_B_WP } from "@emu/machines/machine-props";
import { MEDIA_DISK_A, MEDIA_DISK_B } from "@common/structs/project-const";

/** A machine stub that just records the properties set on it, in order. */
function createMachineStub() {
  const calls: { key: string; value: any }[] = [];
  return {
    calls,
    machine: {
      setMachineProperty: vi.fn((key: string, value: any) => {
        calls.push({ key, value });
      })
    } as any
  };
}

describe("write protection survives a machine change", () => {
  it("keeps the write-protection flag when the disk contents are stored afterwards", () => {
    // --- This is the real call order: the app sets write protection first, then inserts the disk.
    mediaStore.addMedia({ id: MEDIA_DISK_A, writeProtected: true });
    mediaStore.addMedia({
      id: MEDIA_DISK_A,
      mediaFile: "/tmp/game.dsk",
      mediaContents: new Uint8Array([1, 2, 3])
    });

    const stored = mediaStore.getMedia(MEDIA_DISK_A);
    // --- Storing the contents must not wipe the flag recorded moments earlier.
    expect(stored?.writeProtected).toBe(true);
    expect(stored?.mediaFile).toBe("/tmp/game.dsk");
  });

  it("re-applies write protection to a new machine, before the contents", () => {
    mediaStore.addMedia({
      id: MEDIA_DISK_A,
      mediaFile: "/tmp/game.dsk",
      mediaContents: new Uint8Array([1, 2, 3]),
      writeProtected: true
    });

    const { machine, calls } = createMachineStub();
    attachStoredMedia(machine, [MEDIA_DISK_A]);

    const wpIndex = calls.findIndex((c) => c.key === DISK_A_WP);
    const contentsIndex = calls.findIndex((c) => c.key === MEDIA_DISK_A);

    expect(wpIndex).toBeGreaterThanOrEqual(0);
    expect(calls[wpIndex].value).toBe(true);
    // --- Order matters: the media consumers read the flag while attaching the contents, so a
    // --- flag applied afterwards would leave the drive writable.
    expect(wpIndex).toBeLessThan(contentsIndex);
  });

  it("does not touch the write-protection property when none was recorded", () => {
    mediaStore.addMedia({
      id: MEDIA_DISK_B,
      mediaFile: "/tmp/other.dsk",
      mediaContents: new Uint8Array([4, 5]),
      writeProtected: undefined
    });

    const { machine, calls } = createMachineStub();
    attachStoredMedia(machine, [MEDIA_DISK_B]);

    expect(calls.some((c) => c.key === DISK_B_WP)).toBe(false);
    expect(calls.some((c) => c.key === MEDIA_DISK_B)).toBe(true);
  });

  it("ignores media the machine does not support", () => {
    mediaStore.addMedia({
      id: MEDIA_DISK_A,
      mediaContents: new Uint8Array([1]),
      writeProtected: true
    });

    const { machine, calls } = createMachineStub();
    // --- A 48K machine supports no disks at all.
    attachStoredMedia(machine, []);

    expect(calls).toHaveLength(0);
  });
});
