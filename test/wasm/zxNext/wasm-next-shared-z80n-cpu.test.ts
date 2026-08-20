import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { DebugSupport } from "@emu/machines/DebugSupport";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { productionOutput } from "../../../scripts/build-zxnext-wasm.cjs";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM shared Z80N CPU integration", () => {
  it("builds the ZX Next artifact around the shared Z80N CPU source", async () => {
    const cpuWrapper = readFileSync("src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c", "utf8");
    const sharedCpu = readFileSync("src/emu/z80/wasm/z80.c", "utf8");

    expect(cpuWrapper).toContain('#include "../../../../z80/wasm/z80.c"');
    expect(cpuWrapper).toContain("#define Z80_EXTERNAL_BUS 1");
    expect(cpuWrapper).toContain("#define Z80_WRITE_TBBLUE");
    expect(sharedCpu).toContain("z80nMode");
    expect(sharedCpu).toContain("static void z80n91NextregN");
    expect(statSync(productionOutput).size).toBeGreaterThan(90_000);
  });

  it("runs Z80N NEXTREG instructions through the shared CPU into ZX Next state", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.hardReset();
    machine.doWriteMemory(0x8000, 0xed);
    machine.doWriteMemory(0x8001, 0x91);
    machine.doWriteMemory(0x8002, 0x07);
    machine.doWriteMemory(0x8003, 0x03);
    machine.pc = 0x8000;
    machine.executionContext.debugStepMode = DebugStepMode.StepInto;
    machine.executionContext.frameTerminationMode = FrameTerminationMode.Normal;
    machine.executionContext.debugSupport = new DebugSupport(undefined, []);

    expect(machine.wasmV2Runtime!.exports.zxnextGetSharedZ80NMode()).toBe(1);
    expect(machine.executeMachineFrame()).toBe(FrameTerminationMode.DebugEvent);
    expect(machine.wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(0x07)).toBe(0x03);
    expect(machine.pc).toBe(0x8004);
  });
});
