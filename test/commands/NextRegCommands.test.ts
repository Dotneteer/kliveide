import { beforeEach, describe, expect, it } from "vitest";

import { HideNextRegsCommand, ShowNextRegsCommand } from "@renderer/appIde/commands/NextRegCommands";
import { onNextRegReveal } from "@renderer/features/nextRegs/nextRegReveal";
import { createMockContext } from "./test-helpers/mock-context";

const next = (context: any) =>
  context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "zxnext" } });

describe("show-nextregs / hide-nextregs", () => {
  let context: any;

  beforeEach(() => {
    context = createMockContext();
  });

  it("refuses a machine that is not a Next", async () => {
    const result = await new ShowNextRegsCommand().execute(context, {});
    expect(result.success).toBe(false);
  });

  it("opens the $nextRegs document, then activates it, revealing the asked-for register", async () => {
    next(context);
    const revealed: number[] = [];
    const unsubscribe = onNextRegReveal((id) => revealed.push(id));
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new ShowNextRegsCommand().execute(context, {});
    expect(hub.openDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "$nextRegs", type: "NextRegisters" }),
      undefined,
      false
    );
    hub.isOpen.mockReturnValue(true);
    await new ShowNextRegsCommand().execute(context, { reg: 0x15 });
    expect(hub.setActiveDocument).toHaveBeenCalledWith("$nextRegs");
    unsubscribe();
    expect(revealed).toEqual([0x15]);
  });

  it("closes the document", async () => {
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new HideNextRegsCommand().execute(context);
    expect(hub.closeDocument).toHaveBeenCalledWith("$nextRegs");
  });

  it("has short aliases", () => {
    expect(new ShowNextRegsCommand().aliases).toEqual(["shnr"]);
    expect(new HideNextRegsCommand().aliases).toEqual(["hnr"]);
  });
});
