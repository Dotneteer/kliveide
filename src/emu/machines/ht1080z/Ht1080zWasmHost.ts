import type { KeyMapping } from "@abstractions/KeyMapping";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { EmulatedKeyStroke, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { Z80MachineBase } from "../Z80MachineBase";
import { Ht1080zKeyCode } from "./Ht1080zKeyCode";
import { ht1080zKeyMappings } from "./Ht1080zKeyMappings";
import {
  HT1080Z_KEYBOARD_START,
  HT1080Z_TACTS_IN_FRAME,
  resolveHt1080zHardware,
  type Ht1080zHardware
} from "./ht1080zMachineInfo";

/**
 * The host side of an HT-1080Z whose hardware is emulated in the WASM core: the clock and frame
 * units, the keyboard mapping and the emulated keystroke queue, the partition and ROM metadata. It
 * follows the ZX80/ZX81 host (`Zx8081WasmHost.ts`), the template for a non-Spectrum machine
 * (`.plans/HT1080Z_PLAN.md` §4.2): `ZxSpectrumBase` carries Spectrum-only concerns.
 *
 * The emulating subclass supplies memory, ports, keys, the picture and the frame loop.
 */
export abstract class Ht1080zWasmHost extends Z80MachineBase {
  /** The model, as the core needs it */
  readonly hardware: Ht1080zHardware;

  /** The key strokes to emulate (the typer, the on-screen keyboard) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  constructor(
    public readonly machineId: string,
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.hardware = resolveHt1080zHardware({ ...modelInfo?.config, ...config });
    this.baseClockFrequency = this.hardware.clockFrequency;
    this.clockMultiplier = 1;
    this.delayedAddressBus = false;
  }

  /** The bare machine has no interrupt source; the core runs the CPU, never the TypeScript runner */
  protected shouldRaiseInterrupt(): boolean {
    return false;
  }

  /**
   * The reset button, and the end of every power-on (`hardReset` resets too). The frame length is set
   * here: `Z80Cpu.hardReset` leaves it at 1,000,000 tacts, and the controller paces the UI by it
   * (`.ai/wasm-migration-intent-and-lessons.md`, the ZX80/81 section).
   */
  reset(): void {
    super.reset();
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;
    this.emulatedKeyStrokes.length = 0;
    this.setTactsInFrame(HT1080Z_TACTS_IN_FRAME);
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

  /** The 64K address space as 8 8K pages: the ROMs fill most of the first ($0000-$37FF) */
  getRomFlags(): boolean[] {
    return [0, 1, 2, 3, 4, 5, 6, 7].map((page) => page === 0);
  }

  getMemoryPartition(_index: number): Uint8Array {
    return new Uint8Array(0x4000);
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

  /** The ROMs and the RAM as one disassembly section each */
  getDisassemblySections(_options: Record<string, any>): IMemorySection[] {
    const ramEnd = this.hardware.ramKb === 48 ? 0xffff : 0x7fff;
    return [
      { startAddress: 0x0000, endAddress: HT1080Z_KEYBOARD_START - 1, sectionType: MemorySectionType.Disassemble },
      { startAddress: 0x4000, endAddress: ramEnd, sectionType: MemorySectionType.Disassemble }
    ];
  }

  // ==========================================================================================
  // Keyboard

  getKeyCodeSet(): KeyCodeSet {
    return Ht1080zKeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return ht1080zKeyMappings;
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

  // ==========================================================================================
  // Code injection: the assembler plan (`.plans/HT1080Z_PLAN.md` §14), not this one

  async getCodeInjectionFlow(_model: string): Promise<CodeInjectionFlow> {
    throw new Error("Code injection is not supported on the HT-1080Z yet.");
  }

  injectCodeToRun(_codeToInject: CodeToInject): number {
    throw new Error("Code injection is not supported on the HT-1080Z yet.");
  }
}
