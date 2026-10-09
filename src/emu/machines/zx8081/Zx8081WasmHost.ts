import type { SysVar } from "@abstractions/SysVar";
import { zx81SysVars } from "./Zx81SysVars";
import { zx80SysVars } from "./Zx80SysVars";
import type { KeyMapping } from "@abstractions/KeyMapping";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { EmulatedKeyStroke, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { Z80MachineBase } from "../Z80MachineBase";
import { Zx8081KeyCode } from "./Zx8081KeyCode";
import { zx80KeyMappings, zx81KeyMappings } from "./Zx8081KeyMappings";
import { zx8081KeysForText } from "./Zx8081Typer";
import {
  resolveZx8081Hardware,
  ZX8081_BASE_CLOCK_FREQUENCY,
  ZX8081_TACTS_IN_FRAME_NTSC,
  ZX8081_TACTS_IN_FRAME_PAL,
  ZX80_KEY_WAIT,
  ZX81_KEY_WAIT,
  type Zx8081Hardware
} from "./zx8081MachineInfo";

/** Code injection is a follow-up (`.plans/ZX8081_WASM_PLAN.md` §14) */
export const ZX8081_NO_CODE_INJECTION =
  "The ZX80 and ZX81 cannot run code from the IDE yet: load a .P or .O file instead.";

/**
 * How long a typed key is held and released, in frames. The ROM scans the keyboard once a frame and
 * ignores a key that follows the last one by fewer than 4 key-free frames (its DEBOUNCE); a queued key
 * is released at the first frame after its end, so the gap is one frame shorter than queued.
 */
const TYPE_HOLD_FRAMES = 4;
const TYPE_GAP_FRAMES = 6;

/**
 * The host side of a Sinclair ZX80 or ZX81 whose hardware is emulated in the WASM core: the clock and
 * frame units, the keyboard mapping and the emulated keystroke queue (the typer), the partition and
 * ROM metadata, and the machine-menu commands. It follows the Cambridge Z88's host, the template for
 * a non-Spectrum machine (`.plans/ZX8081_WASM_PLAN.md` §4.2).
 *
 * The emulating subclass supplies memory, ports, keys, the picture and the frame loop.
 */
export abstract class Zx8081WasmHost extends Z80MachineBase {
  /** The model, as the core needs it */
  readonly hardware: Zx8081Hardware;

  /** The key strokes to emulate (the typer, the on-screen keyboard) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  constructor(
    public readonly machineId: string,
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.hardware = resolveZx8081Hardware(machineId, { ...modelInfo?.config, ...config });
    this.baseClockFrequency = ZX8081_BASE_CLOCK_FREQUENCY;
    this.clockMultiplier = 1;
    this.delayedAddressBus = false;
  }

  /** The ZX81 ULA (NMI generator, 207-T lines) */
  get isZx81(): boolean {
    return this.hardware.hardwareZx81;
  }

  /**
   * Whether the keyboard, the characters and the keywords are the ZX81's: they follow the ROM, not
   * the ULA - the 8K ROM upgrade for the ZX80 came with a ZX81 keyboard overlay
   */
  get hasZx81Rom(): boolean {
    return this.hardware.romZx81;
  }

  /** The emulated core raises its own interrupts; the TypeScript frame runner never runs this CPU */
  protected shouldRaiseInterrupt(): boolean {
    return false;
  }

  /**
   * The reset button, and the end of every power-on (`hardReset` resets too). The frame length is set
   * here: `Z80Cpu.hardReset` leaves it at 1,000,000 tacts, and the controller paces the UI by it, so a
   * machine left with it ran at a fifteenth of its speed and showed a white screen while the ROM was
   * still testing its RAM.
   */
  reset(): void {
    super.reset();
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;
    this.emulatedKeyStrokes.length = 0;
    this.setTactsInFrame(this.hardware.ntsc ? ZX8081_TACTS_IN_FRAME_NTSC : ZX8081_TACTS_IN_FRAME_PAL);
  }

  // ==========================================================================================
  // Machine identity and metadata

  get romId(): string {
    return this.machineId;
  }

  get isOsInitialized(): boolean {
    return true;
  }

  getSelectedRomPage(): number {
    return 0;
  }

  getSelectedRamBank(): number {
    return 0;
  }

  /** The 64K address space as 8 8K pages: the ROM below $2000 ($4000 except on the 64K model) */
  getRomFlags(): boolean[] {
    const romPages = this.hardware.ramKb === 64 ? 1 : 2;
    return [0, 1, 2, 3, 4, 5, 6, 7].map((page) => page < romPages);
  }

  getMemoryPartition(_index: number): Uint8Array {
    return new Uint8Array(0x4000);
  }

  /**
   * The system variables of the BASIC the ROM runs: the ZX81's for the 8K ROM (also a ZX80 with the
   * upgrade), the ZX80's for its own 4K ROM.
   */
  override get sysVars(): SysVar[] {
    return this.hardware.romZx81 ? zx81SysVars : zx80SysVars;
  }

  getCurrentPartitions(): number[] {
    return [];
  }

  getCurrentPartitionLabels(): string[] {
    return [];
  }

  parsePartitionLabel(_label: string): number | undefined {
    return undefined;
  }

  getPartitionLabels(): Record<number, string> {
    return {};
  }

  /** The ROM and the RAM as one disassembly section each */
  getDisassemblySections(_options: Record<string, any>): IMemorySection[] {
    const ramStart = this.hardware.ramKb === 64 ? 0x2000 : 0x4000;
    const romEnd = this.hardware.romZx81 ? 0x1fff : 0x0fff;
    return [
      { startAddress: 0x0000, endAddress: romEnd, sectionType: MemorySectionType.Disassemble },
      { startAddress: ramStart, endAddress: 0xffff, sectionType: MemorySectionType.Disassemble }
    ];
  }

  // ==========================================================================================
  // Keyboard

  getKeyCodeSet(): KeyCodeSet {
    return Zx8081KeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return this.hasZx81Rom ? zx81KeyMappings : zx80KeyMappings;
  }

  /**
   * Plays the queued key strokes one entry at a time, each pressed from its start tact to its end
   * tact. Tact points are compared by their distance from the 32-bit counter (`tactsPast`).
   */
  emulateKeystroke(): void {
    if (this.emulatedKeyStrokes.length === 0) return;
    const keyStroke = this.emulatedKeyStrokes[0];
    if (tactsPast(this.tacts, keyStroke.startTact) < 0) return;
    const keys = [keyStroke.primaryCode, keyStroke.secondaryCode, keyStroke.ternaryCode].filter(
      (k): k is number => k !== undefined
    );
    if (tactsPast(this.tacts, keyStroke.endTact) > 0) {
      keys.forEach((k) => this.setKeyStatus(k, false));
      this.emulatedKeyStrokes.shift();
      return;
    }
    keys.forEach((k) => this.setKeyStatus(k, true));
  }

  queueKeystroke(frameOffset: number, frames: number, primary: number, secondary?: number, ternary?: number): void {
    const frameTacts = this.tactsInFrame * this.clockMultiplier;
    const startTact = this.tacts + frameOffset * frameTacts;
    const endTact = startTact + frames * frameTacts;
    this.emulatedKeyStrokes.push(
      new EmulatedKeyStroke(toTactCounter(startTact), toTactCounter(endTact), primary, secondary, ternary)
    );
  }

  getKeyQueueLength(): number {
    return this.emulatedKeyStrokes.length;
  }

  /**
   * Types a string as keystrokes (CLK's typer): each character held `TYPE_HOLD_FRAMES` frames, then
   * released for `TYPE_GAP_FRAMES`, starting `delayFrames` from now. What a letter types depends on
   * the ROM's cursor mode, as on the real keyboard.
   */
  typeText(text: string, delayFrames = 0): void {
    let offset = delayFrames;
    for (const chord of zx8081KeysForText(text, this.hasZx81Rom)) {
      // --- The shift (when there is one) is the secondary key, held with the key
      const [first, second] = chord;
      if (second === undefined) {
        this.queueKeystroke(offset, TYPE_HOLD_FRAMES, first);
      } else {
        this.queueKeystroke(offset, TYPE_HOLD_FRAMES, second, first);
      }
      offset += TYPE_HOLD_FRAMES + TYPE_GAP_FRAMES;
    }
  }

  // ==========================================================================================
  // Code injection (a follow-up) and tape loading

  async getCodeInjectionFlow(_model: string): Promise<CodeInjectionFlow> {
    throw new Error(ZX8081_NO_CODE_INJECTION);
  }

  injectCodeToRun(_codeToInject: CodeToInject): number {
    throw new Error(ZX8081_NO_CODE_INJECTION);
  }

  /**
   * Resets to the editor and types the load command: `LOAD ""` on the ZX81 (and a ZX80 with the 8K
   * ROM), `LOAD` on the ZX80. The core reports when the ROM finishes the load, and the machine then
   * types `RUN` (`armAutoRun`).
   */
  getTapeLoadFlow(): CodeInjectionFlow {
    this.armAutoRun();
    const K = Zx8081KeyCode;
    const keys: CodeInjectionFlow = this.hardware.romZx81
      ? [
          { type: "QueueKey", primary: K.J, wait: 300, message: "LOAD" },
          { type: "QueueKey", primary: K.P, secondary: K.Shift, wait: 300, message: '"' },
          { type: "QueueKey", primary: K.P, secondary: K.Shift, wait: 300, message: '"' },
          { type: "QueueKey", primary: K.NewLine, wait: 0, message: "NEW LINE" }
        ]
      : [
          { type: "QueueKey", primary: K.W, wait: 300, message: "LOAD" },
          { type: "QueueKey", primary: K.NewLine, wait: 0, message: "NEW LINE" }
        ];
    const reach: CodeInjectionFlow = [
      this.hardware.romZx81
        ? {
            type: "ReachExecPoint",
            rom: 0,
            execPoint: ZX81_KEY_WAIT,
            message: "The editor is waiting for a key (SLOW-DISP, $04CF)"
          }
        : {
            type: "ReachExecPoint",
            rom: 0,
            execPoint: ZX80_KEY_WAIT,
            message: "The editor is waiting for a key ($013F)"
          }
    ];
    return [...reach, { type: "KeepPc" }, { type: "Start" }, ...keys];
  }

  /** Asks the core to report the end of the next load (the subclass types RUN then) */
  protected abstract armAutoRun(): void;
}
