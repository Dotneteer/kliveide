import { describe, expect, it, vi } from "vitest";
import { droppedFileAction } from "@common/utils/dropped-file-action";
import { handleEmuFileDrop } from "@renderer/appEmu/useEmuFileDrop";

/*
 * Dropping files onto the emulator window (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.10, Phase 8).
 */

describe("droppedFileAction", () => {
  it.each([
    ["/g/a.sna", 'zx-snapshot "/g/a.sna" -r'],
    ["/g/B.Z80", 'zx-snapshot "/g/B.Z80" -r'],
    ["C:\\My Games\\c.szx", 'zx-snapshot "C:\\My Games\\c.szx" -r'],
    ["/g/d.z88", 'z88-snapshot "/g/d.z88" -a'],
    ["/g/My State.KLS", 'state-load "/g/My State.KLS" -d']
  ])("runs %s through %s", (path, command) => {
    expect(droppedFileAction(path)).toEqual({ kind: "command", command });
  });

  it("inserts tapes and refuses other files", () => {
    expect(droppedFileAction("/g/a.TZX")).toEqual({ kind: "tape" });
    expect(droppedFileAction("/g/a.tap")).toEqual({ kind: "tape" });
    expect(droppedFileAction("/g/a.txt")).toMatchObject({ kind: "unsupported", message: expect.stringMatching(/\.txt file/) });
    expect(droppedFileAction("/g/README")).toMatchObject({ kind: "unsupported" });
  });
});

describe("handleEmuFileDrop", () => {
  const event = (files: unknown[]) => ({ preventDefault: vi.fn(), dataTransfer: { files } as any });

  it("hands the first file's path to the main process", async () => {
    const openDroppedFile = vi.fn().mockResolvedValue(undefined);
    const e = event([{ name: "a.sna" }, { name: "b.sna" }]);
    const path = await handleEmuFileDrop(e, { getPathForFile: (f: any) => `/g/${f.name}`, openDroppedFile });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(path).toBe("/g/a.sna");
    expect(openDroppedFile).toHaveBeenCalledWith("/g/a.sna");
  });

  it("does nothing without a file or a path", async () => {
    const openDroppedFile = vi.fn();
    expect(await handleEmuFileDrop(event([]), { getPathForFile: () => "/x", openDroppedFile })).toBeUndefined();
    expect(await handleEmuFileDrop(event([{}]), { getPathForFile: () => "", openDroppedFile })).toBeUndefined();
    expect(await handleEmuFileDrop(event([{}]), { getPathForFile: undefined, openDroppedFile })).toBeUndefined();
    expect(openDroppedFile).not.toHaveBeenCalled();
  });
});
