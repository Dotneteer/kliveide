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
import { ht1080zStrokesForText } from "./Ht1080zTyper";
import {
  describeHt1080zPlacementProblem,
  HT1080Z_RETURN_TO_BASIC,
  HT1080Z_USR_VECTOR,
  isHt1080zPlacementProblem,
  placeHt1080zCode,
  type Ht1080zPlacement
} from "@common/ht1080z/codePlacement";
import {
  HT1080Z_KEYBOARD_START,
  HT1080Z_TACTS_IN_FRAME,
  resolveHt1080zHardware,
  type Ht1080zHardware
} from "./ht1080zMachineInfo";

/**
 * How the typer presses keys, in frames, measured on the ROMs (`test/ht1080z-hw/keyboard.test.ts`):
 * the Level II keyboard routine loses a repeated key when hold plus release is 2 frames and takes
 * every key from 3, so each is held 3 and released 3. A stroke whose modifier must lead (Series II's
 * CLEAR) has the modifier down `TYPE_LEAD_FRAMES` before the key and up `TYPE_TAIL_FRAMES` after it.
 */
const TYPE_HOLD_FRAMES = 3;
const TYPE_GAP_FRAMES = 3;
const TYPE_LEAD_FRAMES = 3;
const TYPE_TAIL_FRAMES = 2;

/** A queued keystroke whose first key goes down later and up earlier than the others */
class LeadKeyStroke extends EmulatedKeyStroke {
  constructor(
    startTact: number,
    endTact: number,
    readonly keyStartTact: number,
    readonly keyEndTact: number,
    primary: number,
    secondary?: number,
    ternary?: number
  ) {
    super(startTact, endTact, primary, secondary, ternary);
  }
}

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
    if (keyStroke instanceof LeadKeyStroke) {
      // --- The modifiers for the whole stroke; the key only inside its own window
      keys.slice(1).forEach((k) => this.setKeyStatus(k, true));
      const keyDown =
        tactsPast(this.tacts, keyStroke.keyStartTact) >= 0 && tactsPast(this.tacts, keyStroke.keyEndTact) <= 0;
      this.setKeyStatus(keyStroke.primaryCode, keyDown);
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
   * Types a string as keystrokes (`Ht1080zTyper.ts`), starting `delayFrames` from now: each held
   * `TYPE_HOLD_FRAMES` frames and released for `TYPE_GAP_FRAMES`. Accented letters need the
   * extension ROM switched on (`HT1080Z_EXTENSION_ON`), as on the real machine.
   * @throws when the model's keyboard cannot type a character
   */
  typeText(text: string, delayFrames = 0): void {
    const frameTacts = this.tactsInFrame * this.clockMultiplier;
    /*
     * A stroke's edges sit half a frame before the frame they start or end at. Keys are set at the
     * start of each frame, and a frame starts a few T-states after its nominal boundary (the last
     * instruction runs over it) - by a different amount every frame. An edge on the boundary itself
     * then fell a frame early or late, and a key held 3 frames was sometimes held 2, which the Series
     * II extension missed in a run of accents.
     */
    const at = (frames: number) => toTactCounter(this.tacts + Math.round((frames - 0.5) * frameTacts));
    let offset = delayFrames;
    for (const stroke of ht1080zStrokesForText(text, this.hardware.romSet)) {
      const [primary, secondary, ternary] = stroke.keys.map((name) => Ht1080zKeyCode[name]);
      if (stroke.lead) {
        const keyStart = offset + TYPE_LEAD_FRAMES;
        const keyEnd = keyStart + TYPE_HOLD_FRAMES;
        const end = keyEnd + TYPE_TAIL_FRAMES;
        this.emulatedKeyStrokes.push(
          new LeadKeyStroke(at(offset), at(end), at(keyStart), at(keyEnd), primary, secondary, ternary)
        );
        offset = end + TYPE_GAP_FRAMES;
      } else {
        this.emulatedKeyStrokes.push(
          new EmulatedKeyStroke(at(offset), at(offset + TYPE_HOLD_FRAMES), primary, secondary, ternary)
        );
        offset += TYPE_HOLD_FRAMES + TYPE_GAP_FRAMES;
      }
    }
  }

  // ==========================================================================================
  // Code injection (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D3-D5)

  /** The ROM's wait-for-key loop (`JR 0049h` at 004Eh): idle at the power-on question and at `>` */
  static readonly KEY_WAIT_LOOP = 0x004e;

  /**
   * Where the code goes on this model, or an error naming the problem (D2): nothing below 3C00h,
   * nothing beyond the RAM, and BASIC left at least 1K below the code
   */
  placeCode(codeToInject: CodeToInject): Ht1080zPlacement {
    const placement = placeHt1080zCode(codeToInject.segments, codeToInject.entryAddress, this.hardware.ramKb);
    if (isHt1080zPlacementProblem(placement)) throw new Error(describeHt1080zPlacementProblem(placement));
    return placement;
  }

  /**
   * Run and Debug (D4): power the machine on, answer the power-on question with the code's lowest
   * address (the ROM then keeps BASIC below it, D-Q2), wait for the `>` prompt, write the code, push
   * the way back to BASIC (D-Q3) and start at the entry. Every model asks the question: Series I/II
   * `READY ?`, the /64 `MEMORY SIZE?`.
   */
  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model !== this.machineId) {
      throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
    }
    return [
      { type: "ReachExecPoint", rom: 0, execPoint: Ht1080zWasmHost.KEY_WAIT_LOOP, message: "BASIC asks the power-on question" },
      {
        type: "TypeText",
        // --- NEW LINE alone gives BASIC all the memory: code only in video RAM needs no protection
        text: (code) => `${code ? (this.placeCode(code).memoryTop ?? "") : ""}\n`
      },
      { type: "Start" },
      { type: "WaitKeyQueue" },
      { type: "ReachExecPoint", rom: 0, execPoint: Ht1080zWasmHost.KEY_WAIT_LOOP, message: "BASIC is at its > prompt" },
      { type: "Inject" },
      { type: "SetReturn", returnPoint: HT1080Z_RETURN_TO_BASIC, always: true }
    ];
  }

  /**
   * Writes the code where it was assembled and returns its entry (D5). BASIC's USR vector is pointed
   * at the entry too, so after an Inject, `X=USR(0)` calls the code. Run has already set the top of
   * BASIC's memory below the code; Inject leaves it as it is.
   */
  injectCodeToRun(codeToInject: CodeToInject): number {
    const placement = this.placeCode(codeToInject);
    for (const segment of placement.segments) {
      for (let i = 0; i < segment.emittedCode.length; i++) {
        this.doWriteMemory((segment.startAddress + i) & 0xffff, segment.emittedCode[i]);
      }
    }
    this.doWriteMemory(HT1080Z_USR_VECTOR, placement.entry & 0xff);
    this.doWriteMemory(HT1080Z_USR_VECTOR + 1, placement.entry >> 8);
    return placement.entry;
  }
}
