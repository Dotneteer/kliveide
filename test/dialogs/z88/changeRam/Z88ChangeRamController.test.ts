import { describe, expect, it, vi } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { RAM_CHANGE_WARNING } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamModel";

import { deferred } from "../../../mvc/deferred";
import { MC_Z88_INTRAM, openChangeRamDialog } from "./fakes";

describe("Z88ChangeRamController — applying", () => {
  it("rebuilds the machine, reports it, and settles as changed", async () => {
    const h = openChangeRamDialog({ env: { config: { [MC_Z88_INTRAM]: 0x1f, other: "kept" } } });

    await h.dispatch({ type: "ramSizeSelected", size: "32" });
    await h.dispatch({ type: "applyRequested" });

    // --- The rest of the configuration has to survive: this dialog owns one key.
    expect(h.ports.machine.setMachineConfig).toHaveBeenCalledWith({
      other: "kept",
      [MC_Z88_INTRAM]: 0x01
    });
    expect(h.ports.output.write).toHaveBeenCalledWith("Z88 internal RAM size changed to 32K");
    expect(h.ports.close.settled).toHaveBeenCalledWith({
      selectedSize: "32",
      ramMask: 0x01,
      changed: true
    });
  });

  it("leaves a machine alone when the fitted size was re-picked", async () => {
    const h = openChangeRamDialog({ env: { config: { [MC_Z88_INTRAM]: 0x07 } } });

    await h.dispatch({ type: "ramSizeSelected", size: "128" });
    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.machine.setMachineConfig).not.toHaveBeenCalled();
    expect(h.ports.output.write).not.toHaveBeenCalled();
    // --- Still an answer, so the caller hears about it.
    expect(h.ports.close.settled).toHaveBeenCalledWith({
      selectedSize: "128",
      ramMask: 0x07,
      changed: false
    });
  });

  it("leaves an unconfigured machine alone when 512K is chosen", async () => {
    const h = openChangeRamDialog();

    await h.dispatch({ type: "ramSizeSelected", size: "512" });
    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.machine.setMachineConfig).not.toHaveBeenCalled();
    expect(h.ports.close.settled).toHaveBeenCalledWith(
      expect.objectContaining({ changed: false })
    );
  });

  it("writes to the output pane only after the machine is rebuilt", async () => {
    const order: string[] = [];
    const h = openChangeRamDialog({
      ports: {
        machine: {
          applyCardState: vi.fn(),
          setMachineConfig: vi.fn(async () => {
            order.push("rebuild");
          }),
          signalFlapClosed: vi.fn()
        },
        output: {
          write: vi.fn(async () => {
            order.push("output");
          })
        }
      }
    });

    await h.dispatch({ type: "ramSizeSelected", size: "32" });
    await h.dispatch({ type: "applyRequested" });

    expect(order).toEqual(["rebuild", "output"]);
  });
});

describe("Z88ChangeRamController — work in flight", () => {
  it("disables Ok while the machine is being rebuilt", async () => {
    const gate = deferred<void>();
    const h = openChangeRamDialog({
      ports: {
        machine: {
          applyCardState: vi.fn(),
          setMachineConfig: vi.fn(() => gate.promise),
          signalFlapClosed: vi.fn()
        }
      }
    });
    await h.dispatch({ type: "ramSizeSelected", size: "32" });

    void h.send({ type: "applyRequested" });
    expect(h.vm.applyEnabled).toBe(false);

    gate.resolve();
    await h.settle();
    expect(h.vm.applyEnabled).toBe(true);
  });

  it("rebuilds once when Ok is pressed twice", async () => {
    const gate = deferred<void>();
    const h = openChangeRamDialog({
      ports: {
        machine: {
          applyCardState: vi.fn(),
          setMachineConfig: vi.fn(() => gate.promise),
          signalFlapClosed: vi.fn()
        }
      }
    });
    await h.dispatch({ type: "ramSizeSelected", size: "32" });

    void h.send({ type: "applyRequested" });
    void h.send({ type: "applyRequested" });
    gate.resolve();
    await h.settle();

    expect(h.ports.machine.setMachineConfig).toHaveBeenCalledTimes(1);
    expect(h.ports.close.settled).toHaveBeenCalledTimes(1);
  });

  it("does not settle a dialog that was torn down mid-rebuild", async () => {
    const gate = deferred<void>();
    const h = openChangeRamDialog({
      ports: {
        machine: {
          applyCardState: vi.fn(),
          setMachineConfig: vi.fn(() => gate.promise),
          signalFlapClosed: vi.fn()
        }
      }
    });
    await h.dispatch({ type: "ramSizeSelected", size: "32" });

    void h.send({ type: "applyRequested" });
    h.dispose();
    gate.resolve();
    await h.settle();

    expect(h.ports.output.write).not.toHaveBeenCalled();
    expect(h.ports.close.settled).not.toHaveBeenCalled();
  });

  it("clears the busy flag when the rebuild fails", async () => {
    const h = openChangeRamDialog({
      ports: {
        machine: {
          applyCardState: vi.fn(),
          setMachineConfig: vi.fn(async () => {
            throw new Error("machine is wedged");
          }),
          signalFlapClosed: vi.fn()
        }
      }
    });
    await h.dispatch({ type: "ramSizeSelected", size: "32" });

    await h.dispatch({ type: "applyRequested" });

    // --- The dialog stays open and usable so the user can try again; a stuck
    // --- busy flag would leave every control dead.
    expect(h.vm.applyEnabled).toBe(true);
    expect(h.ports.close.settled).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still applies", async () => {
    const h = openChangeRamDialog();
    h.controller.dispose();
    h.controller.activate();

    await h.dispatch({ type: "ramSizeSelected", size: "32" });
    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.close.settled).toHaveBeenCalled();
  });
});

describe("Z88ChangeRamController — closing", () => {
  it("dismisses without touching the machine", async () => {
    const h = openChangeRamDialog();

    await h.dispatch({ type: "ramSizeSelected", size: "32" });
    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.close.dismissed).toHaveBeenCalledTimes(1);
    expect(h.ports.machine.setMachineConfig).not.toHaveBeenCalled();
  });
});

describe("Z88ChangeRamController — environment", () => {
  it("keeps the same view model when an equivalent environment arrives", async () => {
    const h = openChangeRamDialog({ env: { config: { [MC_Z88_INTRAM]: 0x07 } } });
    const before = h.vm;

    await h.dispatch({
      type: "environmentChanged",
      env: { config: { [MC_Z88_INTRAM]: 0x07 }, machineState: h.env.machineState }
    });

    expect(h.vm).toBe(before);
  });

  it("earns the warning when the machine starts running underneath it", async () => {
    // --- The dialog can be open while the user starts the machine from the
    // --- toolbar; the warning has to appear without reopening it.
    const h = openChangeRamDialog();
    await h.dispatch({ type: "ramSizeSelected", size: "32" });
    expect(h.vm.warning).toBeUndefined();

    await h.dispatch({
      type: "environmentChanged",
      env: { config: {}, machineState: MachineControllerState.Running }
    });

    expect(h.vm.warning).toBe(RAM_CHANGE_WARNING);
  });
});
