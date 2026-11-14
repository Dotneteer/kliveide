import { describe, expect, it, vi } from "vitest";

import { TBU_VIEWER } from "@common/state/common-ids";
import { ShowTbuCommand } from "@renderer/appIde/commands/TbuCommands";

/*
 * `show-tbu` (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md`, Phase 5): the current card's TBBLUE.TBU in the TBU
 * viewer, a fresh read each time, and the errors worded for the message box.
 */

function contextOf({ machineId = "zxnext", result = {} as any, open = false } = {}) {
  const hub = {
    isOpen: vi.fn(() => open),
    closeDocument: vi.fn(async () => {}),
    openDocument: vi.fn(async () => {})
  };
  const readNextSdCardFile = vi.fn(async () => result);
  const context = {
    service: {
      machineService: { getMachineInfo: () => ({ machine: { machineId } }) },
      projectService: { getActiveDocumentHubService: () => hub }
    },
    mainApi: { readNextSdCardFile }
  } as any;
  return { context, hub, readNextSdCardFile };
}

const run = (context: any) => new ShowTbuCommand().execute(context);
const CARD = "/home/me/Klive/ks2-30303.cim";

describe("show-tbu", () => {
  it("opens the card's TBBLUE.TBU in the TBU viewer, named after the card", async () => {
    const contents = new Uint8Array([1, 2, 3]);
    const { context, hub, readNextSdCardFile } = contextOf({ result: { card: CARD, contents } });
    expect((await run(context)).success).toBe(true);
    expect(readNextSdCardFile).toHaveBeenCalledWith("TBBLUE.TBU");
    expect(hub.openDocument).toHaveBeenCalledWith(
      { id: `tbuCard:${CARD}`, name: "TBBLUE.TBU · ks2-30303.cim", type: TBU_VIEWER, iconName: "cpu", contents, isReadOnly: true },
      undefined,
      false
    );
    expect(hub.closeDocument).not.toHaveBeenCalled();
  });

  it("replaces an open document of the same card with a fresh read", async () => {
    const { context, hub } = contextOf({ result: { card: CARD, contents: new Uint8Array(1) }, open: true });
    await run(context);
    expect(hub.closeDocument).toHaveBeenCalledWith(`tbuCard:${CARD}`);
    expect(hub.openDocument).toHaveBeenCalled();
  });

  it("works on the Next only", async () => {
    const { context, readNextSdCardFile } = contextOf({ machineId: "sp48" });
    const result = await run(context);
    expect(result.success).toBe(false);
    expect(result.finalMessage).toMatch(/switch to the ZX Spectrum Next/);
    expect(readNextSdCardFile).not.toHaveBeenCalled();
  });

  it.each([
    [{ card: "/x/gone.cim", error: "noCard" }, "The SD card image /x/gone.cim does not exist."],
    [{ card: CARD, error: "notFound" }, "The SD card ks2-30303.cim has no TBBLUE.TBU in its root folder."],
    [{ card: CARD, error: "unreadable", message: "The disk has no FAT partition." }, "TBBLUE.TBU cannot be read from the SD card ks2-30303.cim: The disk has no FAT partition."]
  ])("says what went wrong (%o)", async (result, message) => {
    const { context, hub } = contextOf({ result });
    const outcome = await run(context);
    expect(outcome).toMatchObject({ success: false, finalMessage: message });
    expect(hub.openDocument).not.toHaveBeenCalled();
  });
});
