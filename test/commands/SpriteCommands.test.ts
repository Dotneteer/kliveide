import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ExportPatternsCommand,
  patternRamAsSpr,
  ShowPatternsCommand,
  ShowSpritesCommand
} from "@renderer/appIde/commands/SpriteCommands";
import { onSpriteReveal, type SpriteRevealRequest } from "@renderer/features/sprites/spriteReveal";
import { parseSprFile } from "@renderer/features/sprite-editor/sprite-file";
import { createMockContext } from "./test-helpers/mock-context";

// --- SPRITE_INSPECTOR_PLAN D11 (two commands, one document) and D15 (export as .spr)

const next = (context: any) =>
  context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "zxnext" } });

describe("show-sprites / show-patterns", () => {
  let context: any;
  let revealed: SpriteRevealRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    context = createMockContext();
    revealed = [];
    unsubscribe?.();
    unsubscribe = onSpriteReveal((r) => revealed.push(r));
  });

  it("refuses a machine that is not a Next", async () => {
    const result = await new ShowSpritesCommand().execute(context, {});
    expect(result.success).toBe(false);
  });

  it("opens the $sprites document on the asked-for view and item", async () => {
    next(context);
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new ShowSpritesCommand().execute(context, { index: 12 });
    expect(hub.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "$sprites" }), undefined, false);
    hub.isOpen.mockReturnValue(true);
    await new ShowPatternsCommand().execute(context, { index: 40 });
    expect(hub.setActiveDocument).toHaveBeenCalledWith("$sprites");
    expect(revealed).toEqual([
      { view: "sprites", index: 12 },
      { view: "patterns", index: 40 }
    ]);
  });

  it("has the planned aliases", () => {
    expect(new ShowSpritesCommand().aliases).toEqual(["shspr"]);
    expect(new ShowPatternsCommand().aliases).toEqual(["shpat"]);
  });
});

describe("export-patterns", () => {
  const patterns = Uint8Array.from({ length: 0x4000 }, (_, i) => (i * 7) & 0xff);

  it("writes the pattern RAM as 64 8-bit patterns that parse back", () => {
    const bytes = patternRamAsSpr(patterns);
    expect(Array.from(bytes)).toEqual(Array.from(patterns));
    const parsed = parseSprFile(bytes);
    expect(parsed.sprites).toHaveLength(64);
    expect(parsed.warning).toBeUndefined();
    expect(Array.from(parsed.sprites[40])).toEqual(Array.from(patterns.subarray(40 * 256, 41 * 256)));
  });

  it("saves the snapshot's bytes to the next free name in the project", async () => {
    const context: any = createMockContext();
    next(context);
    context.store.getState.mockReturnValue({ project: { folderPath: "/proj" } });
    context.emuApi.getNextSpriteState = vi.fn().mockResolvedValue({ patterns });
    // --- pattern-ram.spr exists, pattern-ram-2.spr does not
    context.mainApi.readBinaryFile = vi.fn((path: string) =>
      path === "/proj/pattern-ram.spr" ? Promise.resolve(new Uint8Array()) : Promise.reject(new Error("none"))
    );
    context.mainApi.saveBinaryFile = vi.fn().mockResolvedValue("ok");
    const result = await new ExportPatternsCommand().execute(context, {});
    expect(result.success).toBe(true);
    expect(context.mainApi.saveBinaryFile).toHaveBeenCalledWith("/proj/pattern-ram-2.spr", expect.any(Uint8Array));
    expect(Array.from(context.mainApi.saveBinaryFile.mock.calls[0][1])).toEqual(Array.from(patterns));
  });

  it("refuses to overwrite without -f, and a non-.spr name", async () => {
    const context: any = createMockContext();
    next(context);
    context.store.getState.mockReturnValue({ project: { folderPath: "/proj" } });
    context.mainApi.readBinaryFile = vi.fn().mockResolvedValue(new Uint8Array());
    expect((await new ExportPatternsCommand().execute(context, { file: "a.spr" })).success).toBe(false);
    expect((await new ExportPatternsCommand().execute(context, { file: "a.bin" })).success).toBe(false);
  });
});
