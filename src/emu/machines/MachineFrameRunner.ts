import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { shouldStopAtDebugPoint } from "./DebugStepDecision";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

export interface IMachineFrameRunner {
  reset(): void;
  executeMachineFrame(): FrameTerminationMode;
}

export class MachineFrameRunner implements IMachineFrameRunner {
  // --- Store the start tact of the next machine frame
  protected _nextFrameStartTact = 0;

  constructor(private readonly machine: IAnyMachine) {}

  reset(): void {
    this._nextFrameStartTact = 0;
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop
   */
  executeMachineFrame(): FrameTerminationMode {
    // --- FIX for ISSUE #2: Don't clear frame command here - it will be cleared after response is ready
    // --- this.machine.setFrameCommand(null);
    return this.machine.executionContext.debugStepMode === DebugStepMode.NoDebug
      ? this.executeMachineLoopWithNoDebug()
      : this.executeMachineLoopWithDebug();
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop.
   */
  private executeMachineLoopWithNoDebug(): FrameTerminationMode {
    // --- Sign that the loop execution is in progress
    const machine = this.machine;
    machine.executionContext.lastTerminationReason = undefined;

    // --- Execute the machine loop until the frame is completed or the loop is interrupted because of any other
    // --- completion reason, like reaching a breakpoint, etc.
    do {
      // --- Test if the machine frame has just been completed.
      if (machine.frameCompleted) {
        // --- Update the CPU's clock multiplier, if the machine's has changed.
        let clockMultiplierChanged = false;
        if (
          machine.allowCpuClockChange() &&
          machine.clockMultiplier !== machine.targetClockMultiplier
        ) {
          // --- Use the current clock multiplier
          machine.clockMultiplier = machine.targetClockMultiplier;
          machine.tactsInCurrentFrame = machine.tactsInFrame * machine.clockMultiplier;
          clockMultiplierChanged = true;
        }

        // --- Allow a machine to handle frame initialization
        machine.onInitNewFrame(clockMultiplierChanged);
        machine.frameCompleted = false;

        // --- Emulate a keystroke, if any has been queued at all
        machine.emulateKeystroke();
      }

      // --- Allow the machine to do additional tasks before the next CPU instruction
      machine.beforeInstructionExecuted();

      const tracePcBefore = machine.pc;

      // --- Execute the next CPU instruction entirely
      do {
        if (machine.isCpuSnoozed()) {
          // --- The CPU is snoozed, mimic 4 NOPs
          machine.onSnooze();
        } else {
          machine.executeCpuCycle();
        }
      } while (machine.instructionExecutionInProgress());

      // --- Maintain the step-out stack
      if (machine.retExecuted) {
        machine.retExecuted = false;
        machine.stepOutStack.pop();
      }

      // --- Execute the queued event
      machine.consumeEvents();

      // --- Allow the machine to do additional tasks after the completed CPU instruction
      machine.afterInstructionExecuted();
      machine.traceInstructionExecuted?.(tracePcBefore);

      // --- Do the machine reached the termination point?
      if (machine.testTerminationPoint()) {
        // --- The machine reached the termination point
        return (machine.executionContext.lastTerminationReason =
          FrameTerminationMode.UntilExecutionPoint);
      }

      // --- Exit, if there is a frame command to execute
      if (machine.getFrameCommand()) {
        return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
      }
    } while (!machine.frameCompleted);

    // --- Done
    return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop.
   */
  private executeMachineLoopWithDebug(): FrameTerminationMode {
    // --- Sign that the loop execution is in progress
    const machine = this.machine;
    machine.executionContext.lastTerminationReason = undefined;

    let instructionsExecuted = 0;

    // --- Check the startup breakpoint
    if (machine.pc != machine.executionContext.debugSupport?.lastStartupBreakpoint) {
      // --- Check startup breakpoint
      if (checkBreakpoints()) {
        return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
      }
      if (machine.executionContext.lastTerminationReason !== undefined) {
        // --- The code execution has stopped at the startup breakpoint.
        // --- Sign that fact so that the next time the code do not stop
        if (machine.executionContext.debugSupport) {
          machine.executionContext.debugSupport.lastStartupBreakpoint = machine.pc;
        }
        return machine.executionContext.lastTerminationReason;
      }
    }

    // --- Remove the startup breakpoint
    if (machine.executionContext.debugSupport) {
      machine.executionContext.debugSupport.lastStartupBreakpoint = undefined;
    }

    // --- Execute the machine loop until the frame is completed or the loop is interrupted because of any other
    // --- completion reason, like reaching a breakpoint, etc.
    do {
      // --- Test if the machine frame has just been completed.
      if (machine.frameCompleted) {
        // --- Update the CPU's clock multiplier, if the machine's has changed.
        var clockMultiplierChanged = false;
        if (
          machine.allowCpuClockChange() &&
          machine.clockMultiplier != machine.targetClockMultiplier
        ) {
          // --- Use the current clock multiplier
          machine.clockMultiplier = machine.targetClockMultiplier;
          machine.tactsInCurrentFrame = machine.tactsInFrame * machine.clockMultiplier;
          clockMultiplierChanged = true;
        }

        // --- Allow a machine to handle frame initialization
        machine.onInitNewFrame(clockMultiplierChanged);
        machine.frameCompleted = false;
      }

      // --- Allow the machine to do additional tasks before the next CPU instruction
      machine.beforeInstructionExecuted();

      const tracePcBefore = machine.pc;

      // --- Execute the next CPU instruction entirely
      do {
        if (machine.isCpuSnoozed()) {
          // --- The CPU is snoozed, mimic 4 NOPs
          machine.onSnooze();
        } else {
          machine.executeCpuCycle();
        }
        instructionsExecuted++;
      } while (machine.instructionExecutionInProgress());

      // --- Maintain the step-out stack
      if (machine.retExecuted) {
        machine.retExecuted = false;
        machine.stepOutStack.pop();
      }

      // --- Execute the queued event
      machine.consumeEvents();

      // --- Allow the machine to do additional tasks after the completed CPU instruction
      machine.afterInstructionExecuted();
      machine.traceInstructionExecuted?.(tracePcBefore);

      if (machine.executionContext.debugSupport) {
        // --- Check for memory read/write breakpoints
        if (
          machine.executionContext.debugSupport.hasMemoryRead(
            machine.lastMemoryReads,
            machine.lastMemoryReadsCount,
            (addr) => machine.getPartition(addr)
          )
        ) {
          return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
        }
        if (
          machine.executionContext.debugSupport.hasMemoryWrite(
            machine.lastMemoryWrites,
            machine.lastMemoryWritesCount,
            (addr) => machine.getPartition(addr)
          )
        ) {
          return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
        }

        // --- Check for port read/write breakpoints
        if (machine.executionContext.debugSupport.hasIoRead(machine.lastIoReadPort)) {
          return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
        }
        if (machine.executionContext.debugSupport.hasIoWrite(machine.lastIoWritePort)) {
          return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
        }
      }

      // --- Do the machine reached the termination point?
      if (machine.testTerminationPoint()) {
        // --- The machine reached the termination point
        return (machine.executionContext.lastTerminationReason =
          FrameTerminationMode.UntilExecutionPoint);
      }

      // --- Test if the execution reached a breakpoint
      if (checkBreakpoints()) {
        return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
      }
      if (machine.executionContext.lastTerminationReason !== undefined) {
        // --- The code execution has stopped at the startup breakpoint.
        // --- Sign that fact so that the next time the code do not stop
        if (machine.executionContext.debugSupport) {
          machine.executionContext.debugSupport.lastStartupBreakpoint = machine.pc;
        }
        return machine.executionContext.lastTerminationReason;
      }

      // --- Exit, if there is a frame command to execute
      if (machine.getFrameCommand()) {
        return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
      }
    } while (!machine.frameCompleted);

    // --- Done
    return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);

    // --- This method tests if any breakpoint is reached during the execution of the machine frame
    // --- to suspend the loop.
    function checkBreakpoints(): boolean {
      // --- The machine must support debugging
      const debugSupport = machine.executionContext.debugSupport;
      if (!debugSupport) return false;

      /*
       * Step-into is answered here rather than in `shouldStopAtDebugPoint`, and deliberately so.
       *
       * This path tests it *before* the breakpoint check; the WASM v2 machines test it *after*
       * theirs. The difference is observable — landing on a breakpoint while stepping into records
       * `lastBreakpoint` on one path and not the other — so folding it into the shared function
       * would have to change one of them. Left where each already had it.
       */
      if (machine.executionContext.debugStepMode === DebugStepMode.StepInto) {
        // --- Stop right after the first executed instruction
        const shouldStop = instructionsExecuted > 0;
        if (shouldStop) {
          debugSupport.imminentBreakpoint = undefined;
        }
        return shouldStop;
      }

      return shouldStopAtDebugPoint({
        debugSupport,
        debugStepMode: machine.executionContext.debugStepMode,
        pc: machine.pc,
        instructionsExecuted,
        getPartition: (address) => machine.getPartition(address),
        getCallInstructionLength: () => machine.getCallInstructionLength(),
        stepOutAddress: machine.stepOutAddress,
        /*
         * `false` on purpose, and it is the *stronger* behaviour rather than the weaker one.
         *
         * `retExecuted` stops on the first RET of any kind, including one returning from a call
         * nested inside the routine being stepped out of — it overshoots inward. The interpreted
         * CPUs maintain a real step-out stack (`Z80Cpu.pushToStepOutStack`, called from CALL/RST),
         * so `stepOutAddress` here is the exact address *this* routine will return to, which is
         * what `DebugStepMode.StepOut` is documented to mean: the RET "when it returns to its
         * caller".
         *
         * The WASM machines use `retExecuted` because they cannot do this: their CPU runs inside
         * the core, those TS methods never execute, the stack stays empty and `stepOutAddress` is
         * permanently -1. There it is the only workable signal, not a refinement. Turning it on
         * here would trade an exact mechanism for an approximation of itself.
         */
        retExecuted: false
      });
    }
  }
}
