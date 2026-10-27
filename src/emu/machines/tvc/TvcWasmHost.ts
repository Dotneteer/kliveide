import type { KeyMapping } from "@abstractions/KeyMapping";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { EmulatedKeyStroke, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { Z80MachineBase } from "../Z80MachineBase";
import { TvcKeyCode } from "./TvcKeyCode";
import { tvcKeyMappings } from "./TvcKeyMappings";
import { tvcStrokesForText } from "./TvcTyper";
import { resolveTvcHardware, TVC_TACTS_IN_FRAME, type TvcHardware } from "./tvcMachineInfo";

/**
 * The host side of a Videoton TVC whose hardware is emulated in the WASM core: the clock and frame
 * units, the keyboard mapping and the emulated keystroke queue. It follows the HT-1080Z host
 * (`Ht1080zWasmHost.ts`), the template for a non-Spectrum machine (`.plans/VIDEOTON_TVC_PLAN.md`
 * §4.2). The emulating subclass supplies memory, ports, keys, the picture and the frame loop.
 *
 * Partitions, the BASIC listing and code injection come in Phases 6 and 7.
 */
export abstract class TvcWasmHost extends Z80MachineBase {
  /** The model, as the core needs it */
  readonly hardware: TvcHardware;

  /** The key strokes to emulate (the typer, the on-screen keyboard) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  constructor(
    public readonly machineId: string,
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.hardware = resolveTvcHardware({ ...modelInfo?.config, ...config });
    this.baseClockFrequency = 3_125_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = false;
  }

  /** The core raises the interrupt itself (the CRTC cursor and the sound timer), never the TypeScript runner */
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
    this.clockMultiplier = 1;
    this.executionContext.lastTerminationReason = null;
    this.emulatedKeyStrokes.length = 0;
    this.setTactsInFrame(TVC_TACTS_IN_FRAME);
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

  /** The whole address space as one disassembly section: what it holds depends on the paging */
  getDisassemblySections(_options: Record<string, any>): IMemorySection[] {
    return [{ startAddress: 0x0000, endAddress: 0xffff, sectionType: MemorySectionType.Disassemble }];
  }

  // ==========================================================================================
  // Keyboard

  getKeyCodeSet(): KeyCodeSet {
    return TvcKeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return tvcKeyMappings;
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
   * Types a string as keystrokes (`TvcTyper.ts`), starting `delayFrames` from now: each held 3
   * frames and released for 3. BASIC scans the keyboard in its frame interrupt; 3 + 3 frames is
   * what the harness types reliably with (`test/tvc-hw/keyboard.test.ts`).
   * @throws when the keyboard cannot type a character
   */
  typeText(text: string, delayFrames = 0): void {
    const frameTacts = this.tactsInFrame * this.clockMultiplier;
    // --- Edges half a frame before the frame they belong to: a frame starts a few T-states after
    // --- its nominal boundary, so an edge on the boundary could fall a frame early or late
    const at = (frames: number) => toTactCounter(this.tacts + Math.round((frames - 0.5) * frameTacts));
    let offset = delayFrames;
    for (const stroke of tvcStrokesForText(text)) {
      const [primary, secondary] = stroke.keys.map((name) => TvcKeyCode[name]);
      this.emulatedKeyStrokes.push(new EmulatedKeyStroke(at(offset), at(offset + 3), primary, secondary));
      offset += 6;
    }
  }

  // ==========================================================================================
  // Code injection: Phase 7 (`.plans/VIDEOTON_TVC_PLAN.md` §11)

  async getCodeInjectionFlow(_model: string): Promise<CodeInjectionFlow> {
    throw new Error("Running code on the Videoton TVC is not supported yet.");
  }

  injectCodeToRun(_codeToInject: CodeToInject): number {
    throw new Error("Running code on the Videoton TVC is not supported yet.");
  }
}
