import { IFileProvider } from "@/core/IFileProvider";
import { FrameTerminationMode, DebugStepMode, ExecutionContext } from "../abstractions/ExecutionContext";
import { TapeMode } from "../abstractions/ITapeDevice";
import { OpCodePrefix } from "../abstractions/IZ80Cpu";
import { IZ80Machine } from "../abstractions/IZ80Machine";
import { SpectrumKeyCode } from "../abstractions/SpectrumKeyCode";
import { LiteEvent } from "../utils/lite-event";
import { Z80Cpu } from "../z80/Z80Cpu";
import { FILE_PROVIDER, REWIND_REQUESTED, TAPE_MODE } from "./machine-props";

/**
 * This class is intended to be a reusable base class for emulators using the Z80 CPU.
 */
export abstract class Z80MachineBase extends Z80Cpu implements IZ80Machine 
{
    // --- Store the start tact of the next machine frame
    private _nextFrameStartTact = 0;

    // --- Store machine-specific properties here
    private readonly _machineProps = new Map<string, any>();

    // --- This flag indicates that the last machine frame has been completed.
    private _frameCompleted: boolean;

    // --- Shows the number of frame tacts that overflow to the subsequent machine frame.
    private _frameOverflow = 0;

    /**
     * The unique identifier of the machine type
     */
    readonly abstract machineId: string;

    /**
     * This property stores the execution context where the emulated machine runs its execution loop.
     */
    executionContext: ExecutionContext = {
        frameTerminationMode: FrameTerminationMode.Normal,
        debugStepMode: DebugStepMode.NoDebug,
        canceled: false
    };

    /**
     * Sets up the machine (async)
     */
    abstract setup(): Promise<void>;

    /**
     * Dispose the resources held by the machine
     */
    dispose(): void {
        this.machinePropertyChanged?.release();
    }

    /**
     * Gets the value of the machine property with the specified key
     * @param key Machine property key
     * @returns Value of the property, if found; otherwise, undefined
     */
    getMachineProperty(key: string): any {
        return this._machineProps.get(key);
    }

    /**
     * This event fires when the state of a machine property changes.
     */
    machinePropertyChanged? = new LiteEvent<{propertyName: string, newValue?: any}>();

    /**
     * Sets the value of the specified machine property
     * @param key Machine property key
     * @param value Machine property value
     */
    setMachineProperty(key: string, value?: any): void {
        if (value === undefined) {
            if (!this._machineProps.get(key)) return;
            
            this._machineProps.delete(key);
            this.machinePropertyChanged?.fire({propertyName: key });
        } else {
            const oldValue = this._machineProps.get(key);
            if (oldValue) {
                if (oldValue === value) return;
            }
            this._machineProps.set(key, value);
            this.machinePropertyChanged?.fire({propertyName: key, newValue: value});
        }
    }

    /**
     * Get the duration of a machine frame in milliseconds.
     */
    frameTimeInMs: number;

    /**
     * This property gets or sets the value of the target clock multiplier to set when the next machine frame starts.
     * 
     * By default, the CPU works with its regular (base) clock frequency; however, you can use an integer clock
     * frequency multiplier to emulate a faster CPU.
     */
    targetClockMultiplier = 1;

    /**
     * Set the number of tacts in a machine frame.
     * @param tacts Number of tacts in a machine frame
     */
    setTactsInFrame(tacts: number): void {
        super.setTactsInFrame(tacts);
        this.frameTimeInMs = tacts * 1000.0 / this.baseClockFrequency;
    }
        
    /**
     * This method emulates resetting a machine with a hardware reset button.
     */
    reset(): void {
        super.reset();
        this._frameCompleted = true;
        this._frameOverflow = 0;
    }

    /**
     * Load the specified ROM
     * @param romName Name of the ROM file to load
     * @param page Optional ROM page for multi-rom machines
     * @returns The byte array that represents the ROM contents
     */
    protected loadRomFromResource(romName: string, page = -1): Promise<Uint8Array> {
        // --- Obtain the IFileProvider instance
        const fileProvider = this.getMachineProperty(FILE_PROVIDER) as IFileProvider;
        if (!fileProvider) {
            throw new Error("Could not obtain file provider instance");
        }

        const filename = `roms/${romName}${page === -1 ? "" : "-" + page}.rom`;
        return fileProvider.readBinaryFile(filename);
    }

    /**
     * Executes the machine loop using the current execution context.
     * @returns The value indicates the termination reason of the loop
     */
    executeMachineFrame(): FrameTerminationMode {
        return this.executionContext.frameTerminationMode == FrameTerminationMode.Normal
            ? this.executeMachineLoopWithNoDebug()
            : this.executeMachineLoopWithDebug();
    }

    /**
     * Clean up machine resources on stop
     */
    onStop(): void {
        this.setMachineProperty(TAPE_MODE, TapeMode.Passive);
        this.setMachineProperty(REWIND_REQUESTED);
    }

    /**
     * Width of the screen in native machine screen pixels
     */
    abstract get screenWidthInPixels(): number;

    /**
     * Height of the screen in native machine screen pixels
     */
    abstract get screenHeightInPixels(): number;

    /**
     * Gets the buffer that stores the rendered pixels
     */
    abstract getPixelBuffer(): Uint32Array;

    /**
     * Set the status of the specified ZX Spectrum key.
     * @param key Key code
     * @param isDown Indicates if the key is pressed down
     */
    abstract setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void;

    /**
     * Emulates queued key strokes as if those were pressed by the user
     */
    abstract emulateKeystroke(): void;

    /**
     * Adds an emulated keypress to the queue of the provider.
     * @param startFrame Frame count to start the emulation
     * @param frames Number of frames to hold the emulation
     * @param primary Primary key code
     * @param secondary Optional secondary key code
     * 
     * The keyboard provider can play back emulated key strokes
     */
    abstract queueKeystroke(
        startFrame: number, 
        frames: number, 
        primary: SpectrumKeyCode, 
        secondary?: SpectrumKeyCode): void;

    /**
     * Executes the machine loop using the current execution context.
     * @returns The value indicates the termination reason of the loop. 
     */
    private executeMachineLoopWithNoDebug(): FrameTerminationMode {
        // --- Sign that the loop execution is in progress
        this.executionContext.lastTerminationReason = undefined;

        // --- Execute the machine loop until the frame is completed or the loop is interrupted because of any other
        // --- completion reason, like reaching a breakpoint, etc.
        do {
            // --- Test if the machine frame has just been completed.
            if (this._frameCompleted)
            {
                const currentFrameStart = this.tacts - this._frameOverflow;

                // --- Update the CPU's clock multiplier, if the machine's has changed.
                let clockMultiplierChanged = false;
                if (this.allowCpuClockChange() && this.clockMultiplier !== this.targetClockMultiplier) {
                    // --- Use the current clock multiplier
                    this.clockMultiplier = this.targetClockMultiplier;
                    clockMultiplierChanged = true;
                }

                // --- Allow a machine to handle frame initialization
                this.onInitNewFrame(clockMultiplierChanged);
                this._frameCompleted = false;

                // --- Calculate the start tact of the next machine frame
                this._nextFrameStartTact = currentFrameStart + (this.tactsInFrame * this.clockMultiplier);
                
                // --- Emulate a keystroke, if any has been queued at all
                this.emulateKeystroke();
            }

            // --- Set the interrupt signal, if required so
            this.sigINT = this.shouldRaiseInterrupt();

            // --- Execute the next CPU instruction entirely 
            do {
                this.executeCpuCycle();
            } while (this.prefix !== OpCodePrefix.None);

            // --- Allow the machine to do additional tasks after the completed CPU instruction
            this.afterInstructionExecuted();

            this._frameCompleted = this.tacts >= this._nextFrameStartTact;
        } while (!this._frameCompleted);

        // --- Calculate the overflow, we need this value in the next frame
        this._frameOverflow = Math.floor(this.tacts - this._nextFrameStartTact);

        // --- Done
        return (this.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
    }

    /**
     * Executes the machine loop using the current execution context.
     * @returns The value indicates the termination reason of the loop. 
     */
    private executeMachineLoopWithDebug(): FrameTerminationMode {
        // --- Sign that the loop execution is in progress
        const z80Machine = this;
        this.executionContext.lastTerminationReason = undefined;
        var instructionsExecuted = 0;

        // --- Check the startup breakpoint
        if (this.pc != this.executionContext.debugSupport?.lastStartupBreakpoint) {
            // --- Check startup breakpoint
            if (checkBreakpoints()) {
                return (this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
            }
            if (this.executionContext.lastTerminationReason !== undefined) {
                // --- The code execution has stopped at the startup breakpoint.
                // --- Sign that fact so that the next time the code do not stop
                if (this.executionContext.debugSupport) {
                    this.executionContext.debugSupport.lastStartupBreakpoint = this.pc;
                }
                return this.executionContext.lastTerminationReason;
            }
        }

        // --- Remove the startup breakpoint
        if (this.executionContext.debugSupport) {
            this.executionContext.debugSupport.lastStartupBreakpoint = undefined;
        }

        // --- Execute the machine loop until the frame is completed or the loop is interrupted because of any other
        // --- completion reason, like reaching a breakpoint, etc.
        do {
            // --- Test if the machine frame has just been completed.
            if (this._frameCompleted) {
                const currentFrameStart = this.tacts - this._frameOverflow;

                // --- Update the CPU's clock multiplier, if the machine's has changed.
                var clockMultiplierChanged = false;
                if (this.allowCpuClockChange() && this.clockMultiplier != this.targetClockMultiplier) {
                    // --- Use the current clock multiplier
                    this.clockMultiplier = this.targetClockMultiplier;
                    clockMultiplierChanged = true;
                }

                // --- Allow a machine to handle frame initialization
                this.onInitNewFrame(clockMultiplierChanged);
                this._frameCompleted = false;

                // --- Calculate the start tact of the next machine frame
                this._nextFrameStartTact = currentFrameStart + this.tactsInFrame * this.clockMultiplier;
            }

            // --- Set the interrupt signal, if required so
            this.sigINT = this.shouldRaiseInterrupt();

            // --- Execute the next CPU instruction entirely 
            do {
                this.executeCpuCycle();
                instructionsExecuted++;
            } while (this.prefix !== OpCodePrefix.None);

            // --- Allow the machine to do additional tasks after the completed CPU instruction
            this.afterInstructionExecuted();

            // --- Do the machine reached the termination point?
            if (this.testTerminationPoint()) {
                // --- The machine reached the termination point
                return (this.executionContext.lastTerminationReason = FrameTerminationMode.UntilExecutionPoint);
            }

            // --- Test if the execution reached a breakpoint
            if (checkBreakpoints()) {
                return (this.executionContext.lastTerminationReason = FrameTerminationMode.DebugEvent);
            }
            if (this.executionContext.lastTerminationReason !== undefined) {
                // --- The code execution has stopped at the startup breakpoint.
                // --- Sign that fact so that the next time the code do not stop
                if (this.executionContext.debugSupport) {
                    this.executionContext.debugSupport.lastStartupBreakpoint = this.pc;
                }
                return this.executionContext.lastTerminationReason;
            }

            this._frameCompleted = this.tacts >= this._nextFrameStartTact;
        } while (!this._frameCompleted);

        // --- Calculate the overflow, we need this value in the next frame
        this._frameOverflow = Math.floor(this.tacts - this._nextFrameStartTact);

        // --- Done
        return (this.executionContext.lastTerminationReason = FrameTerminationMode.Normal);
        
        // --- This method tests if any breakpoint is reached during the execution of the machine frame
        // --- to suspend the loop.
        function checkBreakpoints(): boolean {
            // --- The machine must support debugging
            const debugSupport = z80Machine.executionContext.debugSupport;
            if (!debugSupport) return false;

            // --- Stop according to the current debug mode strategy
            switch (z80Machine.executionContext.debugStepMode) {
                case DebugStepMode.StepInto:
                    // --- Stop right after the first executed instruction
                    return instructionsExecuted > 0;
                
                case DebugStepMode.StopAtBreakpoint:
                    const breakpoint = debugSupport.getExecBreakpoint(z80Machine.pc);
                    if (breakpoint && !breakpoint.disabled && (instructionsExecuted > 0 
                        || debugSupport.lastBreakpoint === undefined
                        || debugSupport.lastBreakpoint !== z80Machine.pc)) {
                        // --- Stop when reached a breakpoint
                        debugSupport.lastBreakpoint = z80Machine.pc;
                        return true;
                    }
                    break;
                
                case DebugStepMode.StepOver:
                    if (debugSupport.imminentBreakpoint !== undefined) {
                        // --- We also stop if an imminent breakpoint is reached, and also remove this breakpoint
                        if (debugSupport.imminentBreakpoint === z80Machine.pc) {
                            debugSupport.imminentBreakpoint = undefined;
                            return true;
                        }
                    } else {
                        let imminentJustCreated = false;

                        // --- We check for a CALL-like instruction
                        var length = z80Machine.getCallInstructionLength();
                        if (length > 0) {
                            // --- Its a CALL-like instruction, create an imminent breakpoint
                            debugSupport.imminentBreakpoint = (z80Machine.pc + length) & 0xffff;
                            imminentJustCreated = true;
                        }

                        // --- We stop, we executed at least one instruction and if there's no imminent 
                        // --- breakpoint or we've just created one
                        if (instructionsExecuted > 0
                            && (debugSupport.imminentBreakpoint === undefined || imminentJustCreated)) {
                            return true;
                        }
                    }
                    break;
                
                case DebugStepMode.StepOut:
                    break;
            }
            return false;
        }
    }

    /**
     * This method tests if the CPU reached the specified termination point.
     * @returns True, if the execution has reached the termination point; otherwise, false.
     * 
     * By default, this method checks if the PC equals the execution context's TerminationPoint value. 
     */
    protected testTerminationPoint(): boolean { 
        return this.executionContext.frameTerminationMode === FrameTerminationMode.UntilExecutionPoint && 
           this.pc === this.executionContext.terminationPoint;
    }

    /**
     * The machine's execution loop calls this method to check if it can change the clock multiplier.
     * @returns True, if the clock multiplier can be changed; otherwise, false.
     */
    protected allowCpuClockChange(): boolean {
        return true;
    }

    /**
     * The machine's execution loop calls this method when it is about to initialize a new frame.
     * @param clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the 
     * previous frame.
     */
    protected onInitNewFrame(clockMultiplierChanged: boolean): void {
        // --- Override this method in derived classes.
    }

    /**
     * Tests if the machine should raise a Z80 maskable interrupt
     */
    protected abstract shouldRaiseInterrupt(): boolean;

    /**
     * The machine frame loop invokes this method after executing a CPU instruction.
     */
    protected afterInstructionExecuted(): void {
        // --- Override this method in derived classes.
    }
}