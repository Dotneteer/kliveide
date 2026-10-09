import type { MachineCommand } from "@abstractions/MachineCommand";
import {
  type MachineStateResult,
  type WaitUntil,
  machineStateName
} from "@common/automation/protocol";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { automationError, invalidParams } from "../errors";
import type { MethodContext, MethodTable } from "../method-types";
import { optionalInt, optionalString } from "../method-types";

/*
 * `machine.*` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.2): `EmuApi.issueMachineCommand`, and
 * `machine.wait` on the store subscription (D11). Results report the state *after* the call (T9).
 */

/** How long a command's own state change may take to reach the main store */
const SETTLE_MS = 3000;

/** The machine's state and, when it is paused or stopped, its PC */
export function machineStateOf(ctx: Pick<MethodContext, "host">): MachineStateResult {
  const emu = ctx.host.getState()?.emulatorState;
  const state = machineStateName(emu?.machineState);
  const hasPc = state === "paused" || state === "stopped";
  return hasPc && typeof emu?.pcValue === "number" ? { state, pc: emu.pcValue } : { state };
}

function requireMachine(ctx: MethodContext): void {
  if (!ctx.host.getState()?.emulatorState?.machineId) {
    throw automationError("no-machine", "No machine is set up yet.");
  }
}

/** Waits for one of the states, but never fails: the result reports wherever the machine got to */
async function settle(ctx: MethodContext, until: WaitUntil[], timeoutMs = SETTLE_MS): Promise<void> {
  try {
    await ctx.waitForMachine(until, timeoutMs);
  } catch {
    // --- The result says where the machine is
  }
}

/** Issues a machine command, reporting the emulator's refusal as a command failure */
async function issue(ctx: MethodContext, command: MachineCommand): Promise<void> {
  requireMachine(ctx);
  try {
    await ctx.host.emu.issueMachineCommand(command);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw automationError("command-failed", message);
  }
}

/** A machine command that ends in a known state */
function command(machineCommand: MachineCommand, settlesIn: WaitUntil[]): MethodTable[string] {
  return {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (_params, ctx) => {
      await issue(ctx, machineCommand);
      await settle(ctx, settlesIn);
      return machineStateOf(ctx);
    }
  };
}

const STEP_COMMANDS: Record<string, MachineCommand> = {
  into: "stepInto",
  over: "stepOver",
  out: "stepOut"
};

/** `until` as a list; "paused" also accepts "stopped" (T9: someone pressed Stop) */
export function parseWaitUntil(value: unknown): WaitUntil[] {
  const list = Array.isArray(value) ? value : [value ?? "paused"];
  const result = new Set<WaitUntil>();
  for (const item of list) {
    switch (item) {
      case "paused":
        result.add("paused");
        result.add("stopped");
        break;
      case "stopped":
        result.add("stopped");
        break;
      case "running":
        result.add("running");
        break;
      default:
        throw invalidParams(`'until' must be "paused", "stopped" or "running" (got ${JSON.stringify(item)}).`);
    }
  }
  return [...result];
}

export const machineMethods: MethodTable = {
  "machine.state": {
    level: "read",
    queued: false,
    needsReady: false,
    handler: async (_params, ctx) => machineStateOf(ctx)
  },
  "machine.start": command("start", ["running"]),
  "machine.debug": command("debug", ["running", "paused", "stopped"]),
  "machine.pause": command("pause", ["paused"]),
  "machine.stop": command("stop", ["stopped"]),
  "machine.reset": command("reset", ["running"]),
  "machine.restart": command("restart", ["running"]),
  "machine.step": {
    level: "control",
    queued: true,
    needsReady: true,
    handler: async (params, ctx) => {
      const kind = optionalString(params, "kind") ?? "into";
      const stepCommand = STEP_COMMANDS[kind];
      if (!stepCommand) throw invalidParams(`'kind' must be "into", "over" or "out" (got "${kind}").`);
      if (ctx.host.getState()?.emulatorState?.machineState !== MachineControllerState.Paused) {
        throw automationError("command-failed", "The machine must be paused to step.");
      }
      await issue(ctx, stepCommand);
      // --- A step over a long routine runs for a while: it may take the whole request
      await settle(ctx, ["paused", "stopped"], ctx.timeoutMs);
      return machineStateOf(ctx);
    }
  },
  "machine.wait": {
    level: "read",
    // --- Outside the queue (D14): a wait must not hold up the commands that end it
    queued: false,
    needsReady: true,
    unbounded: true,
    handler: async (params, ctx) => {
      const until = parseWaitUntil(params.until);
      const timeoutMs = optionalInt(params, "timeoutMs", 0, 2 ** 31 - 1);
      return await ctx.waitForMachine(until, timeoutMs);
    }
  }
};
