import type { DebugStepMode } from "./DebugStepMode";
import type { FrameTerminationMode } from "./FrameTerminationMode";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";

/**
 * This type defines the execution context in which an emulated machine can run its execution loop.
 */
export type ExecutionContext = {
  /**
   * This property defines how the machine's execution loop completes.
   */
  frameTerminationMode: FrameTerminationMode;

  /**
   * This property defines how the machine execution loop should handle the debug mode.
   */
  debugStepMode: DebugStepMode;

  /**
   * The optional termination partition, at which the execution loop should stop when it is in the
   * UntilExecutionPoint loop termination mode. For example, in the case of ZX Spectrum 48K, this property has no
   * meaning. For ZX Spectrum 128K (and above), this value may be the current ROM index.
   */
  terminationPartition?: number;

  /**
   * This optional 16-bit value defines the PC value that is considered the termination point, provided the
   * execution loop is in the UntilExecutionPoint loop termination mode.
   */
  terminationPoint?: number;

  /**
   * This property describes the termination reason of the last machine execution loop. It returns null if the
   * execution loop has not been started at least once.
   */
  lastTerminationReason?: FrameTerminationMode;

  /**
   * Has the last execution loop cancelled?
   */
  canceled: boolean;

  /**
   * A reverse-debugging replay run is going toward the present (`.plans/REVERSE_DEBUGGING_PLAN.md`
   * D11): the per-instruction loops ask the core's history recorder after every instruction whether
   * its stop target (the next journal entry) is reached, and return `UntilExecutionPoint` if it is.
   */
  historyStopArmed?: boolean;

  /**
   * Whether a reverse-debugging replay is running (`.plans/REVERSE_DEBUGGING_PLAN.md` D13): host side
   * effects a machine produces itself - the Z88's serial output, for one - stay off, since the
   * journal re-does the core's part and the host already saw the rest. Set by the controller.
   */
  isReplayingHistory?: () => boolean;

  /**
   * The object that provides debug support for the machone
   */
  debugSupport?: IDebugSupport;
};
