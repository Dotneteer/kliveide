import type { KeyMapping } from "@abstractions/KeyMapping";
import type { SysVar } from "@abstractions/SysVar";
import { epSysVars } from "./EpSysVars";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";

import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { EmulatedKeyStroke, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { Z80MachineBase } from "../Z80MachineBase";
import { EpKeyCode } from "./EpKeyCode";
import { epKeyMappings } from "./EpKeyMappings";
import { epStrokesForText } from "./EpTyper";
import { EP_CLOCK, EP_TACTS_IN_FRAME, resolveEpHardware, type EpHardware } from "./epMachineInfo";
import type { EpRomSetId } from "./EpRoms";
import { t } from "@common/i18n/i18n";
import {
  EP_CODE_START,
  EP_RUN_FILE_NAME,
  describeEpPlacementProblem,
  epComFile,
  epRunCommand,
  isEpPlacementProblem,
  placeEpCode,
  type EpPlacement
} from "@common/enterprise/codePlacement";

/**
 * Where the ROMs wait for a key, found by running them (the most frequent PCs over 60 000 steps):
 * EXOS's banner (segment 00h at page 3) and the HALT IS-BASIC's editor waits on at its prompt (in
 * segment F8h/FCh at page 0, after an EI at 0056h). The banner never runs 0057h.
 */
const EP_KEY_WAITS: Record<EpRomSetId, { banner: number; prompt: number }> = {
  "21": { banner: 0xdc58, prompt: 0x0057 },
  "20": { banner: 0xdc2a, prompt: 0x0057 }
};
/** The frames Run waits on the banner before its key */
const BANNER_KEY_DELAY_FRAMES = 10;
/** The frames Run waits at the prompt before it types */
const PROMPT_KEY_DELAY_FRAMES = 50;

/** The frames the typer waits after ENTER, for the line to be stored (`typeText`) */
const ENTER_SETTLE_FRAMES = 6;

/**
 * The host side of an Enterprise 64/128 whose hardware is emulated in the WASM core: the clock and
 * frame units, the keyboard mapping and the emulated keystroke queue. It follows the TVC host
 * (`TvcWasmHost.ts`; `.plans/ENTERPRISE_PLAN.md` §4.2). The emulating subclass supplies memory, ports,
 * keys, the picture and the frame loop.
 *
 * Run and Debug come in Phase 8 (through Klive's `FILE:` ROM, plan §12).
 */
export abstract class EpWasmHost extends Z80MachineBase {
  /** The model, as the core needs it */
  readonly hardware: EpHardware;

  /** The key strokes to emulate (the typer, the on-screen keyboard) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  constructor(
    public readonly machineId: string,
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.hardware = resolveEpHardware({ ...modelInfo?.config, ...config });
    this.baseClockFrequency = EP_CLOCK;
    this.clockMultiplier = 1;
    this.delayedAddressBus = false;
  }

  /** The core raises the interrupt itself (DAVE's latches), never the TypeScript runner */
  protected shouldRaiseInterrupt(): boolean {
    return false;
  }

  /**
   * The reset button, and the end of every power-on (`hardReset` resets too). The frame length is set
   * here: `Z80Cpu.hardReset` leaves it at 1,000,000 tacts, and the controller paces the UI by it.
   */
  reset(): void {
    super.reset();
    this.clockMultiplier = 1;
    this.executionContext.lastTerminationReason = null;
    this.emulatedKeyStrokes.length = 0;
    this.setTactsInFrame(EP_TACTS_IN_FRAME);
  }

  // ==========================================================================================
  // Machine identity and metadata

  get romId(): string {
    return this.machineId;
  }

  /**
   * Step Over's return point. `RST 30h` is EXOS's call and its function code follows it: the handler
   * returns past that byte, so the call is 2 bytes long (plan §11).
   */
  override getCallInstructionLength(): number {
    if (this.doReadMemory(this.pc) === 0xf7) return 2;
    return super.getCallInstructionLength();
  }

  /** EXOS's variables in the system segment (`EpSysVars.ts`): right while page 2 shows segment FFh */
  override get sysVars(): SysVar[] {
    return epSysVars;
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
    return EpKeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return epKeyMappings;
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
   * Types a string as keystrokes (`EpTyper.ts`), starting `delayFrames` from now: each held 3 frames
   * and released for 3. EXOS scans the keyboard in its video interrupt, 50 times a second; 3 + 3
   * frames types every key reliably (`test/ep-hw/keyboard.test.ts`). After ENTER the typer waits
   * `ENTER_SETTLE_FRAMES` more, so the line is stored before the next one starts.
   * @throws when the keyboard cannot type a character
   */
  typeText(text: string, delayFrames = 0): void {
    const frameTacts = this.tactsInFrame * this.clockMultiplier;
    // --- Edges half a frame before the frame they belong to: a frame starts a few T-states after
    // --- its nominal boundary, so an edge on the boundary could fall a frame early or late
    const at = (frames: number) => toTactCounter(this.tacts + Math.round((frames - 0.5) * frameTacts));
    let offset = delayFrames;
    for (const stroke of epStrokesForText(text)) {
      const [primary, secondary] = stroke.keys.map((name) => EpKeyCode[name]);
      this.emulatedKeyStrokes.push(new EmulatedKeyStroke(at(offset), at(offset + 3), primary, secondary));
      offset += 6 + (stroke.keys.includes("Enter") ? ENTER_SETTLE_FRAMES : 0);
    }
  }

  // ==========================================================================================
  // Code injection: Phase 8 (`.plans/ENTERPRISE_PLAN.md` §12)

  // ==========================================================================================
  // Run and Debug (`.plans/ENTERPRISE_PLAN.md` §12, `common/enterprise/codePlacement.ts`)

  /**
   * Files the FILE: device serves before it asks the file store: Run puts the program here, so it
   * never lands in the user's FILE: folder. Names match whatever their case.
   */
  readonly stagedHostFiles = new Map<string, Uint8Array>();

  /** Checks the code against the placement rules; throws the reason it cannot run */
  placeCode(codeToInject: CodeToInject): EpPlacement {
    const placement = placeEpCode(codeToInject.segments, codeToInject.entryAddress);
    if (isEpPlacementProblem(placement)) throw new Error(describeEpPlacementProblem(placement));
    return placement;
  }

  /**
   * Run and Debug go through EXOS's own loader: power on, pass the ENTERPRISE banner with a key, wait
   * for IS-BASIC's prompt, stage the program as `KLIVE.COM` in the FILE: device, and type
   * `LOAD "FILE:KLIVE.COM"`. EXOS loads the `$$APP` at 0100h and starts it. The two waits are the
   * places the ROMs wait for a key, found by running them (`EP_KEY_WAITS`).
   */
  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model !== this.machineId) {
      throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
    }
    if (!this.hardware.hostFs) throw new Error(t("emu.ep.code.noHostFs"));
    const waits = EP_KEY_WAITS[this.hardware.romSet];
    return [
      { type: "ReachExecPoint", rom: 0, execPoint: waits.banner, message: "EXOS shows its banner" },
      { type: "QueueKey", primary: EpKeyCode.Space, delayFrames: BANNER_KEY_DELAY_FRAMES, wait: 0 },
      { type: "Start" },
      { type: "WaitKeyQueue" },
      { type: "ReachExecPoint", rom: 0, execPoint: waits.prompt, message: "IS-BASIC is at its prompt" },
      { type: "Inject" },
      // --- The placement throws before anything is typed when the rules refuse the code
      {
        type: "TypeText",
        text: (code) => (code ? (this.placeCode(code), epRunCommand()) : ""),
        delayFrames: PROMPT_KEY_DELAY_FRAMES
      },
      { type: "KeepPc" }
    ];
  }

  /** Stages the program for the FILE: device; EXOS loads it when Run types `LOAD` */
  injectCodeToRun(codeToInject: CodeToInject): number {
    const placement = this.placeCode(codeToInject);
    this.stagedHostFiles.set(EP_RUN_FILE_NAME, epComFile(placement));
    return EP_CODE_START;
  }
}
