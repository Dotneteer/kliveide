import type { KeyMapping } from "@abstractions/KeyMapping";
import type { SysVar } from "@abstractions/SysVar";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { EmulatedKeyStroke, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { Z80MachineBase } from "../Z80MachineBase";
import { SamKeyCode } from "./SamKeyCode";
import { samKeyMappings } from "./SamKeyMappings";
import { samStrokesForText } from "./SamTyper";
import { samSysVars } from "./SamSysVars";
import { SAM_CLOCK, SAM_TACTS_IN_FRAME, resolveSamHardware, type SamHardware } from "./samMachineInfo";
import {
  SAM_RUN_HMPR,
  describeSamPlacementProblem,
  isSamPlacementProblem,
  placeSamCode,
  type SamPlacement
} from "@common/samcoupe/codePlacement";

/**
 * Where the ROM waits for a key at its copyright screen, found by running it (the ROM0 address the CPU
 * keeps coming back to with interrupts on, `test/sam-hw/boot.test.ts`): the same in ROM 3.0 and 3.1.
 */
export const SAM_COPYRIGHT_KEY_WAIT = 0x0fa2;

/** The frames the typer holds a key and leaves it released (`typeText`; `test/sam-hw/keyboard.test.ts`) */
const KEY_HOLD_FRAMES = 3;
const KEY_GAP_FRAMES = 3;
/** The frames the typer waits after RETURN, for the line to be stored */
const ENTER_SETTLE_FRAMES = 8;

/**
 * The host side of a SAM Coupé whose hardware is emulated in the WASM core: the clock and frame units,
 * the keyboard mapping, the emulated keystroke queue and the code placement (`dev/plans/SAM_COUPE_PLAN.md`
 * §4.2). The emulating subclass supplies memory, ports, keys, the picture and the frame loop.
 */
export abstract class SamWasmHost extends Z80MachineBase {
  /** The model, as the core needs it */
  readonly hardware: SamHardware;

  /** The key strokes to emulate (the typer, the on-screen keyboard) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  constructor(
    public readonly machineId: string,
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.hardware = resolveSamHardware({ ...modelInfo?.config, ...config });
    this.baseClockFrequency = SAM_CLOCK;
    this.clockMultiplier = 1;
    this.delayedAddressBus = false;
  }

  /** The core raises the interrupt itself (the ASIC's STATUS pulses), never the TypeScript runner */
  protected shouldRaiseInterrupt(): boolean {
    return false;
  }

  /**
   * The reset button, and the end of every power-on. The frame length is set here: `Z80Cpu.hardReset`
   * leaves it at 1,000,000 tacts, and the controller paces the UI by it.
   */
  reset(): void {
    super.reset();
    this.clockMultiplier = 1;
    this.executionContext.lastTerminationReason = null;
    this.emulatedKeyStrokes.length = 0;
    this.setTactsInFrame(SAM_TACTS_IN_FRAME);
  }

  // ==========================================================================================
  // Machine identity and metadata

  get romId(): string {
    return this.machineId;
  }

  /**
   * Step Over's return point. `RST 8` is the ROM's error and DOS-hook call, and its code byte follows
   * it: a hook returns past that byte, so the call is 2 bytes long (plan §11, the TVC's `RST 30h` lesson).
   */
  override getCallInstructionLength(): number {
    if (this.doReadMemory(this.pc) === 0xcf) return 2;
    return super.getCallInstructionLength();
  }

  /** SAM BASIC's system variables in page 0 (`SamSysVars.ts`): right while section B shows page 0 */
  override get sysVars(): SysVar[] {
    return samSysVars;
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

  /** The whole address space as one disassembly section: what it holds depends on the paging */
  getDisassemblySections(_options: Record<string, any>): IMemorySection[] {
    return [{ startAddress: 0x0000, endAddress: 0xffff, sectionType: MemorySectionType.Disassemble }];
  }

  // ==========================================================================================
  // Keyboard

  getKeyCodeSet(): KeyCodeSet {
    return SamKeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return samKeyMappings;
  }

  /**
   * Plays the queued key strokes one entry at a time, each pressed from its start tact to its end tact.
   * Tact points are compared by their distance from the 32-bit counter (`tactsPast`).
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
    this.emulatedKeyStrokes.push(new EmulatedKeyStroke(toTactCounter(startTact), toTactCounter(endTact), primary, secondary, ternary));
  }

  getKeyQueueLength(): number {
    return this.emulatedKeyStrokes.length;
  }

  /**
   * Types a string as keystrokes (`SamTyper.ts`), starting `delayFrames` from now: each held
   * `KEY_HOLD_FRAMES` and released for `KEY_GAP_FRAMES`; after RETURN the typer waits
   * `ENTER_SETTLE_FRAMES` more, so the line is stored before the next one starts.
   * @throws when the keyboard cannot type a character
   */
  typeText(text: string, delayFrames = 0): void {
    const frameTacts = this.tactsInFrame * this.clockMultiplier;
    const at = (frames: number) => toTactCounter(this.tacts + Math.round((frames - 0.5) * frameTacts));
    let offset = delayFrames;
    for (const stroke of samStrokesForText(text)) {
      const [primary, secondary] = stroke.keys.map((name) => SamKeyCode[name]);
      this.emulatedKeyStrokes.push(new EmulatedKeyStroke(at(offset), at(offset + KEY_HOLD_FRAMES), primary, secondary));
      offset += KEY_HOLD_FRAMES + KEY_GAP_FRAMES + (stroke.keys.includes("Enter") ? ENTER_SETTLE_FRAMES : 0);
    }
  }

  // ==========================================================================================
  // Run and Debug (`dev/plans/SAM_COUPE_PLAN.md` §12, `common/samcoupe/codePlacement.ts`)

  /** Checks the code against the placement rules; throws the reason it cannot run */
  placeCode(codeToInject: CodeToInject): SamPlacement {
    const placement = placeSamCode(codeToInject.segments, codeToInject.entryAddress);
    if (isSamPlacementProblem(placement)) throw new Error(describeSamPlacementProblem(placement));
    return placement;
  }

  /** Writes a byte of an internal page (the subclass reaches the core) */
  protected abstract writePageByte(page: number, offset: number, value: number): void;
  /** Writes an I/O port as the CPU would */
  abstract doWritePort(address: number, value: number): void;
  abstract doReadPort(address: number): number;

  /**
   * Run and Debug: power on, let the ROM reach its copyright screen (where it waits for a key), write the
   * program's pages, page it in as a SAM BASIC program runs (HMPR = 1, ROM1 off) and start it. The disk
   * export (`samBootDisk.ts`) boots the same placement through the Klive loader.
   */
  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model !== this.machineId) {
      throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
    }
    return [
      {
        type: "ReachExecPoint",
        rom: 0,
        execPoint: SAM_COPYRIGHT_KEY_WAIT,
        message: "The SAM shows its copyright screen",
        checkpoint: `sam-copyright-${this.hardware.ramPages}-${this.hardware.rom.id}`
      },
      { type: "Inject" }
    ];
  }

  /** Writes the program's pages and pages them in; returns the entry point */
  injectCodeToRun(codeToInject: CodeToInject): number {
    const placement = this.placeCode(codeToInject);
    for (const block of placement.blocks) {
      for (let i = 0; i < block.bytes.length; i++) this.writePageByte(block.page, block.offset + i, block.bytes[i]);
    }
    // --- ROM0 and page 0 as BASIC has them, ROM1 off so page 2 shows at C000h
    const lmpr = this.doReadPort(0x00fa) & ~0x40;
    this.doWritePort(0x00fa, lmpr);
    this.doWritePort(0x00fb, SAM_RUN_HMPR);
    return placement.entry;
  }
}
