import { describe, expect, it } from "vitest";

import type { ResponseMessage } from "@messaging/messages-core";

import createAppStore from "@state/store";
import { MC_Z88_SLOT1, MC_Z88_SLOT2 } from "@common/machines/constants";
import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { CardIds } from "@emu/machines/z88/CardIds";
import { isZ88IdeMachine } from "@emu/machines/z88/IZ88IdeMachine";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import { createHarnessZ88Machine } from "../harness/z88";

/*
 * Host-level behaviour of the Cambridge Z88 machine: what the IDE and the card dialogs rely on,
 * independent of how the hardware is emulated. Step 0.1 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.
 */

const SLOT_BASE = 0x10_0000;

/** A Z88 on a blank core: no ROM, nothing running - the host plumbing alone */
async function createZ88(): Promise<Z88WasmV2Machine> {
  return (await createHarnessZ88Machine()) as Z88WasmV2Machine;
}

/**
 * A file provider whose reads settle only after a macrotask, so a caller that does not await them
 * observes the card before its contents arrive.
 */
function delayedFileProvider(files: Record<string, Uint8Array>) {
  return {
    readBinaryFile: (name: string) =>
      new Promise<Uint8Array>((resolve, reject) =>
        setTimeout(() => (files[name] ? resolve(files[name]) : reject(new Error(`No ${name}`))), 5)
      )
  };
}

describe("Z88 host - memory contents", () => {
  it("getMemoryContents answers for a Z88 (selected ROM page and RAM bank are not applicable)", async () => {
    const machine = await createZ88();
    const store = createAppStore("emu");
    const response = (await processMainToEmuMessages(
      { type: "ApiMethodRequest", method: "getMemoryContents", args: [] },
      store,
      undefined,
      {
        machineService: {
          getMachineController: () => ({ machine, debugSupport: { breakpoints: [] as unknown[] } })
        }
      } as any
    )) as ResponseMessage & { result?: any };

    expect(response.type).toBe("ApiMethodResponse");
    expect(response.result.memory).toHaveLength(0x1_0000);
    expect(response.result.selectedRom).toBe(0);
    expect(response.result.selectedBank).toBe(0);
  });
});

describe("Z88 host - configure()", () => {
  it("resolves only after the slot cards have been loaded and inserted", async () => {
    const machine = await createZ88();
    const card = new Uint8Array(0x8000).fill(0x5a);
    machine.setMachineProperty(FILE_PROVIDER, delayedFileProvider({ "ram.bin": card }));
    machine.dynamicConfig = {
      [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "ram.bin" }
    };

    await machine.configure();

    expect(machine.directReadMemory(1 * SLOT_BASE)).toBe(0x5a);
    expect(machine.directReadMemory(1 * SLOT_BASE + 0x7fff)).toBe(0x5a);
  });

  it("inserts the other slots even when one card file cannot be read", async () => {
    const machine = await createZ88();
    const card = new Uint8Array(0x8000).fill(0xa5);
    machine.setMachineProperty(FILE_PROVIDER, delayedFileProvider({ "ok.bin": card }));
    machine.dynamicConfig = {
      [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "missing.bin" },
      [MC_Z88_SLOT2]: { size: 32, cardType: CardIds.RAM32, file: "ok.bin" }
    };

    await expect(machine.configure()).rejects.toThrow("No missing.bin");

    // --- The failure is reported only after the other slot has been inserted
    expect(machine.directReadMemory(2 * SLOT_BASE)).toBe(0xa5);
  });
});

describe("Z88 host - Blink panel state (IZ88IdeMachine)", () => {
  async function requestBlinkState(machine: unknown) {
    return (await processMainToEmuMessages(
      { type: "ApiMethodRequest", method: "getBlinkState", args: [] },
      createAppStore("emu"),
      undefined,
      {
        machineService: {
          getMachineController: () => ({ machine, debugSupport: { breakpoints: [] as unknown[] } })
        }
      } as any
    )) as ResponseMessage & { result?: any; message?: string };
  }

  it("the Z88 is an IZ88IdeMachine; other machines are not", async () => {
    expect(isZ88IdeMachine(await createZ88())).toBe(true);
    expect(isZ88IdeMachine({ machineId: "sp48" })).toBe(false);
    expect(isZ88IdeMachine({ machineId: "z88" })).toBe(false);
    expect(isZ88IdeMachine(undefined)).toBe(false);
  });

  it("reports the Blink, keyboard, beeper and LCD registers written through the ports", async () => {
    const machine = await createZ88();
    // --- Blink registers, through the ports Z80 code would use
    machine.doWritePort(0x00d1, 0x21); // SR1
    machine.doWritePort(0x00d2, 0x22); // SR2
    machine.doWritePort(0x00d3, 0x40); // SR3
    machine.doWritePort(0x00b1, 0x0b); // INT = BTL | TIME | GINT
    machine.doWritePort(0x00b5, 0x03); // TMK
    machine.doWritePort(0x00b3, 0x48); // EPR
    // --- LCD registers: B supplies the high byte of the 16-bit value
    machine.doWritePort(0x1270, 0x34); // PB0 = $1234
    machine.doWritePort(0x0574, 0x60); // SBR = $0560
    // --- A key down on line 3
    machine.setKeyStatus(3 * 8 + 2, true);

    const response = await requestBlinkState(machine);

    expect(response.type).toBe("ApiMethodResponse");
    const state = response.result;
    expect(state).toEqual(machine.getBlinkState());
    expect(state).toMatchObject({
      SR1: 0x21,
      SR2: 0x22,
      SR3: 0x40,
      INT: 0x0b,
      TMK: 0x03,
      EPR: 0x48,
      PB0: 0x1234,
      SBR: 0x0560,
      SCW: 0xff,
      SCH: 8
    });
    expect(state.keyLines).toHaveLength(8);
    expect(state.keyLines[3]).toBe(0x04);
    expect(state.keyLines.filter((v: number) => v !== 0)).toHaveLength(1);
    expect(typeof state.oscBit).toBe("boolean");
    expect(typeof state.earBit).toBe("boolean");
  });

  it("reading the state has no side effects", async () => {
    const machine = await createZ88();
    const before = machine.getBlinkState();
    await requestBlinkState(machine);
    await requestBlinkState(machine);
    expect(machine.getBlinkState()).toEqual(before);
  });

  it("answers with an error for a machine that is not a Z88", async () => {
    const response = await requestBlinkState({ machineId: "sp48" });
    expect(response.type).toBe("ErrorResponse");
    expect(response.message).toContain("BLINK device is not available");
  });
});
