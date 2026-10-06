import { beforeEach, describe, expect, it } from "vitest";

import { ShowTilemapCommand, ShowTilesCommand } from "@renderer/appIde/commands/TilemapCommands";
import { onTilemapReveal, type TilemapRevealRequest } from "@renderer/features/tilemap/tilemapReveal";
import { createMockContext } from "./test-helpers/mock-context";

// --- TILEMAP_INSPECTOR_PLAN §4.4 and Q2: two commands, one document

const next = (context: any) =>
  context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "zxnext" } });

describe("show-tilemap / show-tiles", () => {
  let context: any;
  let revealed: TilemapRevealRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    context = createMockContext();
    revealed = [];
    unsubscribe?.();
    unsubscribe = onTilemapReveal((r) => revealed.push(r));
  });

  it("refuses a machine that is not a Next", async () => {
    expect((await new ShowTilemapCommand().execute(context, {})).success).toBe(false);
    expect((await new ShowTilesCommand().execute(context, {})).success).toBe(false);
  });

  it("opens the $tilemap document on the asked-for view and item", async () => {
    next(context);
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new ShowTilemapCommand().execute(context, { col: 12, row: 5 });
    expect(hub.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "$tilemap" }), undefined, false);
    hub.isOpen.mockReturnValue(true);
    await new ShowTilesCommand().execute(context, { index: 300 });
    await new ShowTilemapCommand().execute(context, {});
    expect(hub.setActiveDocument).toHaveBeenCalledWith("$tilemap");
    expect(revealed).toEqual([
      { view: "map", cell: { col: 12, row: 5 } },
      { view: "tiles", tile: 300 },
      { view: "map", cell: undefined }
    ]);
  });

  it("wants a row with a column", async () => {
    const cmd = new ShowTilemapCommand();
    expect(await cmd.validateCommandArgs(context, { col: 3 })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(context, { col: 3, row: 4 })).toEqual([]);
  });

  it("has the planned aliases", () => {
    expect(new ShowTilemapCommand().aliases).toEqual(["shtm"]);
    expect(new ShowTilesCommand().aliases).toEqual(["shtl"]);
  });
});
