import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * A machine whose setup declines (a ZX Spectrum Next whose SD card the user did not download,
 * `dev/plans/NEXT_SD_CARDS_PLAN.md` phase 5) leaves the previous machine running, and a machine that
 * stands in for a declined one keeps the chosen one saved until the user changes the machine (Q1).
 */

const setup = vi.fn();
const emuSetMachineType = vi.fn();

vi.mock("@main/machine-menus/machine-menu-registry", () => ({
  machineMenuRegistry: { zxnext: { setup: (...args: any[]) => setup(...args) } }
}));
vi.mock("@messaging/MainToEmuMessenger", () => ({ getEmuApi: () => ({ setMachineType: emuSetMachineType }) }));
vi.mock("@messaging/MainToIdeMessenger", () => ({ getIdeApi: () => ({ displayOutputBatch: vi.fn() }) }));

import { changeMachineType, setMachineType } from "@main/registeredMachines";
import { chosenMachine, clearStandIn, setStandIn } from "@main/standInMachine";

beforeEach(() => {
  setup.mockReset();
  emuSetMachineType.mockReset().mockResolvedValue(true);
  clearStandIn();
});

describe("a machine change through the gate", () => {
  it("is declined, and the emulator is not touched, when the setup declines", async () => {
    setup.mockResolvedValue(false);
    expect(await changeMachineType("zxnext", "ks2-30204", {})).toBe("declined");
    expect(emuSetMachineType).not.toHaveBeenCalled();
    expect(await setMachineType("zxnext", "ks2-30204", {})).toBe(false);
  });

  it("is applied when the setup lets it", async () => {
    setup.mockResolvedValue(undefined);
    expect(await changeMachineType("zxnext", "ks3-30303", {})).toBe("applied");
    expect(emuSetMachineType).toHaveBeenCalledWith("zxnext", "ks3-30303", {});
  });

  it("names a change another one superseded", async () => {
    emuSetMachineType.mockResolvedValue(false);
    expect(await changeMachineType("sp48", undefined, {})).toBe("superseded");
  });
});

describe("a stand-in", () => {
  it("survives the stand-in's own change, and ends with the user's next one", async () => {
    setStandIn({ machineId: "zxnext", modelId: "ks2-30204", config: {} });
    await changeMachineType("zxnext", "ks3-30303", {}, { keepStandIn: true });
    expect(chosenMachine()).toEqual({ machineId: "zxnext", modelId: "ks2-30204", config: {} });
    await changeMachineType("sp48", undefined, {});
    expect(chosenMachine()).toBeUndefined();
  });

  it("is kept when the user's change is declined", async () => {
    setStandIn({ machineId: "zxnext", modelId: "ks2-30204" });
    setup.mockResolvedValue(false);
    await changeMachineType("zxnext", "ks2-30201", {});
    expect(chosenMachine()).toEqual({ machineId: "zxnext", modelId: "ks2-30204" });
  });
});
