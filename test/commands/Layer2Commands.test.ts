import { beforeEach, describe, expect, it } from "vitest";

import { ShowLayer2Command } from "@renderer/appIde/commands/Layer2Commands";
import { onLayer2Reveal, type Layer2RevealRequest } from "@renderer/features/layer2/layer2Reveal";
import { createMockContext } from "./test-helpers/mock-context";

// --- LAYER2_INSPECTOR_PLAN §4.4: one command, one document, an optional source

const next = (context: any) =>
  context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "zxnext" } });

describe("show-layer2", () => {
  let context: any;
  let revealed: Layer2RevealRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    context = createMockContext();
    revealed = [];
    unsubscribe?.();
    unsubscribe = onLayer2Reveal((r) => revealed.push(r));
  });

  it("refuses a machine that is not a Next", async () => {
    expect((await new ShowLayer2Command().execute(context, {})).success).toBe(false);
  });

  it("opens the $layer2 document, then activates it, on the asked-for source", async () => {
    next(context);
    const hub = context.service.projectService.getActiveDocumentHubService();
    await new ShowLayer2Command().execute(context, {});
    expect(hub.openDocument).toHaveBeenCalledWith(expect.objectContaining({ id: "$layer2" }), undefined, false);
    hub.isOpen.mockReturnValue(true);
    await new ShowLayer2Command().execute(context, { source: "Shadow" });
    expect(hub.setActiveDocument).toHaveBeenCalledWith("$layer2");
    expect(revealed).toEqual([{ source: undefined }, { source: "shadow" }]);
  });

  it("accepts only the three sources", async () => {
    const cmd = new ShowLayer2Command();
    expect(await cmd.validateCommandArgs(context, { source: "window" })).toEqual([]);
    expect(await cmd.validateCommandArgs(context, { source: "front" })).toHaveLength(1);
  });

  it("has the planned alias", () => {
    expect(new ShowLayer2Command().aliases).toEqual(["shl2"]);
  });
});
