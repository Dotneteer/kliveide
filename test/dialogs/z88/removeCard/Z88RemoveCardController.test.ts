import { describe, expect, it, vi } from "vitest";

import { EMPTY_CARD_STATE } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardModel";

import { deferred } from "../../../mvc/deferred";
import { MC_Z88_SLOT0, fakeZ88MachinePort, openRemoveCardDialog } from "./fakes";

describe("Z88RemoveCardController — card slots", () => {
  it("unplugs the card without rebuilding the machine", async () => {
    const h = openRemoveCardDialog({ slot: 2 });

    await h.dispatch({ type: "removeRequested" });

    expect(h.ports.machine.applyCardState).toHaveBeenCalledWith(2, EMPTY_CARD_STATE);
    // --- Slots 1-3 are hot-pluggable; rebuilding would stop the machine for
    // --- nothing.
    expect(h.ports.machine.setMachineConfig).not.toHaveBeenCalled();
    expect(h.ports.close.removed).toHaveBeenCalledWith({ slot: 2 });
  });

  it("shuts the flap on the way out", async () => {
    const h = openRemoveCardDialog({ slot: 1 });

    await h.dispatch({ type: "removeRequested" });

    // --- The Z88 notices the card flap being open and waits for it; leaving it
    // --- open would hang the emulation.
    expect(h.ports.machine.signalFlapClosed).toHaveBeenCalled();
  });
});

describe("Z88RemoveCardController — slot 0", () => {
  it("rebuilds the machine after emptying the internal ROM socket", async () => {
    const order: string[] = [];
    const machine = fakeZ88MachinePort({
      applyCardState: vi.fn(async () => {
        order.push("unplug");
      }),
      setMachineConfig: vi.fn(async () => {
        order.push("rebuild");
      })
    });
    const h = openRemoveCardDialog({
      slot: 0,
      env: { config: { other: "kept" } },
      ports: { machine, close: { removed: vi.fn(), dismissed: vi.fn() } }
    });

    await h.dispatch({ type: "removeRequested" });

    expect(h.ports.machine.setMachineConfig).toHaveBeenCalledWith({
      other: "kept",
      [MC_Z88_SLOT0]: EMPTY_CARD_STATE
    });
    // --- The running machine is updated first, then rebuilt without the ROM.
    expect(order).toEqual(["unplug", "rebuild"]);
    expect(h.ports.close.removed).toHaveBeenCalledWith({ slot: 0 });
  });

  it("does not settle when the rebuild fails", async () => {
    const machine = fakeZ88MachinePort({
      setMachineConfig: vi.fn(async () => {
        throw new Error("machine is wedged");
      })
    });
    const h = openRemoveCardDialog({
      slot: 0,
      ports: { machine, close: { removed: vi.fn(), dismissed: vi.fn() } }
    });

    await h.dispatch({ type: "removeRequested" });

    expect(h.ports.close.removed).not.toHaveBeenCalled();
    // --- The dialog stays usable so the user can try again.
    expect(h.vm.removeEnabled).toBe(true);
  });
});

describe("Z88RemoveCardController — work in flight", () => {
  it("removes once when Ok is pressed twice", async () => {
    const gate = deferred<void>();
    const machine = fakeZ88MachinePort({ applyCardState: vi.fn(() => gate.promise) });
    const h = openRemoveCardDialog({
      ports: { machine, close: { removed: vi.fn(), dismissed: vi.fn() } }
    });

    void h.send({ type: "removeRequested" });
    expect(h.vm.removeEnabled).toBe(false);
    void h.send({ type: "removeRequested" });

    gate.resolve();
    await h.settle();

    expect(h.ports.machine.applyCardState).toHaveBeenCalledTimes(1);
    expect(h.ports.close.removed).toHaveBeenCalledTimes(1);
  });

  it("does not settle a dialog that was torn down mid-removal", async () => {
    const gate = deferred<void>();
    const machine = fakeZ88MachinePort({ applyCardState: vi.fn(() => gate.promise) });
    const h = openRemoveCardDialog({
      ports: { machine, close: { removed: vi.fn(), dismissed: vi.fn() } }
    });

    void h.send({ type: "removeRequested" });
    h.dispose();
    gate.resolve();
    await h.settle();

    expect(h.ports.close.removed).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still removes", async () => {
    const h = openRemoveCardDialog();
    h.controller.dispose();
    h.controller.activate();

    await h.dispatch({ type: "removeRequested" });

    expect(h.ports.close.removed).toHaveBeenCalled();
  });
});

describe("Z88RemoveCardController — closing", () => {
  it("shuts the flap and leaves the card in place", async () => {
    const h = openRemoveCardDialog();

    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.machine.signalFlapClosed).toHaveBeenCalledTimes(1);
    expect(h.ports.machine.applyCardState).not.toHaveBeenCalled();
    expect(h.ports.close.dismissed).toHaveBeenCalledTimes(1);
  });
});
