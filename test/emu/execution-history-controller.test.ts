import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";

import createAppStore from "@state/store";
import { withAdvancedDebugging } from "../advanced-debugging-helper";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { decodeHistoryPage, HistoryKind } from "@common/history/historyRecord";

import { historyContextDecoder } from "@common/history/contexts";
import { createCore } from "../harness/zxnext";
import { createSp48Session } from "../harness/sp48";
import { createZ88Session } from "../harness/z88";
import { createZx81Session } from "../harness/zx81";

/*
 * The controller's half of the execution history (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` D8, D9),
 * on the real ZX Spectrum Next core: recording only in debug sessions, history kept across pauses and
 * steps, and cleared on a start from Stopped and on a state restore.
 */

class ResolvingMessenger extends MessengerBase {
  protected send(message: RequestMessage): void {
    if (message.correlationId != null) {
      this.processResponse({ type: "ApiMethodResponse", correlationId: message.correlationId, result: undefined });
    }
  }
  get requestChannel(): Channel {
    return "EmuToMain";
  }
  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function controllerWithNext() {
  const machine = await createCore({ hardReset: true });
  const controller = new MachineController(withAdvancedDebugging(createAppStore("test-exec-history")), new ResolvingMessenger(), machine as any);
  return { machine, controller };
}

describe("execution history through the machine controller", () => {
  it("records in a debug session, keeps history across a pause and a step, and reads it after the stop", async () => {
    const { machine, controller } = await controllerWithNext();
    await controller.startDebug();
    await wait(120);
    await controller.pause();
    expect(controller.state).toBe(MachineControllerState.Paused);

    const info = machine.getHistoryInfo()!;
    expect(info.enabled).toBe(true);
    expect(info.count).toBeGreaterThan(0);
    // --- The newest record is the instruction before the paused PC... or an event at it
    const newest = decodeHistoryPage(machine.readHistory(info.newestSequence, 1)!)[0];
    expect(newest.sequence).toBe(info.newestSequence);

    // --- A step adds to the history; it does not start it over
    const pcBeforeStep = machine.pc;
    await controller.stepInto();
    await wait(20);
    const afterStep = machine.getHistoryInfo()!;
    expect(afterStep.generation).toBe(info.generation);
    expect(afterStep.newestSequence).toBeGreaterThan(info.newestSequence);
    const stepped = decodeHistoryPage(machine.readHistory(info.newestSequence + 1, afterStep.newestSequence - info.newestSequence)!);
    expect(stepped.some((r) => r.regs.pc === pcBeforeStep || r.kind !== HistoryKind.Instruction)).toBe(true);
    await controller.stop();
  });

  it("records nothing and keeps no timeline with the advanced-debugging switch off (the default)", async () => {
    const machine = await createCore({ hardReset: true });
    const controller = new MachineController(createAppStore("test-exec-history-off"), new ResolvingMessenger(), machine as any);
    await controller.startDebug();
    await wait(60);
    await controller.pause();
    const info = machine.getHistoryInfo()!;
    expect(info.enabled).toBe(false);
    expect(info.count).toBe(0);
    expect(controller.timeline).toBeUndefined();
    await controller.stop();
  });

  it("does not record a plain Run, and a start from Stopped clears the ring", async () => {
    const { machine, controller } = await controllerWithNext();
    await controller.startDebug();
    await wait(60);
    await controller.pause();
    const debugInfo = machine.getHistoryInfo()!;
    expect(debugInfo.count).toBeGreaterThan(0);

    await controller.stop();
    await controller.start();
    await wait(60);
    await controller.pause();
    const runInfo = machine.getHistoryInfo()!;
    expect(runInfo.enabled).toBe(false);
    expect(runInfo.count).toBe(0);
    expect(runInfo.generation).toBeGreaterThan(debugInfo.generation);
    await controller.stop();
  });

  it("clears the ring on a state restore: that history belongs to another timeline", async () => {
    const { machine, controller } = await controllerWithNext();
    await controller.startDebug();
    await wait(60);
    await controller.pause();
    const saved = machine.saveMachineState();
    await controller.startDebug();
    await wait(40);
    await controller.pause();
    const before = machine.getHistoryInfo()!;
    expect(before.count).toBeGreaterThan(0);

    await controller.restoreState(() => machine.loadMachineState(saved), "State restored");
    const after = machine.getHistoryInfo()!;
    expect(after.count).toBe(0);
    expect(after.generation).toBe(before.generation + 1);
    await controller.stop();
  });
});

/*
 * Every other core (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`): the same controller code, no
 * machine-specific handler. The 48K's debugger runs instructions from TypeScript; the ZX81's and the
 * Z88's run them in C (`…ExecuteUntilStop`), which records too.
 */
describe.each([
  ["the ZX Spectrum 48K", "sp48", async () => (await createSp48Session()).machine],
  ["the ZX81", "zx81", async () => (await createZx81Session()).machine],
  ["the Cambridge Z88", "z88", async () => (await createZ88Session()).machine]
] as const)("execution history through the machine controller on %s", (_name, machineId, create) => {
  it("records in a debug session for the machine's decoder, and not in a plain Run", async () => {
    const machine = await create();
    const controller = new MachineController(withAdvancedDebugging(createAppStore(`test-exec-history-${machineId}`)), new ResolvingMessenger(), machine as any);
    await controller.startDebug();
    await wait(120);
    await controller.pause();
    const info = machine.getHistoryInfo()!;
    expect(info).toMatchObject({ enabled: true, machineId, capacity: 65536 });
    expect(info.count).toBeGreaterThan(100);
    expect(historyContextDecoder(info.machineId)).toBeDefined();
    const newest = decodeHistoryPage(machine.readHistory(info.newestSequence, 1)!)[0];
    expect(newest.sequence).toBe(info.newestSequence);

    await controller.stop();
    await controller.start();
    await wait(60);
    await controller.pause();
    expect(machine.getHistoryInfo()).toMatchObject({ enabled: false, count: 0 });
    await controller.stop();
  });
});
