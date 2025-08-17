import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

export interface IMachineFrameRunner {
  get frameCompleted(): boolean;

  reset(): void;
  executeMachineFrame(): FrameTerminationMode;
}

export class MachineFrameRunner implements IMachineFrameRunner {
  // --- This flag indicates that the last machine frame has been completed.
  protected _frameCompleted: boolean;

  // --- Shows the number of frame tacts that overflow to the subsequent machine frame.
  protected _frameOverflow: number;

  // --- Store the start tact of the next machine frame
  protected _nextFrameStartTact = 0;

  constructor(private readonly machine: IAnyMachine) {}

  get frameCompleted(): boolean {
    return this._frameCompleted;
  }

  reset(): void {
    this._frameCompleted = false;
    this._frameOverflow = 0;
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop
   */
  executeMachineFrame(): FrameTerminationMode {
    this.machine.setFrameCommand(null);
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
      if (this._frameCompleted) {
        const currentFrameStart = machine.tacts - this._frameOverflow;

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
        this._frameCompleted = false;

        // --- Calculate the start tact of the next machine frame
        this._nextFrameStartTact =
          currentFrameStart + machine.tactsInFrame * machine.clockMultiplier;

        // --- Emulate a keystroke, if any has been queued at all
        machine.emulateKeystroke();
      }

      // --- Allow the machine to do additional tasks before the next CPU instruction
      machine.beforeInstructionExecuted();

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

      // --- Do the machine reached the termination point?
      if (machine.testTerminationPoint()) {
        // --- The machine reached the termination point
        return (machine.executionContext.lastTerminationReason =
          FrameTerminationMode.UntilExecutionPoint);
      }

      // --- Test if the machine frame has just been completed.
      this._frameCompleted = machine.tacts >= this._nextFrameStartTact;

      // --- Exit, if there is a frame command to execute
      if (machine.getFrameCommand()) {
        return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
      }
    } while (!this._frameCompleted);

    // --- Calculate the overflow, we need this value in the next frame
    this._frameOverflow = Math.floor(machine.tacts - this._nextFrameStartTact);

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
      if (this._frameCompleted) {
        const currentFrameStart = machine.tacts - this._frameOverflow;

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
        this._frameCompleted = false;

        // --- Calculate the start tact of the next machine frame
        this._nextFrameStartTact =
          currentFrameStart + machine.tactsInFrame * machine.clockMultiplier;
      }

      // --- Allow the machine to do additional tasks before the next CPU instruction
      machine.beforeInstructionExecuted();

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

      if (machine.executionContext.debugSupport) {
        // --- Check for memory read/write breakpoints
        if (
          machine.executionContext.debugSupport.hasMemoryRead(machine.lastMemoryReads, (addr) =>
            machine.getPartition(addr)
          )
        ) {
          return (machine.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
        }
        if (
          machine.executionContext.debugSupport.hasMemoryWrite(machine.lastMemoryWrites, (addr) =>
            machine.getPartition(addr)
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

      // --- Test if the machine frame has just been completed.
      this._frameCompleted = machine.tacts >= this._nextFrameStartTact;

      // --- Exit, if there is a frame command to execute
      if (machine.getFrameCommand()) {
        return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
      }
    } while (!this._frameCompleted);

    // --- Calculate the overflow, we need this value in the next frame
    this._frameOverflow = Math.floor(machine.tacts - this._nextFrameStartTact);

    // --- Done
    return (machine.executionContext.lastTerminationReason = FrameTerminationMode.Normal);

    // --- This method tests if any breakpoint is reached during the execution of the machine frame
    // --- to suspend the loop.
    function checkBreakpoints(): boolean {
      // --- The machine must support debugging
      const debugSupport = machine.executionContext.debugSupport;
      if (!debugSupport) return false;

      if (machine.executionContext.debugStepMode === DebugStepMode.StepInto) {
        // --- Stop right after the first executed instruction
        const shouldStop = instructionsExecuted > 0;
        if (shouldStop) {
          debugSupport.imminentBreakpoint = undefined;
        }
        return shouldStop;
      }

      // --- Go on with StepAtBreakpoint, StepOver, and StepOut
      // --- Stop if PC reaches a breakpoint
      const stopAt = debugSupport.shouldStopAt(machine.pc, () => machine.getPartition(machine.pc));
      if (
        stopAt &&
        (instructionsExecuted > 0 ||
          debugSupport.lastBreakpoint === undefined ||
          debugSupport.lastBreakpoint !== machine.pc)
      ) {
        // --- Stop when reached a breakpoint
        debugSupport.lastBreakpoint = machine.pc;
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }

      if (machine.executionContext.debugStepMode === DebugStepMode.StopAtBreakpoint) {
        // --- No breakpoint found and we stop only at defined breakpoints.
        return false;
      }

      // --- Step over checks
      if (machine.executionContext.debugStepMode === DebugStepMode.StepOver) {
        if (debugSupport.imminentBreakpoint !== undefined) {
          // --- We also stop if an imminent breakpoint is reached, and also remove this breakpoint
          if (debugSupport.imminentBreakpoint === machine.pc) {
            debugSupport.imminentBreakpoint = undefined;
            return true;
          }
        } else {
          let imminentJustCreated = false;

          // --- We check for a CALL-like instruction
          var length = machine.getCallInstructionLength();
          if (length > 0) {
            // --- Its a CALL-like instruction, create an imminent breakpoint
            debugSupport.imminentBreakpoint = (machine.pc + length) & 0xffff;
            imminentJustCreated = true;
          }

          // --- We stop, we executed at least one instruction and if there's no imminent
          // --- breakpoint or we've just created one
          if (
            instructionsExecuted > 0 &&
            (debugSupport.imminentBreakpoint === undefined || imminentJustCreated)
          ) {
            debugSupport.imminentBreakpoint = undefined;
            return true;
          }
        }
        return false;
      }

      // --- Step out checks
      if (machine.stepOutAddress === machine.pc) {
        // --- We reached the step-out address
        debugSupport.imminentBreakpoint = undefined;
        return true;
      }
      return false;
    }
  }
}
