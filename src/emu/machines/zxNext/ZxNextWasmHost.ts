import type { KeyMapping } from "@abstractions/KeyMapping";
import type { SysVar } from "@abstractions/SysVar";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { IMemorySection } from "@abstractions/MemorySection";
import { createMainApi } from "@common/messaging/MainApi";
import { EmulatedKeyStroke, laterTact, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";
import { Z80MachineBase } from "../Z80MachineBase";
import {
  buildNextCodeInjectionFlow,
  nextDisassemblySections,
  nextPartitionDescriptions,
  nextPartitionGroups,
  nextPartitionLabels,
  parseNextPartitionLabel,
  z80nCallInstructionLength
} from "./nextMachineInfo";
import { zxNextSysVars } from "./ZxNextSysVars";

/**
 * The host side of a ZX Spectrum Next whose hardware is emulated elsewhere - in the WASM core.
 *
 * Everything here is machine *plumbing* that does not depend on how the hardware is emulated: the
 * Next's clock and frame units for the frame pacing, the partition names, the code-injection flow
 * that boots NextZXOS and types `.nexload`, the emulated keystroke queue, the system variables, the
 * step-over instruction lengths. It shares the neutral `nextMachineInfo.ts` with the TypeScript
 * `ZxNextMachine`, and nothing else: it constructs no TypeScript Next device and never falls back to
 * TypeScript emulation (see `.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`, Step 5).
 *
 * The emulating subclass supplies memory, ports, keys, the screen, audio and the frame loop.
 */
export abstract class ZxNextWasmHost extends Z80MachineBase {
  public readonly machineId = "zxnext" as const;

  /**
   * `tactsInFrame` counts 28 MHz clocks and `baseClockFrequency` is 3.5 MHz, so the frame pacing
   * (`MachineController`) divides by 8 to get the frame's wall-clock duration.
   */
  override readonly frameTactMultiplier = 8;

  /** The key strokes to emulate (code injection, the on-screen keyboards) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  private frameCommand: any;

  constructor(
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.baseClockFrequency = 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;
  }

  /**
   * Emulates turning on the machine: every register to its power-on value, then a reset.
   */
  hardReset(): void {
    super.hardReset();
    this.reset();
  }

  // ==========================================================================================
  // Frame commands (the SD card's host round trips)

  getFrameCommand(): any {
    return this.frameCommand;
  }

  setFrameCommand(command: any): void {
    this.frameCommand = command;
  }

  async processFrameCommand(_messenger?: MessengerBase): Promise<void> {
    console.log("Unknown frame command", this.frameCommand);
  }

  // ==========================================================================================
  // Machine identity and metadata

  get romId(): string {
    return this.machineId;
  }

  get isSpectrum48RomSelected(): boolean {
    return true;
  }

  get sysVars(): SysVar[] {
    return zxNextSysVars;
  }

  parsePartitionLabel(label: string): number | undefined {
    return parseNextPartitionLabel(label);
  }

  getPartitionLabels(): Record<number, string> {
    return nextPartitionLabels();
  }

  getPartitionDescriptions(): Record<number, string> {
    return nextPartitionDescriptions();
  }

  getPartitionGroups(): Record<number, string> {
    return nextPartitionGroups();
  }

  getDisassemblySections(options: Record<string, any>): IMemorySection[] {
    return nextDisassemblySections(options);
  }

  getCallInstructionLength(): number {
    // --- `doReadMemory`: a side-effect-free read of the emulated memory
    return z80nCallInstructionLength((address) => this.doReadMemory(address), this.pc);
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * The emulated hardware starts its own frames; only the host's rendering mark restarts here.
   */
  onInitNewFrame(_clockMultiplierChanged: boolean): void {
    this.lastRenderedFrameTact = 0;
  }

  /**
   * The emulated core raises its own interrupts; the TypeScript frame runner never runs this CPU.
   */
  protected shouldRaiseInterrupt(): boolean {
    return false;
  }

  // ==========================================================================================
  // Keyboard

  getKeyCodeSet(): KeyCodeSet {
    return SpectrumKeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return spectrumKeyMappings;
  }

  getCursorMode(): number {
    return this.doReadMemory(0x5c41);
  }

  /**
   * Plays the queued key strokes as if the user pressed them: one queue entry at a time, pressed from
   * its start tact to its end tact.
   */
  emulateKeystroke(): void {
    if (this.emulatedKeyStrokes.length === 0) return;

    // --- Check the next keystroke
    const keyStroke = this.emulatedKeyStrokes[0];

    // --- Time has not come. The core's tact counter is 32 bits and wraps, so both points are
    // --- compared by their distance from it, never by value (issue #1374).
    if (tactsPast(this.tacts, keyStroke.startTact) < 0) return;

    if (tactsPast(this.tacts, keyStroke.endTact) > 0) {
      // --- End emulation of this very keystroke
      this.setKeyStatus(keyStroke.primaryCode, false);
      if (keyStroke.secondaryCode !== undefined) {
        this.setKeyStatus(keyStroke.secondaryCode, false);
      }

      // --- Remove the keystroke from the queue
      this.emulatedKeyStrokes.shift();
      return;
    }

    // --- Emulate this very keystroke, and leave it in the queue
    this.setKeyStatus(keyStroke.primaryCode, true);
    if (keyStroke.secondaryCode !== undefined) {
      this.setKeyStatus(keyStroke.secondaryCode, true);
    }
  }

  /**
   * Adds an emulated keypress to the queue.
   * @param frameOffset Number of frames to start the keypress emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   */
  queueKeystroke(frameOffset: number, frames: number, primary: number, secondary?: number): void {
    // --- tactsInFrame is in the 28 MHz domain; emulateKeystroke compares against this.tacts
    // --- (T-states), so divide by frameTactMultiplier (8) to get T-states per frame.
    const tactsPerFrame = (this.tactsInFrame / this.frameTactMultiplier) | 0;

    // --- Chain onto the end of the queue rather than anchoring every keystroke to "now": the queue
    // --- then plays back at the machine's own pace however fast the host filled it, and nothing
    // --- expires unplayed (`.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.12).
    const queue = this.emulatedKeyStrokes;
    const lastEndTact = queue.length > 0 ? queue[queue.length - 1].endTact : this.tacts;
    // --- In the 32-bit counter's range, as the core reports the tacts that reach them
    const startTact = toTactCounter(laterTact(this.tacts, lastEndTact) + frameOffset * tactsPerFrame);
    const endTact = toTactCounter(startTact + frames * tactsPerFrame);
    queue.push(new EmulatedKeyStroke(startTact, endTact, primary, secondary));
  }

  getKeyQueueLength(): number {
    return this.emulatedKeyStrokes.length;
  }

  // ==========================================================================================
  // Code injection

  async getCodeInjectionFlow(_model: string, additionalInfo?: any): Promise<CodeInjectionFlow> {
    const hasAutoExec = await createMainApi(this.messenger).hasNextAutoExec();
    return buildNextCodeInjectionFlow(hasAutoExec, additionalInfo);
  }

  /**
   * Injects the specified code into the machine's memory.
   *
   * Writes go straight to the emulated memory (`doWriteMemory`): injecting is not something the
   * emulated CPU does, so it takes no contention and no machine time.
   * @param codeToInject Code to inject into the machine
   * @returns The start address of the injected code
   */
  injectCodeToRun(codeToInject: CodeToInject): number {
    // --- Clear the screen unless otherwise requested
    if (!codeToInject.options.noCls) {
      for (let addr = 0x4000; addr < 0x5800; addr++) {
        this.doWriteMemory(addr, 0);
      }
      for (let addr = 0x5800; addr < 0x5b00; addr++) {
        this.doWriteMemory(addr, 0x38);
      }
    }
    for (const segment of codeToInject.segments) {
      if (segment.bank === undefined) {
        const addr = segment.startAddress;
        for (let i = 0; i < segment.emittedCode.length; i++) {
          this.doWriteMemory(addr + i, segment.emittedCode[i]);
        }
      }
    }

    // --- Prepare the run mode
    if (codeToInject.options.cursorl || codeToInject.options.cursork /* deprecated */) {
      // --- Set the keyboard in "L" mode
      this.doWriteMemory(0x5c3b, this.doReadMemory(0x5c3b) | 0x08);
    }

    // --- Use this start point
    return codeToInject.entryAddress ?? codeToInject.segments[0].startAddress;
  }
}
