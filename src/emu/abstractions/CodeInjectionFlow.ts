export type CodeInjectionFlow = CodeInjectionStep[];

export type CodeInjectionStep =
  | ReachExecPointStep
  | InjectStep
  | SetReturnStep
  | QueueKeyStep
  | StartStep
  | KeepPcStep
  | WaitStep
  | WaitKeyQueueStep
  | WaitIdleStep;

interface CodeInjectionStepBase {
  type: CodeInjectionStep["type"];
  message?: string;
}

interface ReachExecPointStep extends CodeInjectionStepBase {
  type: "ReachExecPoint";
  rom: number;
  execPoint: number;

  /**
   * Opts this step into checkpointing under the given key.
   *
   * Reaching an execution point means single-stepping the machine there, which for a cold boot is by
   * far the most expensive thing an injection flow does. When this is set and the machine supports
   * checkpoints, the first run captures the state it arrives at, and later runs restore it instead of
   * repeating the journey. A machine without checkpoint support just runs the step normally.
   */
  checkpoint?: string;
}

interface InjectStep extends CodeInjectionStepBase {
  type: "Inject";
}

interface SetReturnStep extends CodeInjectionStepBase {
  type: "SetReturn";
  returnPoint: number;
}

interface QueueKeyStep extends CodeInjectionStepBase {
  type: "QueueKey";
  primary: number;
  secondary?: number;
  ternary?: number;
  wait?: number;
}

interface StartStep extends CodeInjectionStepBase {
  type: "Start";
}

interface KeepPcStep extends CodeInjectionStepBase {
  type: "KeepPc";
}

interface WaitStep extends CodeInjectionStepBase {
  type: "Wait";
  duration: number;
}

/**
 * Waits until the machine has actually played back every queued keystroke.
 *
 * `Wait` is a host-side `delay()`, which says nothing about how far the *emulated* machine has got.
 * That matters after a keystroke that makes the OS do work: a key is only queued by `QueueKey`, and
 * it is consumed frames later by `emulateKeystroke()`. Following such a key with `ReachExecPoint` on
 * an idle loop the machine has not left yet matches instantly and proves nothing.
 *
 * This step is paced by the machine: it polls `getKeyQueueLength()` until the queue drains, so the
 * keystroke has demonstrably been delivered before the flow moves on.
 *
 * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.13.
 */
interface WaitKeyQueueStep extends CodeInjectionStepBase {
  type: "WaitKeyQueue";

  /** Give up after this many milliseconds rather than hanging the flow. Defaults to 5000. */
  timeoutMs?: number;
}

/**
 * Waits until the machine is *parked* in an idle loop, rather than merely passing through it.
 *
 * `ReachExecPoint` stops the moment an address is reached once, which is worthless when the address
 * is somewhere the OS visits constantly. NextZXOS waits for every keypress in one HALT loop:
 *
 * ```
 * $1202: HALT
 * $1203: LD HL,$5C3B      ; FLAGS
 * $1206: BIT 5,(HL)       ; a key is available?
 * $1208: JR Z,$11F4       ; no - keep waiting
 * ```
 *
 * That loop is entered during boot, at the boot menu, at the BASIC prompt and inside the Calculator
 * alike, so "reached $1202" says only "something wants a key" - not "the program you were waiting
 * for is up". Waiting on it let the flow type into the boot menu, where the characters navigated the
 * menu instead (`c` of `ScrollNutter` starting the Calculator).
 *
 * This step samples the program counter repeatedly and only completes once it has found the machine
 * inside the loop on `samples` consecutive polls. While the OS is loading something it is doing real
 * work and cannot satisfy that; once it is genuinely sitting at a prompt it satisfies it at once.
 *
 * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.14.
 */
interface WaitIdleStep extends CodeInjectionStepBase {
  type: "WaitIdle";

  /** First address of the idle loop. */
  fromAddr: number;

  /** Last address of the idle loop, inclusive. */
  toAddr: number;

  /** Consecutive in-loop samples required before the machine counts as idle. Defaults to 12. */
  samples?: number;

  /** Milliseconds between samples. Defaults to 20. */
  intervalMs?: number;

  /** Give up after this many milliseconds rather than hanging the flow. Defaults to 10000. */
  timeoutMs?: number;
}
