import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTapeDataBlock } from "@emu/tape/tape-parser";

describe("SP48 active controller tape session", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("queues a selected tape until a controller is active", async () => {
    const session = await import("@emu/sp48/sp48-session");
    const controller = createController();
    const block = createTapeDataBlock(new Uint8Array([0x00, 0x01]));

    expect(session.uploadTapeToActiveSp48ControllerOrQueue([block], "queued.tap")).toBe("queued");
    expect(controller.setTape).not.toHaveBeenCalled();

    session.setActiveSp48Controller(controller);

    expect(controller.setTape).toHaveBeenCalledOnce();
    expect(controller.setTape).toHaveBeenCalledWith([block], "queued.tap");
  });

  it("reattaches the selected tape when the active controller changes", async () => {
    const session = await import("@emu/sp48/sp48-session");
    const firstController = createController();
    const secondController = createController();
    const block = createTapeDataBlock(new Uint8Array([0xff, 0xaa]));

    session.setActiveSp48Controller(firstController);
    expect(session.uploadTapeToActiveSp48ControllerOrQueue([block], "selected.tap")).toBe("uploaded");
    expect(firstController.setTape).toHaveBeenCalledOnce();

    session.setActiveSp48Controller(secondController);

    expect(secondController.setTape).toHaveBeenCalledOnce();
    expect(secondController.setTape).toHaveBeenCalledWith([block], "selected.tap");
  });

  it("does not reupload the selected tape when the same controller is registered again", async () => {
    const session = await import("@emu/sp48/sp48-session");
    const controller = createController();
    const block = createTapeDataBlock(new Uint8Array([0xff, 0x10]));

    session.setActiveSp48Controller(controller);
    session.uploadTapeToActiveSp48ControllerOrQueue([block], "same.tap");
    session.setActiveSp48Controller(controller);

    expect(controller.setTape).toHaveBeenCalledOnce();
  });

  it("forgets the selected tape when the tape is cleared", async () => {
    const session = await import("@emu/sp48/sp48-session");
    const firstController = createController();
    const secondController = createController();
    const block = createTapeDataBlock(new Uint8Array([0xff, 0x10]));

    session.setActiveSp48Controller(firstController);
    session.uploadTapeToActiveSp48ControllerOrQueue([block], "clear.tap");
    session.clearQueuedSp48Tape();
    session.setActiveSp48Controller(secondController);

    expect(secondController.setTape).not.toHaveBeenCalled();
  });
});

function createController() {
  return {
    setTape: vi.fn()
  } as any;
}
