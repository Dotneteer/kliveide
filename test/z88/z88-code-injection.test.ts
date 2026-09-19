import { describe, expect, it, vi } from "vitest";

import createAppStore from "@state/store";
import { setMachineTypeAction } from "@state/actions";
import { MI_Z88, MI_ZXNEXT } from "@common/machines/constants";
import { Z88_NO_CODE_INJECTION } from "@emu/machines/z88/z88MachineInfo";
import { injectCode } from "@renderer/appIde/commands/KliveCompilerCommands";
import { createHarnessZ88Machine, Z88_HARNESS_BACKENDS } from "../harness/z88";

/*
 * The Cambridge Z88 has no route for code built in the IDE: OZ owns the memory and its paging, so
 * "inject", "run" and "debug" have nothing to write the code into or start it from. Both backends
 * used to answer with a stub - no code written, entry point 0 - so "run" rebooted OZ. Follow-up F4 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`: the machine declares no inject support, the IDE
 * refuses all three before compiling, and the machines refuse too if anything reaches them.
 */

function contextFor(machineId: string) {
  const store = createAppStore("ide");
  store.dispatch(setMachineTypeAction(machineId), "ide");
  // --- Anything past the refusal (compiling) would need the services this context lacks
  return { store, service: new Proxy({}, { get: () => vi.fn(() => { throw new Error("compiled"); }) }) } as any;
}

describe("Cambridge Z88: no code injection (F4)", () => {
  it.each(["inject", "run", "debug"] as const)("the IDE refuses '%s' before compiling", async (operation) => {
    const result = await injectCode(contextFor(MI_Z88), operation);
    expect(result.success).toBe(false);
    expect(result.finalMessage).toMatch(/^Cambridge Z88 (does not support injecting|cannot run code)/);
  });

  it("the ZX Spectrum Next still refuses only 'inject' (run and debug go through its .nex route)", async () => {
    const inject = await injectCode(contextFor(MI_ZXNEXT), "inject");
    expect(inject.finalMessage).toMatch(/does not support injecting code.*Use run or debug instead\./);
    await expect(injectCode(contextFor(MI_ZXNEXT), "run")).rejects.toThrow();
  });

  it.each(Z88_HARNESS_BACKENDS)("the %s machine refuses too, instead of 'starting' at address 0", async (backend) => {
    const machine = await createHarnessZ88Machine({ backend });
    expect(() => machine.injectCodeToRun({ segments: [], options: {} } as any)).toThrow(Z88_NO_CODE_INJECTION);
    await expect(machine.getCodeInjectionFlow("z88")).rejects.toThrow(Z88_NO_CODE_INJECTION);
  });
});
