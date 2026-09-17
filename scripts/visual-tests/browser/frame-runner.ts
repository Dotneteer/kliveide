import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { MessengerBase } from "@messaging/MessengerBase";
import type { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

/** The app's 50 Hz frame, used to turn the launch flow's millisecond waits into frames. */
export const MS_PER_FRAME = 20;
const msToFrames = (ms: number | undefined, fallback: number) => Math.max(0, Math.ceil((ms ?? fallback) / MS_PER_FRAME));

/**
 * Runs the machine the way `MachineController`'s execution loop does - frame commands answered after
 * each `executeMachineFrame`, the display refreshed on completed frames - but with no real-time pacing:
 * frames run as fast as the browser allows, and every wait is counted in emulated frames. That makes a
 * run through NextZXOS deterministic, which a wall-clock-paced flow is not.
 */
export class FrameRunner {
  /** Completed frames since the runner was created. */
  frames = 0;

  constructor(
    readonly machine: ZxNextWasmV2Machine,
    private readonly messenger: MessengerBase,
    /** Called on every completed frame, with the buffer as the emulator panel would show it. */
    private readonly onFrame: (frameNo: number) => void | Promise<void>
  ) {}

  /** One pass of the controller loop. Returns the termination mode. */
  async step(): Promise<FrameTerminationMode> {
    const m = this.machine;
    const termination = m.executeMachineFrame();
    if (termination === FrameTerminationMode.Normal && m.frameJustCompleted) {
      this.frames++;
      await this.onFrame(this.frames);
      m.renderInstantScreen();
    }
    if (m.getFrameCommand()) {
      await m.processFrameCommand(this.messenger);
      m.setFrameCommand(null);
    }
    if (this.frames % 20 === 0) await new Promise((r) => setTimeout(r, 0)); // let the page breathe
    return termination;
  }

  async runFrames(count: number): Promise<void> {
    const target = this.frames + count;
    while (this.frames < target) await this.step();
  }

  async runUntil(what: string, done: () => boolean, maxFrames: number): Promise<void> {
    const limit = this.frames + maxFrames;
    while (!done()) {
      if (this.frames >= limit) throw new Error(`Timed out after ${maxFrames} frames waiting for ${what} (PC=$${this.machine.pc.toString(16)})`);
      await this.step();
    }
  }

  /** `ReachExecPoint`: run until PC hits the address (the core stops mid-frame there). */
  async runToExecPoint(execPoint: number, maxFrames: number): Promise<void> {
    const ctx = this.machine.executionContext;
    ctx.frameTerminationMode = FrameTerminationMode.UntilExecutionPoint;
    ctx.debugStepMode = DebugStepMode.NoDebug;
    ctx.terminationPoint = execPoint;
    ctx.canceled = false;
    const limit = this.frames + maxFrames;
    try {
      while (true) {
        if (this.frames >= limit) throw new Error(`Timed out after ${maxFrames} frames reaching $${execPoint.toString(16)}`);
        const t = await this.step();
        if (t === FrameTerminationMode.UntilExecutionPoint) return;
      }
    } finally {
      ctx.frameTerminationMode = FrameTerminationMode.Normal;
      ctx.terminationPoint = undefined;
    }
  }

  /**
   * Interprets a `getCodeInjectionFlow` result in frames. Checkpoints are ignored: every run is a cold
   * boot, so nothing depends on what an earlier run left behind.
   */
  async runInjectionFlow(flow: CodeInjectionFlow, log: (s: string) => void, stopBefore?: string): Promise<void> {
    const m = this.machine;
    for (const step of flow) {
      if (stopBefore && step.message === stopBefore) return;
      switch (step.type) {
        case "KeepPc":
        case "Start":
          break;
        case "ReachExecPoint":
          await this.runToExecPoint(step.execPoint, 15_000);
          break;
        case "Wait":
          await this.runFrames(msToFrames(step.duration, 100));
          break;
        case "WaitIdle": {
          const needed = step.samples ?? 12;
          let consecutive = 0;
          await this.runUntil(
            `the machine to idle in $${step.fromAddr.toString(16)}-$${step.toAddr.toString(16)}`,
            () => {
              const pc = m.pc;
              consecutive = pc >= step.fromAddr && pc <= step.toAddr ? consecutive + 1 : 0;
              return consecutive >= needed;
            },
            5_000
          );
          break;
        }
        case "WaitKeyQueue":
          await this.runUntil("the key queue to drain", () => m.getKeyQueueLength() === 0, 5_000);
          break;
        case "QueueKey":
          m.queueKeystroke(0, 5, step.primary, step.secondary);
          await this.runFrames(msToFrames(step.wait, 100));
          break;
        default:
          throw new Error(`Flow step '${(step as { type: string }).type}' is not supported by the browser tier`);
      }
      if (step.message) log(`  flow: ${step.message} (frame ${this.frames})`);
    }
  }
}
