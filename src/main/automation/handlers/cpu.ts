import { MachineControllerState } from "@abstractions/MachineControllerState";
import { automationError, invalidParams } from "../errors";
import type { MethodContext, MethodTable } from "../method-types";
import { requireInt, requireString } from "../method-types";

/*
 * `cpu.get` and `cpu.set` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2): `EmuApi.getCpuState`
 * and `setRegisterValue`.
 */

/** The registers `cpu.set` writes, with their widths (the names `setRegisterValue` accepts) */
export const WRITABLE_REGISTERS: Record<string, 8 | 16> = {
  A: 8, F: 8, B: 8, C: 8, D: 8, E: 8, H: 8, L: 8, I: 8, R: 8,
  XH: 8, XL: 8, YH: 8, YL: 8,
  AF: 16, BC: 16, DE: 16, HL: 16, "AF'": 16, "BC'": 16, "DE'": 16, "HL'": 16,
  IX: 16, IY: 16, SP: 16, PC: 16, WZ: 16
};

/**
 * The CPU state as plain registers: every scalar field the emulator reports (the history cursor's
 * state when it is in the past, as the IDE shows it), plus the Z80's 8-bit halves. The access
 * traces (`lastMemoryReads`, ...) and the Next's last-event records are left out.
 */
export async function readCpu(ctx: Pick<MethodContext, "host">): Promise<Record<string, number | boolean>> {
  const state = (await ctx.host.emu.getCpuState()) as unknown as Record<string, unknown>;
  const result: Record<string, number | boolean> = {};
  for (const [key, value] of Object.entries(state ?? {})) {
    if (key.startsWith("last")) continue;
    if (typeof value === "number" || typeof value === "boolean") result[key] = value;
  }
  if (typeof result.af === "number") {
    const word = (name: string) => result[name] as number;
    result.a = word("af") >> 8;
    result.f = word("af") & 0xff;
    result.b = word("bc") >> 8;
    result.c = word("bc") & 0xff;
    result.d = word("de") >> 8;
    result.e = word("de") & 0xff;
    result.h = word("hl") >> 8;
    result.l = word("hl") & 0xff;
    if (typeof result.ir === "number") {
      result.i = word("ir") >> 8;
      result.r = word("ir") & 0xff;
    }
  }
  return result;
}

export const cpuMethods: MethodTable = {
  "cpu.get": {
    level: "read",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => readCpu(ctx)
  },
  "cpu.set": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const register = requireString(params, "register").trim().toUpperCase();
      const width = WRITABLE_REGISTERS[register];
      if (!width) {
        throw invalidParams(
          `Unknown register '${register}'. Use one of: ${Object.keys(WRITABLE_REGISTERS).join(", ")}.`
        );
      }
      const value = requireInt(params, "value", 0, width === 8 ? 0xff : 0xffff);
      const machineState = ctx.host.getState()?.emulatorState?.machineState;
      if (machineState === MachineControllerState.Running) {
        throw automationError("command-failed", "Pause the machine before changing a register.");
      }
      await ctx.host.emu.setRegisterValue(register, value);
      return readCpu(ctx);
    }
  }
};
