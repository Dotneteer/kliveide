import { beforeEach, describe, expect, it } from "vitest";

import { LayersCommand, ShowLayersCommand } from "@renderer/appIde/commands/LayersCommands";
import { createMockContext } from "./test-helpers/mock-context";

// --- LAYER_COMPOSITION_PLAN D4, D9: `layers` changes the shared view; `show-layers` opens $layers

const next = (context: any) =>
  context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "zxnext" } });

describe("layers", () => {
  let context: any;
  beforeEach(() => {
    context = createMockContext();
  });

  it("refuses a machine that is not a Next", async () => {
    expect((await new LayersCommand().execute(context, { layer: "spr", action: "off" })).success).toBe(false);
  });

  it("hides a layer in the shared view and shows the strip", async () => {
    next(context);
    const result = await new LayersCommand().execute(context, { layer: "spr", action: "off" });
    expect(result.success).toBe(true);
    expect(context.store.dispatch).toHaveBeenCalledWith(
      { type: "SET_NEXT_LAYERS", payload: { value: { hidden: 8, solo: 0, showTransparent: false } } },
      context.messageSource
    );
    expect(context.mainApi.setGlobalSettingsValue).toHaveBeenCalledWith("emuViewOptions.showNextLayers", true);
  });

  it("only lists the layers without arguments", async () => {
    next(context);
    await new LayersCommand().execute(context, {});
    expect(context.store.dispatch).not.toHaveBeenCalled();
    expect(context.output.writeLine).toHaveBeenCalledWith("Sprites: shown");
  });

  it("validates its arguments", async () => {
    const cmd = new LayersCommand();
    expect(await cmd.validateCommandArgs(context, { layer: "l2", action: "solo" })).toEqual([]);
    expect(await cmd.validateCommandArgs(context, { layer: "copper" })).toHaveLength(1);
    expect(await cmd.validateCommandArgs(context, { layer: "all", action: "solo" })).toHaveLength(1);
  });
});

describe("show-layers", () => {
  it("opens the $layers document, then activates it", async () => {
    const context: any = createMockContext();
    next(context);
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new ShowLayersCommand().execute(context);
    expect(hub.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "$layers" }), undefined, false);
    hub.isOpen.mockReturnValue(true);
    await new ShowLayersCommand().execute(context);
    expect(hub.setActiveDocument).toHaveBeenCalledWith("$layers");
    expect(new ShowLayersCommand().aliases).toEqual(["shly"]);
  });
});
