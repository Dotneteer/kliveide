import type { KeyMapping } from "@abstractions/KeyMapping";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { MessengerBase } from "@common/messaging/MessengerBase";
import type { BlinkState } from "@common/messaging/EmuApi";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import type { IZ88IdeMachine } from "./IZ88IdeMachine";
import type { CardSlotState } from "./CardSlotState";
import type { Z88CardSpec } from "./z88CardCatalog";

import { IMemorySection } from "@abstractions/MemorySection";
import { createMainApi } from "@common/messaging/MainApi";
import {
  MC_Z88_INTROM,
  MC_Z88_KEYBOARD,
  MC_Z88_SLOT0,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3,
  MC_Z88_USE_DEFAULT_ROM
} from "@common/machines/constants";
import { SETTING_EMU_KEYBOARD_LAYOUT } from "@common/settings/setting-const";
import { EmulatedKeyStroke, tactsPast, toTactCounter } from "@emu/structs/EmulatedKeyStroke";
import { Z80MachineBase } from "../Z80MachineBase";
import { Z88KeyCode } from "./Z88KeyCode";
import { z88KeyMappings } from "./Z88KeyMappings";
import { z88CardSpec, z88RomImageCardSpec, z88SlotHasCard } from "./z88CardCatalog";
import {
  parseZ88PartitionLabel,
  resolveZ88KeyboardLayout,
  resolveZ88RomName,
  Z88_BASE_CLOCK_FREQUENCY,
  Z88_DEFAULT_ROM,
  Z88_NO_CODE_INJECTION,
  Z88_TACTS_IN_FRAME,
  Z88_UI_FRAME_FREQUENCY,
  z88DisassemblySections,
  z88PartitionDescriptions,
  z88PartitionGroups,
  z88PartitionLabels,
  z88RomFlags
} from "./z88MachineInfo";

/**
 * The host side of a Cambridge Z88 whose hardware is emulated elsewhere - in the WASM core.
 *
 * Everything here is machine *plumbing* that does not depend on how the hardware is emulated: the
 * clock and frame units for the frame pacing, the partition names, the keyboard mapping and the
 * emulated keystroke queue, the machine-menu commands, and the ROM/card files: which card each slot
 * holds and what its image is. The rules come from `z88MachineInfo.ts` and `z88CardCatalog.ts`, which
 * the renderer shares.
 *
 * `Z88Machine`, `Z88BankedMemory` and the `Z88...Device` classes named below are the TypeScript Z88
 * this host was ported from, to the letter; they were removed once the WASM core had matched them
 * (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`) and live on at the tag `z88-typescript-last`.
 *
 * The emulating subclass supplies memory, ports, keys, the Blink, the LCD, audio and the frame loop.
 */
export abstract class Z88WasmHost extends Z80MachineBase implements IZ88Machine, IZ88IdeMachine {
  public readonly machineId = "z88" as const;

  /** The LCD is rendered and the UI refreshed every 8th (5 ms) frame */
  readonly uiFrameFrequency = Z88_UI_FRAME_FREQUENCY;

  /** The Z88 starts with a soft reset (OZ keeps its RAM filing system across a first start) */
  readonly softResetOnFirstStart = true;

  /** The machine reports sleep mode (HALT with I = $3F); the emulating subclass maintains it */
  isInSleepMode = false;

  /** The key strokes to emulate (code injection, the on-screen keyboard) */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  constructor(
    public readonly modelInfo?: MachineModel,
    config?: MachineConfigSet,
    protected readonly messenger?: MessengerBase
  ) {
    super(config ?? modelInfo?.config ?? {});
    this.baseClockFrequency = Z88_BASE_CLOCK_FREQUENCY;
    this.clockMultiplier = 1;
    this.delayedAddressBus = false;
  }

  // ==========================================================================================
  // The emulating backend

  /** Loads and prepares the emulating backend; called at the start of every `setup()` */
  protected abstract prepareBackend(): Promise<void>;

  /** Puts a card into a slot of the emulated machine; `contents` (when given) is the card image */
  protected abstract insertCardIntoBackend(slot: number, card: Z88CardSpec, contents?: Uint8Array): void;

  /** Takes the card out of a slot of the emulated machine (its bytes stay in physical memory) */
  protected abstract removeCardFromBackend(slot: number): void;

  /** Signals the battery-low condition to the Blink (STA.BTL) */
  protected abstract raiseBatteryLow(): void;

  abstract signalFlapOpened(): void;
  abstract signalFlapClosed(): void;
  abstract directReadMemory(absAddress: number): number;
  abstract getAudioSamples(): AudioSample[];
  abstract getBlinkState(): BlinkState;

  // ==========================================================================================
  // Setup, configuration and the cards

  /**
   * Sets up the machine as `Z88Machine.setup()` did: the slot-0 card (the configured one, or the
   * configured/default ROM image as a ROM card), the ROM machine properties, the keyboard layout
   * setting, then the other slots. An error is logged, not thrown - as the TypeScript machine did.
   */
  async setup(): Promise<void> {
    await this.prepareBackend();
    try {
      let romContents: Uint8Array | undefined;
      let romCard: Z88CardSpec;

      // --- A stored configuration may name a ROM resource that has since been renamed
      const configuredSlot0 = this.config?.[MC_Z88_SLOT0] as CardSlotState;
      const slot0 = configuredSlot0?.file
        ? { ...configuredSlot0, file: resolveZ88RomName(configuredSlot0.file) }
        : configuredSlot0;
      const intRom = resolveZ88RomName(this.config?.[MC_Z88_INTROM] as string | undefined);
      let useDefaultRom = false;
      if (z88SlotHasCard(slot0)) {
        // --- There is a card in slot 0
        romCard = z88CardSpec(slot0.cardType, slot0.size);
        if (slot0.file) {
          try {
            romContents = await this.loadRomFromResource(slot0.file);
          } catch {
            romContents = await this.loadRomFromFile(slot0.file);
          }
        }
        useDefaultRom = intRom === slot0.file;
      } else {
        useDefaultRom = true;
        romContents = await this.loadRomFromResource(intRom ? intRom : Z88_DEFAULT_ROM);
        romCard = z88RomImageCardSpec(romContents.length);
      }
      this.insertCard(0, romCard, romContents);

      // --- Store the current ROM size. As on the TypeScript machine, a slot-0 card configured
      // --- without a file stops the setup here (its contents are undefined).
      this.setMachineProperty(MC_Z88_INTROM, romContents.length);
      this.setMachineProperty(MC_Z88_USE_DEFAULT_ROM, useDefaultRom);

      await createMainApi(this.messenger).setGlobalSettingsValue(
        SETTING_EMU_KEYBOARD_LAYOUT,
        resolveZ88KeyboardLayout(this.config?.[MC_Z88_KEYBOARD])
      );

      await this.configure();
    } catch (err) {
      console.error("Error setting up Z88 machine: ", err);
    }
  }

  /**
   * Inserts or removes the cards of slots 1-3 as the configuration (and the dynamic configuration of
   * the card dialogs) says. Every slot settles before this method does; the first failure, if any,
   * is reported afterwards - as `Z88Machine.configure()` did.
   */
  async configure(): Promise<void> {
    const config = { ...this.config, ...this.dynamicConfig };
    const results = await Promise.allSettled([
      this.configureSlot(1, config?.[MC_Z88_SLOT1]),
      this.configureSlot(2, config?.[MC_Z88_SLOT2]),
      this.configureSlot(3, config?.[MC_Z88_SLOT3])
    ]);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) {
      throw failed.reason;
    }
  }

  private async configureSlot(slot: number, state: CardSlotState | undefined): Promise<void> {
    if (!z88SlotHasCard(state)) {
      this.removeCardFromBackend(slot);
      return;
    }
    const card = z88CardSpec(state.cardType, state.size);
    const contents = state.file ? await this.loadRomFromFile(state.file) : undefined;
    this.insertCard(slot, card, contents);
  }

  /**
   * Inserts a card after the check `Z88BankedMemory.insertCard` made: an image must be exactly as
   * long as the card.
   */
  protected insertCard(slot: number, card: Z88CardSpec, contents?: Uint8Array): void {
    if (slot < 0 || slot > 3) {
      throw new Error("Invalid slot index");
    }
    if (contents && contents.length !== card.sizeInBytes) {
      throw new Error(`Invalid initial content size (${contents.length}/${card.sizeInBytes})`);
    }
    this.insertCardIntoBackend(slot, card, contents);
  }

  /**
   * Emulates turning the machine on: CPU registers to their power-on values, then the setup (which
   * re-inserts the cards) and a reset - the order `Z88Machine.hardReset()` used.
   */
  async hardReset(): Promise<void> {
    super.hardReset();
    await this.setup();
    this.reset();
  }

  /**
   * The reset button: the CPU, the queued keystrokes, the sleep flag and the frame length.
   */
  reset(): void {
    super.reset();
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;
    this.emulatedKeyStrokes.length = 0;
    this.isInSleepMode = false;
    this.setTactsInFrame(Z88_TACTS_IN_FRAME);
  }

  // ==========================================================================================
  // Machine identity and metadata

  get romId(): string {
    return this.machineId;
  }

  /** OZ is not probed; the TypeScript machine answered `true` too */
  get isOsInitialized(): boolean {
    return true;
  }

  /** The Z88 has no Spectrum-style selected ROM page (its ROM is a card in slot 0) */
  getSelectedRomPage(): number {
    return 0;
  }

  /** The Z88 has no Spectrum-style selected RAM bank (it pages banks through SR0-SR3) */
  getSelectedRamBank(): number {
    return 0;
  }

  getRomFlags(): boolean[] {
    return z88RomFlags();
  }

  parsePartitionLabel(label: string): number | undefined {
    return parseZ88PartitionLabel(label);
  }

  getPartitionLabels(): Record<number, string> {
    return z88PartitionLabels();
  }

  getPartitionGroups(): Record<number, string> {
    return z88PartitionGroups();
  }

  getPartitionDescriptions(): Record<number, string> {
    return z88PartitionDescriptions();
  }

  getDisassemblySections(options: Record<string, any>): IMemorySection[] {
    return z88DisassemblySections(options);
  }

  /** The emulated core raises its own interrupts; the TypeScript frame runner never runs this CPU */
  protected shouldRaiseInterrupt(): boolean {
    return false;
  }

  // ==========================================================================================
  // Keyboard

  getKeyCodeSet(): KeyCodeSet {
    return Z88KeyCode;
  }

  getDefaultKeyMapping(): KeyMapping {
    return z88KeyMappings;
  }

  /**
   * Plays the queued key strokes as `Z88Machine.emulateKeystroke()` did: one entry at a time,
   * pressed (with its secondary and ternary keys) from its start tact to its end tact.
   *
   * The core's tact counter is 32 bits and wraps after about 22 minutes, so both points are compared
   * by their distance from it (`tactsPast`), never by value (issue #1374).
   */
  emulateKeystroke(): void {
    if (this.emulatedKeyStrokes.length === 0) return;
    const keyStroke = this.emulatedKeyStrokes[0];

    // --- Time has not come
    if (tactsPast(this.tacts, keyStroke.startTact) < 0) return;

    if (tactsPast(this.tacts, keyStroke.endTact) > 0) {
      // --- End emulation of this very keystroke
      this.setKeyStatus(keyStroke.primaryCode, false);
      if (keyStroke.secondaryCode !== undefined) {
        this.setKeyStatus(keyStroke.secondaryCode, false);
      }
      if (keyStroke.ternaryCode !== undefined) {
        this.setKeyStatus(keyStroke.ternaryCode, false);
      }
      this.emulatedKeyStrokes.shift();
      return;
    }

    // --- Emulate this very keystroke, and leave it in the queue
    this.setKeyStatus(keyStroke.primaryCode, true);
    if (keyStroke.secondaryCode !== undefined) {
      this.setKeyStatus(keyStroke.secondaryCode, true);
    }
    if (keyStroke.ternaryCode !== undefined) {
      this.setKeyStatus(keyStroke.ternaryCode, true);
    }
  }

  /**
   * Adds an emulated keypress to the queue, anchored to the current tact as
   * `Z88Machine.queueKeystroke()` did.
   * @param frameOffset Number of frames to start the keypress emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   */
  queueKeystroke(frameOffset: number, frames: number, primary: number, secondary?: number): void {
    const startTact = this.tacts + frameOffset * this.tactsInFrame * this.clockMultiplier;
    const endTact = startTact + frames * this.tactsInFrame * this.clockMultiplier;
    // --- In the counter's own range, as the core will report the tacts that reach them
    this.emulatedKeyStrokes.push(
      new EmulatedKeyStroke(toTactCounter(startTact), toTactCounter(endTact), primary, secondary)
    );
  }

  getKeyQueueLength(): number {
    return this.emulatedKeyStrokes.length;
  }

  // ==========================================================================================
  // Machine-menu commands

  /**
   * Executes a Z88 machine-menu command, as `Z88Machine.executeCustomCommand()` did.
   * @param command `battery_low`, `press_shifts`, `flap_open` or `flap_close`
   */
  async executeCustomCommand(command: string): Promise<any> {
    switch (command) {
      case "battery_low":
        if (this.isInSleepMode) {
          await this.pressShifts();
        }
        this.raiseBatteryLow();
        break;
      case "press_shifts":
        await this.pressShifts();
        break;
      case "flap_open":
        this.signalFlapOpened();
        break;
      case "flap_close":
        this.signalFlapClosed();
        break;
    }
  }

  /** Holds both shift keys for 400 ms: the Z88's way out of sleep */
  private async pressShifts(): Promise<void> {
    this.setKeyStatus(Z88KeyCode.ShiftL, true);
    this.setKeyStatus(Z88KeyCode.ShiftR, true);
    await new Promise((r) => setTimeout(r, 400));
    this.setKeyStatus(Z88KeyCode.ShiftL, false);
    this.setKeyStatus(Z88KeyCode.ShiftR, false);
  }

  // ==========================================================================================
  // Code injection (refused - follow-up F4)

  /** There is no Z88 code injection flow (follow-up F4 of the Z88 WASM migration plan) */
  async getCodeInjectionFlow(_model: string): Promise<CodeInjectionFlow> {
    throw new Error(Z88_NO_CODE_INJECTION);
  }

  /** There is no Z88 code injection (follow-up F4); the IDE refuses before it gets here */
  injectCodeToRun(_codeToInject: CodeToInject): number {
    throw new Error(Z88_NO_CODE_INJECTION);
  }
}
