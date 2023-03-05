import { IMachineController } from "@/appEmu/abstrations/IMachineController";
import { IOutputBuffer, OutputColor } from "@/appIde/ToolArea/abstractions";
import { DebugStepMode } from "@/emu/abstractions/DebugStepMode";
import { ExecutionContext } from "@/emu/abstractions/ExecutionContext";
import { FrameStats } from "@/emu/abstractions/FrameStats";
import { FrameTerminationMode } from "@/emu/abstractions/FrameTerminationMode";
import { IDebugSupport } from "@/emu/abstractions/IDebugSupport";
import { IZ80Machine } from "@/emu/abstractions/IZ80Machine";
import { LiteEvent } from "@/emu/utils/lite-event";
import { MachineControllerState } from "@common/abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { setMachineStateAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";

/**
 * This class implements a machine controller that can operate an emulated machine invoking its execution loop.
 */
export class MachineController implements IMachineController {
  private _cancelRequested: boolean;
  private _machineTask: Promise<void>;
  private _machineState: MachineControllerState;
  private _loggedEventNo = 0;

  /**
   * Initializes the controller to manage the specified machine.
   * @param machine The machine to manage
   */
  constructor (
    public readonly store: Store<AppState>,
    public readonly messenger: MessengerBase,
    public readonly machine: IZ80Machine
  ) {
    this.context = machine.executionContext;
    this.isDebugging = false;
    this.frameStats = {
      frameCount: 0,
      lastFrameTimeInMs: 0,
      lastCpuFrameTimeInMs: 0,
      avgFrameTimeInMs: 0,
      avgCpuFrameTimeInMs: 0
    };
    this.state = MachineControllerState.None;
  }

  /**
   * Disposes resources held by this class
   */
  dispose (): void {
    this.stateChanged?.release();
    this.frameCompleted?.release();
  }

  /**
   * The output buffer to write messages to
   */
  output?: IOutputBuffer;

  /**
   * Gets or sets the object providing debug support
   */
  debugSupport?: IDebugSupport;

  /**
   * The execution context of the controlled machine
   */
  private context: ExecutionContext;

  /// <summary>
  /// Get or set the current state of the machine controller.
  /// </summary>
  get state (): MachineControllerState {
    return this._machineState;
  }
  set state (value: MachineControllerState) {
    if (this._machineState === value) return;

    const oldState = this._machineState;
    this._machineState = value;
    this.store.dispatch(setMachineStateAction(value), "emu");
    this.stateChanged.fire({ oldState, newState: this._machineState });
  }

  /**
   * Represents the frame statistics of the last running frame
   */
  frameStats: FrameStats;

  /**
   * Indicates if the machine runs in debug mode
   */
  isDebugging: boolean;

  /**
   * This event fires when the state of the controller changes.
   */
  stateChanged = new LiteEvent<{
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }>();

  /**
   * This event fires whenever an execution loop has been completed. The event parameter flag indicates if the
   * frame has been completed entirely (normal termination mode)
   */
  frameCompleted = new LiteEvent<boolean>();

  /**
   * Start the machine in normal mode.
   */
  async start (): Promise<void> {
    await this.sendOutput("Machine started", "green");
    this.isDebugging = false;
    this.run();
  }

  /**
   * Start the machine in debug mode.
   */
  async startDebug (): Promise<void> {
    await this.sendOutput("Machine started in debug mode", "green");
    this.isDebugging = true;
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StopAtBreakpoint);
  }

  /**
   * Pause the running machine.
   */
  async pause (): Promise<void> {
    if (this.state !== MachineControllerState.Running) {
      throw new Error("The machine is not running");
    }
    await this.finishExecutionLoop(
      MachineControllerState.Pausing,
      MachineControllerState.Paused
    );
    await this.sendOutput(
      `Machine paused (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
  }

  /// <summary>
  /// Stop the running or paused machine.
  /// </summary>
  async stop (): Promise<void> {
    // --- Stop the machine
    this.isDebugging = false;
    await this.finishExecutionLoop(
      MachineControllerState.Stopping,
      MachineControllerState.Stopped
    );
    await this.sendOutput(
      `Machine stopped (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "red"
    );
    this.machine.onStop();

    // --- Reset frame statistics
    this.frameStats.frameCount = 0;
    this.frameStats.lastCpuFrameTimeInMs = 0.0;
    this.frameStats.avgFrameTimeInMs = 0.0;
    this.frameStats.lastFrameTimeInMs = 0.0;
    this.frameStats.avgFrameTimeInMs = 0.0;

    // --- Reset the imminent breakpoint
    if (this.context.debugSupport) {
      this.context.debugSupport.imminentBreakpoint = undefined;
    }
  }

  /**
   * Stop and then start the machine again.
   */
  async restart (): Promise<void> {
    await this.stop();
    await this.sendOutput("Hard reset", "cyan");
    this.machine.hardReset();
    await this.start();
  }

  /**
   * Starts the machine in step-into mode.
   */
  async stepInto (): Promise<void> {
    this.isDebugging = true;
    await this.sendOutput(
      `Step-into (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StepInto);
    await this.finishExecutionLoop(
      MachineControllerState.Pausing,
      MachineControllerState.Paused
    );
  }

  /**
   * Starts the machine in step-over mode.
   */
  async stepOver (): Promise<void> {
    this.isDebugging = true;
    await this.sendOutput(
      `Step-over (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StepOver);
    await this.finishExecutionLoop(
      MachineControllerState.Pausing,
      MachineControllerState.Paused
    );
  }

  /**
   * Starts the machine in step-out mode.
   */
  async stepOut (): Promise<void> {
    this.isDebugging = true;
    await this.sendOutput(
      `Step-out (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StepOut);
    await this.finishExecutionLoop(
      MachineControllerState.Pausing,
      MachineControllerState.Paused
    );
  }

  /**
   * Run the machine loop until cancelled
   */
  private run (
    terminationMode = FrameTerminationMode.Normal,
    debugStepMode = DebugStepMode.NoDebug,
    terminationPartition?: number,
    terminationPoint?: number
  ): void {
    switch (this.state) {
      case MachineControllerState.Running:
        throw new Error("The machine is already running");

      case MachineControllerState.None:
      case MachineControllerState.Stopped:
        // --- First start (after stop), reset the machine
        this.machine.reset();
        break;
    }

    // --- Initialize the context
    this.context.frameTerminationMode = terminationMode;
    this.context.debugStepMode = debugStepMode;
    this.context.terminationPartition = terminationPartition;
    this.context.terminationPoint = terminationPoint;
    this.context.canceled = false;
    this.context.debugSupport = this.debugSupport;

    // --- Set up the state
    this.machine.contentionDelaySincePause = 0;
    this.machine.tactsAtLastStart = this.machine.tacts;

    // --- Now, run!
    this.state = MachineControllerState.Running;
    this._machineTask = (async () => {
      this._cancelRequested = false;
      const nextFrameGap =
        (this.machine.tactsInFrame / this.machine.baseClockFrequency) * 1000;
      let nextFrameTime = performance.now() + nextFrameGap;
      do {
        // --- Use the latest clock multiplier
        this.machine.targetClockMultiplier =
          this.store.getState()?.emulatorState?.clockMultiplier ?? 1;
        // --- Run the machine frame and measure execution time
        const frameStartTime = performance.now();
        const termination = this.machine.executeMachineFrame();
        const cpuTime = performance.now() - frameStartTime;
        const frameCompleted = termination === FrameTerminationMode.Normal;
        this.frameCompleted?.fire(frameCompleted);
        const frameTime = performance.now() - frameStartTime;
        if (frameCompleted) {
          this.frameStats.frameCount++;
          // --- Handle emulated keystrokes

          this.machine.emulateKeystroke();
        }

        this.frameStats.lastCpuFrameTimeInMs = cpuTime;
        this.frameStats.avgCpuFrameTimeInMs =
          this.frameStats.frameCount === 0
            ? this.frameStats.lastCpuFrameTimeInMs
            : (this.frameStats.avgCpuFrameTimeInMs *
                (this.frameStats.frameCount - 1) +
                this.frameStats.lastCpuFrameTimeInMs) /
              this.frameStats.frameCount;
        this.frameStats.lastFrameTimeInMs = frameTime;
        this.frameStats.avgFrameTimeInMs =
          this.frameStats.frameCount == 0
            ? this.frameStats.lastFrameTimeInMs
            : (this.frameStats.avgFrameTimeInMs *
                (this.frameStats.frameCount - 1) +
                this.frameStats.lastFrameTimeInMs) /
              this.frameStats.frameCount;

        if (this._cancelRequested) {
          // --- The machine is paused or stopped
          this.context.canceled = true;
          return;
        }
        if (termination !== FrameTerminationMode.Normal) {
          this.state = MachineControllerState.Paused;
          this._machineTask = undefined;
          this.context.canceled = true;

          if (termination === FrameTerminationMode.DebugEvent) {
            await this.sendOutput(
              `Breakpoint reached at PC=${this.machine.pc
                .toString(16)
                .padStart(4, "0")}`,
              "cyan"
            );
          }
          return;
        }

        // --- Calculate the time to wait before the next machine frame starts
        const curTime = performance.now();
        const toWait = Math.floor(nextFrameTime - curTime);
        await delay(toWait - 2);
        nextFrameTime += nextFrameGap;
      } while (true);
    })();

    // --- Apply delay
    function delay (milliseconds: number): Promise<void> {
      return new Promise<void>(resolve => {
        if (milliseconds < 0) {
          milliseconds = 0;
        }
        setTimeout(() => {
          resolve();
        }, milliseconds);
      });
    }
  }

  /**
   * Finishes running the current execution loop of the machine
   * @param beforeState Controller state before finishing the operation
   * @param afterState Controller state after finishing the operation
   */
  private async finishExecutionLoop (
    beforeState: MachineControllerState,
    afterState: MachineControllerState
  ): Promise<void> {
    this.state = beforeState;
    this._cancelRequested = true;
    if (this._machineTask) {
      await this._machineTask;
      this._machineTask = undefined;
    }
    this.state = afterState;
  }

  /**
   * Send output to the IDE
   * @param text Text to send
   * @param color Text color to use
   */
  async sendOutput (text: string, color: OutputColor): Promise<void> {
    this._loggedEventNo++;
    await this.messenger.sendMessage({
      type: "IdeDisplayOutput",
      pane: "emu",
      text: `[${this._loggedEventNo}] `,
      color: "magenta",
      writeLine: false
    });
    await this.messenger.sendMessage({
      type: "IdeDisplayOutput",
      pane: "emu",
      text,
      color,
      writeLine: true
    });
  }
}
