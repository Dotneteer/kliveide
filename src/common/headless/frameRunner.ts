import type { CodeToInject } from "@common/abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";

import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";

/*
 * Running a machine without the emulator window (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D16): whole
 * frames, to an address, and the IDE's code-injection flows. The unit-test runner and `klive run` use
 * it, so both boot a machine exactly the same way. Emulated time only: a flow's waits, which the IDE's
 * controller spends on the host's clock, become the frames they stand for (20 ms each), so a run
 * replays identically on every computer.
 */

/** The part of a `*WasmV2Machine` the runner drives */
export type FrameMachine = {
  pc: number;
  sp: number;
  readonly frameJustCompleted: boolean;
  executionContext: {
    frameTerminationMode: FrameTerminationMode;
    terminationPoint?: number;
    terminationPartition?: number;
  };
  executeMachineFrame(): FrameTerminationMode;
  doWriteMemory(address: number, value: number): void;
  queueKeystroke?(frameOffset: number, frames: number, primary: number, secondary?: number, ternary?: number): void;
  getKeyQueueLength?(): number;
  injectCodeToRun?(code: CodeToInject): number;
};

/** The frames one emulated millisecond count stands for: a frame is 20 ms */
export function framesOfMs(ms: number): number {
  return Math.ceil(ms / 20);
}

/** The frames one `ReachExecPoint` (or a wait for the machine) may take before the flow gives up */
export const FLOW_MAX_FRAMES = 600;

/**
 * Runs until the current frame completes. A frame can end early (a breakpoint, an execution point);
 * this calls the core until a frame really is complete.
 */
export function runOneFrame(machine: FrameMachine): void {
  for (let guardCount = 0; guardCount < 1000; guardCount++) {
    machine.executeMachineFrame();
    if (machine.frameJustCompleted) return;
  }
}

/** Runs whole frames */
export function runFrames(machine: FrameMachine, count: number): void {
  for (let i = 0; i < count; i++) runOneFrame(machine);
}

/**
 * Runs until PC reaches the address, stopping before the instruction there executes
 * @throws Error when the address is not reached in `maxFrames` frames
 */
export function runToAddress(machine: FrameMachine, address: number, maxFrames = FLOW_MAX_FRAMES): void {
  const ctx = machine.executionContext;
  ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
  ctx.terminationPoint = address & 0xffff;
  ctx.terminationPartition = undefined;
  try {
    for (let frames = 0; frames < maxFrames; ) {
      if (machine.executeMachineFrame() === FrameTerminationMode.UntilExecutionPoint) return;
      if (machine.frameJustCompleted) frames++;
    }
    throw new Error(`$${hex4(address)} was not reached in ${maxFrames} frames (PC=$${hex4(machine.pc)})`);
  } finally {
    ctx.frameTerminationMode = FrameTerminationMode.Normal;
    ctx.terminationPoint = undefined;
  }
}

/** Where a played flow left the machine */
export type FlowResult = {
  /** The flow reached its `Inject` step (with `stopAtInject`, the flow stopped there) */
  injected: boolean;
  /** The address the program starts at: the injected code's entry, or the PC with `KeepPc` */
  entry: number;
};

/**
 * Plays a code-injection flow (`getCodeInjectionFlow`, `getTapeLoadFlow`) as the IDE's
 * `MachineController.executeInjectionFlow` does, minus the host's clock: `ReachExecPoint` runs to the
 * address, `QueueKey` queues the keystroke on the machine's own queue and runs the frames its wait
 * stands for, `Wait`, `WaitKeyQueue` and `WaitIdle` run frames, `Inject` and `SetReturn` act on
 * `code`. Ends where the controller would start the machine, with PC at the entry point.
 * @param machine The machine, reset as the flow expects
 * @param flow The flow
 * @param options `code` to inject; `stopAtInject` stops before injecting (the unit-test runner
 * writes the code itself)
 */
export function playInjectionFlow(
  machine: FrameMachine,
  flow: CodeInjectionFlow,
  options: { code?: CodeToInject; stopAtInject?: boolean; maxFrames?: number } = {}
): FlowResult {
  const { code, stopAtInject, maxFrames = FLOW_MAX_FRAMES } = options;
  let entry = 0;
  let keepPc = false;
  let injected = false;
  for (const step of flow) {
    switch (step.type) {
      case "KeepPc":
        keepPc = true;
        break;
      case "ReachExecPoint":
        runToAddress(machine, step.execPoint, maxFrames);
        break;
      case "QueueKey":
        machine.queueKeystroke?.(0, 5, step.primary, step.secondary, step.ternary);
        if ((step.wait ?? 100) > 0) runFrames(machine, framesOfMs(step.wait ?? 100));
        break;
      case "Wait":
        runFrames(machine, framesOfMs(step.duration ?? 100));
        break;
      case "WaitKeyQueue":
        for (let i = 0; i < maxFrames && (machine.getKeyQueueLength?.() ?? 0) > 0; i++) runOneFrame(machine);
        break;
      case "WaitIdle": {
        let consecutive = 0;
        for (let i = 0; i < maxFrames && consecutive < (step.samples ?? 12); i++) {
          runOneFrame(machine);
          consecutive = machine.pc >= step.fromAddr && machine.pc <= step.toAddr ? consecutive + 1 : 0;
        }
        break;
      }
      case "Inject":
        injected = true;
        if (stopAtInject) return { injected, entry: machine.pc };
        if (code) {
          if (!machine.injectCodeToRun) throw new Error("This machine cannot have code injected.");
          entry = machine.injectCodeToRun(code);
        }
        break;
      case "SetReturn":
        if (code?.subroutine) {
          const sp = (machine.sp - 2) & 0xffff;
          machine.doWriteMemory(sp, step.returnPoint & 0xff);
          machine.doWriteMemory((sp + 1) & 0xffff, step.returnPoint >> 8);
          machine.sp = sp;
        }
        break;
      case "Start":
        break;
    }
  }
  if (!keepPc && injected && code) machine.pc = entry;
  return { injected, entry: machine.pc };
}

function hex4(value: number): string {
  return (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}
