import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@messaging/messages-core";

import createAppStore from "@state/store";
import { MachineController } from "@emu/machines/MachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { decodeHistoryPage, HistoryKind } from "@common/history/historyRecord";

import { createCore } from "../harness/zxnext";

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
  const controller = new MachineController(createAppStore("test-exec-history"), new ResolvingMessenger(), machine as any);
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
