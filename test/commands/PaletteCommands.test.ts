import { beforeEach, describe, expect, it } from "vitest";

import { HidePalettesCommand, ShowPalettesCommand } from "@renderer/appIde/commands/PaletteCommands";
import { onPaletteReveal } from "@renderer/features/next-palette/paletteReveal";
import { createMockContext } from "./test-helpers/mock-context";

// --- NEXT_PALETTE_DEBUGGING_PLAN §4: `show-palettes [<device>]` opens $palettes, `hide-palettes` closes it

const next = (context: any) =>
  context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "zxnext" } });

describe("show-palettes / hide-palettes", () => {
  let context: any;

  beforeEach(() => {
    context = createMockContext();
  });

  it("refuses a machine that is not a Next", async () => {
    const result = await new ShowPalettesCommand().execute(context, {});
    expect(result.success).toBe(false);
  });

  it("opens the $palettes document, then activates it, showing the asked-for device", async () => {
    next(context);
    const revealed: string[] = [];
    const unsubscribe = onPaletteReveal((device) => revealed.push(device));
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new ShowPalettesCommand().execute(context, {});
    expect(hub.openDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "$palettes", type: "NextPalettes" }),
      undefined,
      false
    );
    hub.isOpen.mockReturnValue(true);
    await new ShowPalettesCommand().execute(context, { device: "SPR" });
    expect(hub.setActiveDocument).toHaveBeenCalledWith("$palettes");
    unsubscribe();
    expect(revealed).toEqual(["sprites"]);
  });

  it("rejects an unknown device", async () => {
    const messages = await new ShowPalettesCommand().validateCommandArgs(context, { device: "copper" });
    expect(messages).toHaveLength(1);
    expect(await new ShowPalettesCommand().validateCommandArgs(context, { device: "l2" })).toEqual([]);
  });

  it("closes the document", async () => {
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new HidePalettesCommand().execute(context);
    expect(hub.closeDocument).toHaveBeenCalledWith("$palettes");
  });

  it("has short aliases", () => {
    expect(new ShowPalettesCommand().aliases).toEqual(["shpal"]);
    expect(new HidePalettesCommand().aliases).toEqual(["hpal"]);
  });
});
