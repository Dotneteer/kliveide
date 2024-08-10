/**
 * This enum defines the termination condition for the machine frame.
 */
export const enum FrameTerminationMode {
  /**
   * Normal mode: the frame terminates when the current frame completes.
   */
  Normal = 0,

  /**
   * The execution completes when a debugger event occurs (e.g., stopping at a breakpoint).
   */
  DebugEvent,

  /**
   * The execution completes when the current PC address (and an optional memory partition) reaches a specified termination point.
   */
  UntilExecutionPoint
}
