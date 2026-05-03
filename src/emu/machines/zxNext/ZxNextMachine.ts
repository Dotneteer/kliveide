import type { KeyMapping } from "@abstractions/KeyMapping";
import type { SysVar } from "@abstractions/SysVar";
import type { ISpectrumBeeperDevice } from "@emu/machines/zxSpectrum/ISpectrumBeeperDevice";
import type { IFloatingBusDevice } from "@emu/abstractions/IFloatingBusDevice";
import type { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import type { ITapeDevice } from "@emu/abstractions/ITapeDevice";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow, CodeInjectionStep } from "@emu/abstractions/CodeInjectionFlow";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import type { MachineModel } from "@common/machines/info-types";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import { EmulatedKeyStroke } from "@emu/structs/EmulatedKeyStroke";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";
import { Z80NMachineBase } from "./Z80NMachineBase";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { NextRegDevice } from "./NextRegDevice";
import { PaletteDevice } from "./PaletteDevice";
import { TilemapDevice } from "./TilemapDevice";
import { SpriteDevice } from "./SpriteDevice";
import { DmaDevice } from "./DmaDevice";
import { CopperDevice } from "./CopperDevice";
import { CtcDevice } from "./CtcDevice";
import { I2cDevice } from "./I2cDevice";
import { UartDevice } from "./UartDevice";
import { OFFS_NEXT_ROM, MemoryDevice, OFFS_ALT_ROM_0, OFFS_DIVMMC_ROM, OFFS_MULTIFACE_MEM } from "./MemoryDevice";
import { NextIoPortManager } from "./io-ports/NextIoPortManager";
import { DivMmcDevice } from "./DivMmcDevice";
import { MultifaceDevice } from "./MultifaceDevice";
import { MouseDevice } from "./MouseDevice";
import { InterruptDevice, DAISY_PRIORITY_LINE, DAISY_PRIORITY_ULA } from "./InterruptDevice";
import { JoystickDevice } from "./JoystickDevice";
import { NextSoundDevice } from "./NextSoundDevice";
import { UlaDevice } from "./UlaDevice";
import { convertAsciiStringToNextKeyCodes, NextKeyboardDevice } from "./NextKeyboardDevice";
import { CallStackInfo } from "@emu/abstractions/CallStack";
import { SdCardDevice } from "./SdCardDevice";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { createMainApi } from "@common/messaging/MainApi";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { CpuState } from "@common/messaging/EmuApi";
import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { zxNextSysVars } from "./ZxNextSysVars";
import { CpuSpeedDevice } from "./CpuSpeedDevice";
import { ExpansionBusDevice } from "./ExpansionBusDevice";
import { FloppyControllerDevice } from "../disk/FloppyControllerDevice";
import { NextComposedScreenDevice } from "./screen/NextComposedScreenDevice";
import { AudioControlDevice } from "./AudioControlDevice";
import { TurboSoundDevice } from "./TurboSoundDevice";
import { DacDevice } from "./DacDevice";
import { AudioMixerDevice } from "./AudioMixerDevice";
import { AUDIO_SAMPLE_RATE } from "../machine-props";

const ZXNEXT_MAIN_WAITING_LOOP = 0x1202;
const SP_KEY_WAIT = 250;
const SP_KEY_WAIT_SHORT = 50;

/**
 * The common core functionality of the ZX Spectrum Next virtual machine.
 */
export class ZxNextMachine extends Z80NMachineBase implements IZxNextMachine {
  /**
   * The unique identifier of the machine type
   */
  public readonly machineId = "zxnext";

  cpuSpeedDevice: CpuSpeedDevice;

  portManager: NextIoPortManager;

  memoryDevice: MemoryDevice;

  interruptDevice: InterruptDevice;

  nextRegDevice: NextRegDevice;

  divMmcDevice: DivMmcDevice;

  multifaceDevice: MultifaceDevice;

  sdCardDevice: SdCardDevice;

  paletteDevice: PaletteDevice;

  tilemapDevice: TilemapDevice;

  spriteDevice: SpriteDevice;

  dmaDevice: DmaDevice;

  copperDevice: CopperDevice;

  ctcDevice: CtcDevice;



  i2cDevice: I2cDevice;

  uartDevice: UartDevice;

  /**
   * Represents the keyboard device of ZX Spectrum 48K
   */
  keyboardDevice: NextKeyboardDevice;

  composedScreenDevice: NextComposedScreenDevice;

  mouseDevice: MouseDevice;

  joystickDevice: JoystickDevice;

  soundDevice: NextSoundDevice;

  ulaDevice: UlaDevice;

  /**
   * Represents the beeper device of ZX Spectrum 48K
   */
  beeperDevice: ISpectrumBeeperDevice;

  /**
   * Audio control device that manages TurboSound, DAC, and mixer
   */
  audioControlDevice: AudioControlDevice;

  /**
   * Represents the floating port device of ZX Spectrum 48K
   */
  floatingBusDevice: IFloatingBusDevice;

  /**
   * Represents the tape device of ZX Spectrum 48K
   */
  tapeDevice: ITapeDevice;

  expansionBusDevice: ExpansionBusDevice;

  floppyDevice: IFloppyControllerDevice;

  // ─── NMI state machine ───────────────────────────────────────────────────

  private _nmiState: 'IDLE' | 'FETCH' | 'HOLD' | 'END' = 'IDLE';
  private _nmiHoldTicks = 0;
  private _nmiSourceMf: boolean = false;
  private _nmiSourceDivMmc: boolean = false;
  private _nmiSourceExpBus: boolean = false;
  private _pendingMfNmi: boolean = false;
  private _pendingDivMmcNmi: boolean = false;

  /** Set to true when a stackless NMI was processed; cleared after RETN fixes PC. */
  private _stacklessNmiProcessed: boolean = false;

  /** D6: When true, DivMMC should not process the current RETN (MF was active). */
  _suppressDivMmcRetn: boolean = false;

  // ─── Hot-path audio/screen caches ────────────────────────────────────────

  private _turboSoundDevice!: TurboSoundDevice;
  private _dacDevice!: DacDevice;
  private _audioMixerDevice!: AudioMixerDevice;
  /** Cached from composedScreenDevice.config.totalHC; refreshed on each new frame. */
  private _totalHC = 0;
  /** Current copper raster column (0-based); incremented per tact in onTactIncremented. */
  private _copperCurrentColumn = 0;
  /** Current copper raster line (0-based); incremented per tact in onTactIncremented. */
  private _copperCurrentLine = 0;

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Initialize the machine
   */
  constructor(
    public readonly modelInfo?: MachineModel,
    private readonly messenger?: MessengerBase
  ) {
    super();

    // --- Set up machine attributes
    this.baseClockFrequency = 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    this.expansionBusDevice = new ExpansionBusDevice(this);
    this.floppyDevice = new FloppyControllerDevice(this);
    this.cpuSpeedDevice = new CpuSpeedDevice(this);

    // --- Create and initialize the I/O port manager
    this.portManager = new NextIoPortManager(this);

    // --- Create and initialize the memory
    this.memoryDevice = new MemoryDevice(this);
    this.nextRegDevice = new NextRegDevice(this);
    this.interruptDevice = new InterruptDevice(this);

    // --- Create and initialize devices
    this.divMmcDevice = new DivMmcDevice(this);
    this.multifaceDevice = new MultifaceDevice(this);
    this.sdCardDevice = new SdCardDevice(this);
    this.paletteDevice = new PaletteDevice(this);
    this.tilemapDevice = new TilemapDevice(this);
    this.spriteDevice = new SpriteDevice(this);
    this.dmaDevice = new DmaDevice(this);
    this.copperDevice = new CopperDevice(this);
    this.ctcDevice = new CtcDevice(this);
    this.i2cDevice = new I2cDevice(this);
    this.uartDevice = new UartDevice(this);
    this.keyboardDevice = new NextKeyboardDevice(this);
    this.composedScreenDevice = new NextComposedScreenDevice(this);
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.mouseDevice = new MouseDevice(this);
    this.joystickDevice = new JoystickDevice(this);
    this.soundDevice = new NextSoundDevice(this);
    this.audioControlDevice = new AudioControlDevice(this);
    // --- Cache audio device references for hot-path performance (avoids getter chains per tact)
    this._turboSoundDevice = this.audioControlDevice.getTurboSoundDevice();
    this._dacDevice = this.audioControlDevice.getDacDevice();
    this._audioMixerDevice = this.audioControlDevice.getAudioMixerDevice();

    this.ulaDevice = new UlaDevice(this);
    this.hardReset();
    // --- Initialize totalHC cache now that composedScreenDevice is fully set up
    this._totalHC = this.composedScreenDevice.config.totalHC;
  }

  /**
   * Gets the current CPU state
   */
  getCpuState(): CpuState {
    return {
      af: this.af,
      bc: this.bc,
      de: this.de,
      hl: this.hl,
      af_: this.af_,
      bc_: this.bc_,
      de_: this.de_,
      hl_: this.hl_,
      pc: this.pc,
      sp: this.sp,
      ix: this.ix,
      iy: this.iy,
      ir: this.ir,
      wz: this.wz,
      tacts: this.tacts,
      tactsAtLastStart: this.tactsAtLastStart,
      interruptMode: this.interruptMode,
      iff1: this.iff1,
      iff2: this.iff2,
      sigINT: this.sigINT,
      halted: this.halted,
      snoozed: this.isCpuSnoozed(),
      opStartAddress: this.opStartAddress,
      lastMemoryReads: this.lastMemoryReads,
      lastMemoryReadValue: this.lastMemoryReadValue,
      lastMemoryWrites: this.lastMemoryWrites,
      lastMemoryWriteValue: this.lastMemoryWriteValue,
      lastIoReadPort: this.lastIoReadPort,
      lastIoReadValue: this.lastIoReadValue,
      lastIoWritePort: this.lastIoWritePort,
      lastIoWriteValue: this.lastIoWriteValue
    };
  }

  reset(): void {
    super.reset();
    this.cpuSpeedDevice.reset();
    this.memoryDevice.reset();
    this.interruptDevice.reset();
    this.divMmcDevice.reset();
    this.sdCardDevice.reset();
    this.paletteDevice.reset();
    this.tilemapDevice.reset();
    this.spriteDevice.reset();
    this.dmaDevice.reset();
    this.copperDevice.reset();
    this.ctcDevice.reset();
    this.i2cDevice.reset();
    this.uartDevice.reset();
    this.keyboardDevice.reset();
    this.composedScreenDevice.reset();
    this.mouseDevice.reset();
    this.joystickDevice.reset();
    this.soundDevice.reset();
    this.audioControlDevice.reset();
    this.floppyDevice.reset();
    this.ulaDevice.reset();
    this.beeperDevice.reset();

    // --- Configure audio sample rate for beeper device
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);

      // --- Also configure TurboSoundDevice with the same sample rate
      this._turboSoundDevice.setAudioSampleRate(audioRate);
    }

    this.expansionBusDevice.reset();
    this.multifaceDevice.reset();

    // --- This device is the last to reset, as it may override the reset of other devices
    this.nextRegDevice.reset();

    // --- Set default machine type
    this.nextRegDevice.configMode = false;
    this.composedScreenDevice.machineType = 0x03; // ZX Spectrum Next
  }

  /**
   * Get audio device state for persistence
   */
  getAudioDeviceState(): any {
    return this.audioControlDevice.getState();
  }

  /**
   * Restore audio device state from persisted data
   */
  setAudioDeviceState(state: any): void {
    this.audioControlDevice.setState(state);
  }

  async setup(): Promise<void> {
    // --- Get the ZX Spectrum Next ROM file
    let romContents = await this.loadRomFromFile("roms/enNextZX.rom");
    this.memoryDevice.upload(romContents, OFFS_NEXT_ROM);

    // --- Get the ZX Spectrum Next DivMMC ROM file
    romContents = await this.loadRomFromFile("roms/enNxtmmc.rom");
    this.memoryDevice.upload(romContents, OFFS_DIVMMC_ROM);

    // --- Get the Multiface ROM file
    romContents = await this.loadRomFromFile("roms/enNextMf.rom");
    this.memoryDevice.upload(romContents, OFFS_MULTIFACE_MEM);

    // --- Get the alternate ROM file
    romContents = await this.loadRomFromFile("roms/enAltZX.rom");
    this.memoryDevice.upload(romContents, OFFS_ALT_ROM_0);
  }

  /**
   * Emulates turning on a machine (after it has been turned off).
   */
  hardReset(): void {
    super.hardReset();
    this.reset();
    this.nextRegDevice.hardReset();
    this.memoryDevice.hardReset();
    // --- Clear NMI state machine on hard reset
    this._nmiState = 'IDLE';
    this._nmiSourceMf = false;
    this._nmiSourceDivMmc = false;
    this._nmiSourceExpBus = false;
    this._pendingMfNmi = false;
    this._pendingDivMmcNmi = false;
    this._stacklessNmiProcessed = false;
    this._suppressDivMmcRetn = false;
    this.sigNMI = false;
    // --- Enable NMI buttons by default (emulator convenience; hardware default is 0,
    //     but the emulator wants F9/F10 to work without explicit NR06 configuration)
    this.divMmcDevice.enableMultifaceNmiByM1Button = true;
    this.divMmcDevice.enableDivMmcNmiByDriveButton = true;
    // --- Default multiface type to MF+3 (type 0), matching VHDL default (nr_0a_mf_type := "00").
    //     The Next is a +3 machine and enNextMf.rom expects MF+3 port layout.
    this.divMmcDevice.multifaceType = 0;
  }

  // ─── NMI state machine helpers ───────────────────────────────────────────

  /** Mirrors VHDL nmi_activated — true when any NMI source is latched */
  get nmiActivated(): boolean {
    return this._nmiSourceMf || this._nmiSourceDivMmc || this._nmiSourceExpBus;
  }

  /**
   * Mirrors VHDL nmi_hold — true while the active device is still handling its NMI.
   * The state machine stays in HOLD until this drops false.
   */
  get nmiHold(): boolean {
    if (this._nmiSourceMf) return this.multifaceDevice.nmiHold;
    if (this._nmiSourceDivMmc) return this.divMmcDevice.divMmcNmiHold;
    return false; // expansion bus: modelled as always released (no hold)
  }

  /**
   * Mirrors VHDL nmi_accept_cause.
   * New NMI causes are accepted only in IDLE or FETCH states.
   */
  get nmiAcceptCause(): boolean {
    return this._nmiState === 'IDLE' || this._nmiState === 'FETCH';
  }

  /**
   * Accepts pending NMI sources using first-come-first-served arbitration.
   * Called from beforeOpcodeFetch() when nmiAcceptCause is true.
   */
  private updateNmiSources(): void {
    if (this.nmiActivated) return; // one already active

    const mfEnabled  = this.divMmcDevice.enableMultifaceNmiByM1Button;
    const divEnabled = this.divMmcDevice.enableDivMmcNmiByDriveButton;

    const assertMf     = this._pendingMfNmi && mfEnabled;
    const assertDivMmc = this._pendingDivMmcNmi && divEnabled;

    const conmemActive = (this.divMmcDevice.port0xe3Value & 0x80) !== 0; // port_e3_reg(7)
    const mfIsActive   = this.multifaceDevice.isActive;
    const divNmiHold   = this.divMmcDevice.divMmcNmiHold;

    if (assertMf && !conmemActive && !divNmiHold) {
      this._nmiSourceMf = true;
      this._pendingMfNmi = false;
    } else if (assertDivMmc && !mfIsActive) {
      this._nmiSourceDivMmc = true;
      this._pendingDivMmcNmi = false;
    } else {
      const expBus = this.expansionBusDevice;
      if (expBus.expansionBusNmiPending && expBus.enabled) {
        this._nmiSourceExpBus = true;
        expBus.expansionBusNmiPending = false;
      }
    }
  }

  /**
   * Advances the NMI state machine by one opcode-fetch boundary.
   * Mirrors the VHDL sequential NMI state machine.
   */
  private stepNmiStateMachine(): void {
    const pc = this.pc;
    switch (this._nmiState) {
      case 'IDLE':
        if (this.nmiActivated) {
          this._nmiState = 'FETCH';
          this.sigNMI = true;
          if (this._nmiSourceMf) {
            this.multifaceDevice.pressNmiButton();
          }
          if (this._nmiSourceDivMmc) {
            this.divMmcDevice.armNmiButton();
          }
        }
        break;

      case 'FETCH':
        if (pc === 0x0066) {
          if (this._nmiSourceMf) {
            this.multifaceDevice.onFetch0066();
          }
          this._nmiState = 'HOLD';
          this.sigNMI = false;
        }
        break;

      case 'HOLD': {
        this._nmiHoldTicks++;
        if (!this.nmiHold) {
          this._nmiHoldTicks = 0;
          this._nmiState = 'END';
        }
        break;
      }

      case 'END':
        this._nmiSourceMf     = false;
        this._nmiSourceDivMmc = false;
        this._nmiSourceExpBus = false;
        this._nmiState = 'IDLE';
        break;
    }
  }

  /**
   * Called from nextreg 0x02 write when bit 3 is set and nmiAcceptCause is true.
   */
  requestMfNmiFromSoftware(): void {
    if (this.nmiAcceptCause) {
      this._pendingMfNmi = true;
    }
  }

  /**
   * Called from nextreg 0x02 write when bit 2 is set and nmiAcceptCause is true.
   */
  requestDivMmcNmiFromSoftware(): void {
    if (this.nmiAcceptCause) {
      this._pendingDivMmcNmi = true;
    }
  }

  /**
   * Called when config mode is entered (nextreg 0x03 = 0x07).
   * Clears all pending NMI sources to prevent stale NMIs from firing during config mode.
   */
  onConfigModeEntered(): void {
    this._nmiState = 'IDLE';
    this._nmiSourceMf = false;
    this._nmiSourceDivMmc = false;
    this._nmiSourceExpBus = false;
    this._pendingMfNmi = false;
    this._pendingDivMmcNmi = false;
    this._stacklessNmiProcessed = false;
    this.sigNMI = false;
  }

  /**
   * Override the base Z80 NMI handler to support stackless NMI mode (nextreg 0xC0 bit 3).
   * When `enableStacklessNmi` is true, SP is decremented by 2 but no stack writes occur;
   * the return address is saved to `interruptDevice.nmiReturnAddress` instead.
   */
  protected override processNmi(): void {
    // De-assert sigNMI immediately: the CPU has acknowledged the interrupt.
    // Without this, sigNMI stays true across the return and processNmi() would
    // be called again on every subsequent cycle before beforeOpcodeFetch() gets
    // a chance to run the state machine (which is the only other place that clears it).
    this.sigNMI = false;

    // MF hardware predates stackless NMI — always use standard push for MF NMI
    // so the MF ROM's RETN can pop the correct return address from the stack.
    const useStackless = this.interruptDevice.enableStacklessNmi && !this._nmiSourceMf;

    if (useStackless) {
      // Acknowledge NMI timing
      this.tactPlusN(4);
      this.removeFromHaltedState();

      // Save and clear interrupt flip-flops as normal
      this.iff2 = this.iff1;
      this.iff1 = false;

      // Decrement SP by 2 but suppress the memory writes; save return address in nextreg
      this.sp = (this.sp - 2) & 0xffff;
      this.interruptDevice.nmiReturnAddress = this.pc;
      this._stacklessNmiProcessed = true;

      this.refreshMemory();
      this.pc = 0x0066;
    } else {
      super.processNmi();
    }
  }

  /**
   * D1: In hardware IM2 mode the IM2 vector byte is determined by the highest-priority
   * pending interrupt source rather than being fixed at 0xFF.  Priority order (lowest
   * index = highest priority):
   *   0  – line interrupt
   *   1  – UART0 RX (near-full or available)
   *   2  – UART1 RX (near-full or available)
   *   3-10 – CTC channels 0-7
   *   11 – ULA
   *   12 – UART0 TX empty
   *   13 – UART1 TX empty
   *
   * Vector = im2TopBits | (priority << 1).
   * When hwIm2Mode is false the classic Spectrum value 0xFF is returned.
   */
  protected override getInterruptVector(): number {
    const id = this.interruptDevice;
    if (!id.hwIm2Mode) return 0xff;
    // --- D4: Daisy chain determines the vector in HW IM2 mode.
    // The actual acknowledge (Requesting → InService) happens in onInterruptAcknowledged().
    // Here we only peek at the winning device to return its vector.
    const base = id.im2TopBits;
    for (let i = 0; i < 14; i++) {
      if (id.daisyInService[i]) break;
      if (id.isDeviceRequesting(i)) {
        return base | (i << 1);
      }
    }
    return 0xff;
  }

  /**
   * D4: When the CPU acknowledges an interrupt in hardware IM2 mode,
   * transition the winning device from Requesting to InService via the
   * daisy chain, clearing its pending request flag.
   */
  override onInterruptAcknowledged(): void {
    const id = this.interruptDevice;
    if (!id.hwIm2Mode) return;
    id.daisyAcknowledge();
  }

  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Executes the specified custom command
   * @param command Command to execute
   */
  async executeCustomCommand(command: string): Promise<any> {
    switch (command) {
      case "toggleScandoubler":
        return (this.composedScreenDevice.scandoublerEnabled =
          !this.composedScreenDevice.scandoublerEnabled);

      case "toggle5060Hz":
        if (this.nextRegDevice.hotkey50_60HzEnabled) {
          return (this.composedScreenDevice.is60HzMode = !this.composedScreenDevice.is60HzMode);
        }
        break;

      case "cycleCpuSpeed":
        if (this.nextRegDevice.hotkeyCpuSpeedEnabled) {
          this.cpuSpeedDevice.nextReg07Value = (this.cpuSpeedDevice.programmedSpeed + 1) & 0x03;
        }
        break;

      case "enableExpansionBus":
        if (this.nextRegDevice.hotkeyCpuSpeedEnabled) {
          this.expansionBusDevice.nextReg80Value |= 0x80;
          return this.expansionBusDevice.enabled;
        }
        break;

      case "disableExpansionBus":
        if (this.nextRegDevice.hotkeyCpuSpeedEnabled) {
          this.expansionBusDevice.nextReg80Value &= 0x7f;
          return this.expansionBusDevice.enabled;
        }
        break;

      case "adjustScanlineWeight":
        return (this.composedScreenDevice.scanlineWeight =
          (this.composedScreenDevice.scanlineWeight + 1) % 4);

      case "multifaceNmi":
        this._pendingMfNmi = true;
        break;

      case "divmmcNmi":
        this._pendingDivMmcNmi = true;
        break;
    }
  }

  get64KFlatMemory(): Uint8Array {
    return this.memoryDevice.get64KFlatMemory();
  }

  getMemoryPartition(index: number): Uint8Array {
    return this.memoryDevice.getMemoryPartition(index);
  }

  getCurrentPartitions(): number[] {
    return this.memoryDevice.getPartitions();
  }

  /**
   * Gets the selected ROM page number
   */
  getSelectedRomPage(): number {
    return this.memoryDevice.selectedRomMsb | this.memoryDevice.selectedRomLsb;
  }

  /**
   * Gets the selected RAM bank number
   */
  getSelectedRamBank(): number {
    return this.memoryDevice.selectedBankMsb | this.memoryDevice.selectedBankLsb;
  }

  getCurrentPartitionLabels(): string[] {
    return this.memoryDevice.getPartitionLabels();
  }

  /**
   * Gets the partition in which the specified address is paged in
   * @param address Address to get the partition for
   */
  getPartition(address: number): number | undefined {
    const pageIndex = address >> 13;
    const page = this.memoryDevice.getPageInfo(pageIndex);
    if (page.bank16k === 0xff) {
      const romLabel = this.memoryDevice.getPartitionLabelForPage(pageIndex);
      switch (romLabel) {
        case "UN":
          return undefined;
        case "R0":
          return -1;
        case "R1":
          return -2;
        case "R2":
          return -3;
        case "R3":
          return -4;
        case "A0":
          return -5;
        case "A1":
          return -6;
        case "DM":
          return -7;
        default:
          return -8 - parseInt(romLabel.substring(1));
      }
    } else {
      return page.bank16k;
    }
  }

  /**
   * Parses a partition label to get the partition number
   * @param label Label to parse
   */
  parsePartitionLabel(label: string): number | undefined {
    switch (label.toUpperCase()) {
      case "UN":
        return undefined;
      case "R0":
        return -1;
      case "R1":
        return -2;
      case "R2":
        return -3;
      case "R3":
        return -4;
      case "Q0":
        return -5;
      case "Q1":
        return -6;
      case "DM":
        return -7;
      default:
        if (label.startsWith("M")) {
          const part = label.substring(1);
          if (part.match(/^[0-9a-fA-F]$/)) {
            let partition = parseInt(part, 16);
            return partition >= 0 && partition <= 15 ? -8 - partition : undefined;
          }
          return -8 - parseInt(label.substring(1));
        }
        if (label.match(/^[0-9a-fA-F]{1,2}$/)) {
          const partValue = parseInt(label, 16);
          return partValue >= 0 && partValue < 224 ? partValue : undefined;
        }
        return undefined;
    }
  }

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  getPartitionLabels(): Record<number, string> {
    const result: Record<number, string> = {
      [-1]: "R0",
      [-2]: "R1",
      [-3]: "R2",
      [-4]: "R3",
      [-5]: "Q0",
      [-6]: "Q1",
      [-7]: "DM"
    };
    for (let i = 0; i < 16; i++) {
      result[-8 - i] = `M${i.toString(16).toUpperCase()}`;
    }
    for (let i = 0; i < 224; i++) {
      result[i] = toHexa2(i).toUpperCase();
    }
    return result;
  }

  /**
   * Gets a flag for each 8K page that indicates if the page is a ROM
   */
  getRomFlags(): boolean[] {
    return [false, false, false, false, false, false, false, false];
  }

  /**
   * Gets the current call stack information
   */
  getCallStack(frames = 16): CallStackInfo {
    const stack: number[] = [];
    let addr = this.sp;
    for (let i = 0; i < frames; i++) {
      const low = this.doReadMemory(addr++);
      const high = this.doReadMemory(addr++);
      stack.push(((high << 8) | low) & 0xffff);
    }
    return {
      sp: this.sp,
      frames: stack
    };
  }

  /**
   * Stores the key strokes to emulate
   */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId(): string {
    return this.machineId;
  }

  /**
   * Indicates if the currently selected ROM is the ZX Spectrum 48 ROM
   */
  get isSpectrum48RomSelected(): boolean {
    return true;
  }

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized(): boolean {
    return this.iy === 0x5c3a;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory(offset: number): number {
    // TODO: Implement this
    return this.memoryDevice.readMemory(0x4000 + offset);
  }

  /**
   * Gets the audio samples rendered in the current frame
   */
  getAudioSamples(): AudioSample[] {
    // Get the mixer device
    const mixer = this.audioControlDevice.getAudioMixerDevice();
    const turboSound = this.audioControlDevice.getTurboSoundDevice();

    // Determine if we should log detail for this frame
    // Logic: First non-zero frame after 200, then wait 2 frames, log the 3rd frame
    const frameCount = (turboSound as any)._frameCount;
    const firstNonZeroFrame = (turboSound as any)._firstNonZeroFrame;
    const shouldLogDetail = firstNonZeroFrame > 0 && frameCount === firstNonZeroFrame + 2;

    // Get time-series sample arrays from both devices.
    // PSG chip 0 is always active on real ZX Next hardware (like the ZX 128K AY chip).
    // PSG chip 0 is always active on real ZX Next hardware (like the ZX 128K AY chip).
    // "Enable TurboSound" (NR 0x08 bit 1) enables the multi-chip selection feature and
    // stereo routing.  When disabled, only the selected chip outputs audio (gated inside
    // TurboSoundDevice.setNextAudioSample per FPGA turbosound.vhd).
    const beeperSamples = this.beeperDevice.getAudioSamples();
    const turboSoundSamples = turboSound.getAudioSamples();

    // Both should have the same length, but handle mismatch gracefully
    const sampleCount = Math.max(beeperSamples.length, turboSoundSamples.length);

    // For each sample time, combine beeper + PSG + DAC in mixer
    const mixedSamples: AudioSample[] = [];
    const sampleDetails: Array<{
      ear: number;
      psgL: number;
      psgR: number;
      mixL: number;
      mixR: number;
    }> = [];

    for (let i = 0; i < sampleCount; i++) {
      // Get beeper samples (or 0 if out of range).
      // BeeperDevice: left = EAR time-weighted [0,1], right = MIC time-weighted [0,1].
      const rawEarSample = i < beeperSamples.length ? beeperSamples[i].left : 0.0;
      const rawMicSample = i < beeperSamples.length ? beeperSamples[i].right : 0.0;
      // FPGA: beep_spkr_excl = nr_06_internal_speaker_beep AND nr_08_internal_speaker_en.
      // When excl=1: EAR and MIC are zeroed from the PCM/headphone mixer.
      // nr_08_internal_speaker_en=0 only powers off the physical speaker transistor — the
      // headphone/HDMI PCM output is unaffected.
      const beepExcl = this.soundDevice.beepOnlyToInternalSpeaker
                     && this.soundDevice.enableInternalSpeaker;
      mixer.setEarLevel(beepExcl ? 0.0 : rawEarSample);
      mixer.setMicLevel(beepExcl ? 0.0 : rawMicSample);

      // Get PSG sample (or 0 if out of range or disabled)
      const psgSample = i < turboSoundSamples.length ? turboSoundSamples[i] : { left: 0, right: 0 };
      mixer.setPsgOutput(psgSample);

      // Get the mixed output (includes EAR, MIC, PSG, DAC)
      const mixed = mixer.getMixedOutput();
      mixedSamples.push(mixed);

      // Track details for logging
      if (shouldLogDetail && i < 100) {
        sampleDetails.push({
          ear: rawEarSample,
          psgL: psgSample.left,
          psgR: psgSample.right,
          mixL: mixed.left,
          mixR: mixed.right
        });
      }
    }

    return mixedSamples;
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars(): SysVar[] {
    // TODO: Implement this
    return zxNextSysVars;
  }

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number {
    return this.composedScreenDevice.screenWidth;
  }

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @return The byte read from the memory
   */
  doReadMemory(address: number): number {
    return this.memoryDevice.readMemory(address);
  }

  /**
   * This function implements the memory read delay of the CPU.
   * @param address Memory address to read
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   *  action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   *
   * At 28 MHz, memory reads require 1 additional wait state (1 T-state) with one exception:
   * - Bank 7 (BRAM, page 0x0E) reads have NO wait state - direct BRAM port access
   * - All other memory (SRAM and Bank 5 BRAM) has 1 wait state due to scheduling/arbitration
   */
  delayMemoryRead(address: number): void {
    this.tactPlusN(3);

    // --- At 28 MHz (speed value 3), add 1 wait state for memory reads
    // --- Exception: Bank 7 (page 0x0E) has no wait state - direct BRAM connection
    if (this.cpuSpeedDevice.effectiveSpeed === 3) {
      const pageIndex = (address >>> 13) & 0x07;
      const isBank7 = this.memoryDevice.bank8kLookup[pageIndex] === 0x0e;

      if (!isBank7) {
        this.tactPlusN(1);
        this.totalContentionDelaySinceStart++;
        this.contentionDelaySincePause++;
      }
    }
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory(address: number, value: number): void {
    this.memoryDevice.writeMemory(address, value);
  }

  /**
   * This function implements the memory write delay of the CPU.
   * @param _address Memory address to write
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   *
   * Note: Write operations do NOT get the extra wait state at 28 MHz. The hardware uses a different timing
   * mechanism (5× 28MHz HDMI clock) to ensure proper write timing without requiring CPU wait states.
   */
  delayMemoryWrite(_address: number): void {
    this.tactPlusN(3);
    this.totalContentionDelaySinceStart += 3;
    this.contentionDelaySincePause += 3;
  }

  /**
   * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
   * @param address
   * @returns Byte read from the specified port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port read operation.
   */
  doReadPort(address: number): number {
    return this.portManager.readPort(address);
  }

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param address Port address
   * @param value Value to send to the port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort(address: number, value: number): void {
    this.portManager.writePort(address, value);
  }

  /**
   * Sets a TBBlue register value
   * @param address Register address
   * @param value Register value;
   */
  tbblueOut(address: number, value: number): void {
    this.nextRegDevice.setNextRegisterIndex(address);
    this.nextRegDevice.setNextRegisterValue(value);
  }

  /**
   * Gets the ULA issue number of the ZX Spectrum model (2 or 3)
   */
  ulaIssue = 3;

  /**
   * This method sets the contention value associated with the specified machine frame tact.
   * @param tact Machine frame tact
   * @param value Contention value
   */
  setContentionValue(_tact: number, _value: number): void {
    // TODO: Implement this
  }

  /**
   * This method gets the contention value for the specified machine frame tact.
   * @param tact Machine frame tact
   * @returns The contention value associated with the specified tact.
   */
  getContentionValue(_tact: number): number {
    // TODO: Implement this
    return 0;
  }

  /**
   * This function implements the I/O port read delay of the CPU.
   * @param address Port address
   *
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortRead(address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param address  Port address
   *
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortWrite(address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * Called by Z80Cpu after RETN has executed (stack pop already set PC to garbage for stackless NMI).
   * Restores the correct return address for stackless NMI, and unmaps MF memory if still active.
   */
  public override onRetnExecuted(): void {
    // --- D4: RETI (ED 4D) in HW IM2 mode clears the first InService device
    // in the daisy chain. This must happen before any other RETN processing
    // because the FPGA's reti_seen signal propagates through the daisy chain
    // independently of the stackless NMI / MF / DivMMC handling.
    if (this.opCode === 0x4d && this.interruptDevice.hwIm2Mode) {
      this.interruptDevice.daisyReti();
    }

    // FPGA (zxnext.vhd line 4091): divmmc_retn_seen <= z80_retn_seen_28 and not mf_is_active
    // D6: Capture mf_is_active BEFORE clearing MF state. When MF was active,
    // DivMMC should not see RETN.
    const mfWasActive = this.multifaceDevice.isActive;

    // FPGA: cpu_retn_seen unconditionally clears both nmi_active and mf_enable
    // (D7: no guard on nmiHold — RETN always clears MF state)
    this.multifaceDevice.handleRetn();

    // D6: Suppress DivMMC RETN if multiface was active
    if (mfWasActive) {
      this._suppressDivMmcRetn = true;
    }

    if (this._stacklessNmiProcessed) {
      this._stacklessNmiProcessed = false;
      this.pc = this.interruptDevice.nmiReturnAddress;
    }
  }

  /**
   * Execute this method before fetching the opcode of the next instruction
   */
  beforeOpcodeFetch(): void {
    this.divMmcDevice.beforeOpcodeFetch();

    // 1. Accept new NMI causes (only in IDLE or FETCH)
    if (this.nmiAcceptCause) {
      this.updateNmiSources();
    }

    // 2. Advance the NMI state machine
    this.stepNmiStateMachine();
  }

  /**
   * The machine frame loop invokes this method before executing a CPU instruction.
   */
  beforeInstructionExecuted(): void {
    // --- Set the interrupt signal, if required so
    super.beforeInstructionExecuted();

    // --- clockMultiplier is kept for UI reporting (status bar frequency display)
    // --- via FrameCompletedArgs → Redux. Actual timing uses cpuTactScale in tactPlusN.
    this.clockMultiplier = this.cpuSpeedDevice.effectiveClockMultiplier;
    this.cpuTactScale = this.cpuSpeedDevice.effectiveCpuTactScale;

    // --- Check if DMA is requesting the bus and acknowledge it FIRST
    // This must happen before calling stepDma() so the bus is available
    let busControl = this.dmaDevice.getBusControl();
    if (busControl.busRequested && !busControl.busAcknowledged) {
      // --- DMA requested bus - acknowledge it
      this.dmaDevice.acknowledgeBus();
    }

    // --- Step DMA state machine if active
    // This allows DMA to perform one operation per CPU instruction cycle
    // After acknowledgment above, DMA can now proceed with transfer
    const dmaTStates = this.dmaDevice.stepDma();
    if (dmaTStates > 0) {
      // --- DMA performed an operation - consume T-states
      this.tactPlusN(dmaTStates);
    }
  }

  /**
   * Execute this method after fetching the opcode of the next instruction
   */
  afterOpcodeFetch(): void {
    this.divMmcDevice.afterOpcodeFetch();
  }

  /**
   * Tests if the specified port address falls in a contended I/O address range.
   * On ZX Spectrum Next, contention is only enabled at 3.5MHz (CPU speed 0) and when
   * contention is not disabled via NR $08 bit 6. Address ranges match Spectrum 128:
   * 0x4000-0x7FFF is always contended, and 0xC000-0xFFFF is contended when an odd-numbered
   * bank (1,3,5,7) is paged in at bank 3.
   */
  protected isContendedIoAddress(address: number): boolean {
    // Contention only applies at 3.5MHz (CPU speed 0)
    if (this.cpuSpeedDevice.effectiveSpeed !== 0) {
      return false;
    }

    // Contention can be disabled via NR $08 bit 6
    if (this.nextRegDevice.disableRamPortContention) {
      return false;
    }

    // Check address ranges: 0x4000-0x7fff is always contended,
    // 0xc000-0xffff is contended when odd-numbered bank is paged in at bank 3
    const page = address & 0xc000;
    return page === 0x4000 || (page === 0xc000 && (this.getSelectedRamBank() & 0x01) === 1);
  }

  /**
   * Delays the I/O access according to address bus contention
   * @param address Port address
   */
  protected delayContendedIo(address: number): void {
    const lowbit = (address & 0x0001) !== 0;

    // --- Check for contended range using the polymorphic check
    if (this.isContendedIoAddress(address)) {
      if (lowbit) {
        // --- Low bit set, C:1, C:1, C:1, C:1
        this.tactPlusN(1);
        this.tactPlusN(1);
        this.tactPlusN(1);
        this.tactPlusN(1);
      } else {
        // --- Low bit reset, C:1, C:3
        this.tactPlusN(1);
        this.tactPlusN(3);
      }
    } else {
      if (lowbit) {
        // --- Low bit set, N:4
        this.tactPlusN(4);
      } else {
        // --- Low bit reset, C:1, C:3
        this.tactPlusN(1);
        this.tactPlusN(3);
      }
    }
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels() {
    return this.composedScreenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels() {
    return this.composedScreenDevice.screenLines;
  }

  /**
   * Use canvas size multipliers
   * @returns The aspect ratio of the screen
   */
  getAspectRatio(): [number, number] {
    return this.composedScreenDevice.getAspectRatio();
  }

  /**
   * Gets the buffer that stores the rendered pixels
   * @returns
   */
  getPixelBuffer(): Uint32Array {
    return this.composedScreenDevice.getPixelBuffer();
  }

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.composedScreenDevice.renderInstantScreen(savedPixelBuffer);
  }

  /*
   * Gets the offset of the pixel buffer in the memory
   */
  getBufferStartOffset(): number {
    return 0;
  }

  /**
   * Gets the key code set used for the machine
   */
  getKeyCodeSet(): KeyCodeSet {
    return SpectrumKeyCode;
  }

  /**
   * Gets the default key mapping for the machine
   */
  getDefaultKeyMapping(): KeyMapping {
    return spectrumKeyMappings;
  }

  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setKeyStatus(key: number, isDown: boolean): void {
    this.keyboardDevice.setKeyStatus(key, isDown);
  }

  /**
   * Emulates queued key strokes as if those were pressed by the user
   */
  emulateKeystroke(): void {
    if (this.emulatedKeyStrokes.length === 0) return;

    // --- Check the next keystroke
    const keyStroke = this.emulatedKeyStrokes[0];

    // --- Time has not come
    if (keyStroke.startTact > this.tacts) return;

    if (keyStroke.endTact < this.tacts) {
      // --- End emulation of this very keystroke
      this.keyboardDevice.setKeyStatus(keyStroke.primaryCode, false);
      if (keyStroke.secondaryCode !== undefined) {
        this.keyboardDevice.setKeyStatus(keyStroke.secondaryCode, false);
      }

      // --- Remove the keystroke from the queue
      this.emulatedKeyStrokes.shift();
      return;
    }

    // --- Emulate this very keystroke, and leave it in the queue
    this.keyboardDevice.setKeyStatus(keyStroke.primaryCode, true);
    if (keyStroke.secondaryCode !== undefined) {
      this.keyboardDevice.setKeyStatus(keyStroke.secondaryCode, true);
    }
  }

  /**
   * Adds an emulated keypress to the queue of the provider.
   * @param frameOffset Number of frames to start the keypress emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   *
   * The keyboard provider can play back emulated key strokes
   */
  queueKeystroke(frameOffset: number, frames: number, primary: number, secondary?: number): void {
    // tactsInFrame is in 28 MHz domain; emulateKeystroke compares against this.tacts (T-states),
    // so divide by frameTactMultiplier (8) to get T-states per frame.
    const tactsPerFrame = (this.tactsInFrame / this.frameTactMultiplier) | 0;
    const startTact = this.tacts + frameOffset * tactsPerFrame;
    const endTact = startTact + frames * tactsPerFrame;
    const keypress = new EmulatedKeyStroke(startTact, endTact, primary, secondary);
    this.emulatedKeyStrokes.push(keypress);
  }

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength(): number {
    return this.emulatedKeyStrokes.length;
  }

  /**
   * Gets the current cursor mode
   */
  getCursorMode(): number {
    return this.doReadMemory(0x5c41);
  }

  /**
   * Gets the main execution point information of the machine
   * @param _model Machine model to use for code execution
   */
  async getCodeInjectionFlow(_model: string, additionalInfo: any): Promise<CodeInjectionFlow> {
    // --- Check for autoexec file
    const mainApi = createMainApi(this.messenger);
    const hasAutoExect = await mainApi.hasNextAutoExec();

    // --- Create QueueKey steps for the prompt
    const prompt = `.nexload ${additionalInfo}\n`;
    const promtKeys = convertAsciiStringToNextKeyCodes(prompt);
    const promptQueue: CodeInjectionStep[] = [];
    for (const keyCode of promtKeys) {
      if (keyCode.extMode) {
        promptQueue.push({
          type: "QueueKey",
          primary: SpectrumKeyCode.CShift,
          secondary: SpectrumKeyCode.CShift,
          wait: SP_KEY_WAIT_SHORT
        });
      }
      promptQueue.push({
        type: "QueueKey",
        primary: keyCode.primaryCode,
        secondary: keyCode.secondaryCode,
        wait: SP_KEY_WAIT_SHORT
      });
      promptQueue.push({
        type: "Wait",
        duration: SP_KEY_WAIT_SHORT
      });
    }

    // --- Create the flow
    const keys: CodeInjectionFlow = [
      {
        type: "KeepPc"
      },
      {
        type: "ReachExecPoint",
        rom: 0,
        execPoint: ZXNEXT_MAIN_WAITING_LOOP,
        message: `Main execution cycle point reached (ROM0/$${toHexa4(ZXNEXT_MAIN_WAITING_LOOP)})`
      },
      {
        type: "Start"
      },
      {
        type: "Wait",
        duration: 100
      },
      {
        type: "ReachExecPoint",
        rom: 0,
        execPoint: ZXNEXT_MAIN_WAITING_LOOP,
        message: `Main execution cycle point reached (ROM0/$${toHexa4(ZXNEXT_MAIN_WAITING_LOOP)})`
      },
      {
        type: "Start"
      }
    ];
    if (hasAutoExect) {
      keys.push(
        {
          type: "QueueKey",
          primary: SpectrumKeyCode.Space,
          wait: SP_KEY_WAIT,
          message: "Space"
        },
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: ZXNEXT_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(ZXNEXT_MAIN_WAITING_LOOP)})`
        }
      );
    }
    keys.push(
      {
        type: "Start"
      },
      {
        type: "QueueKey",
        primary: SpectrumKeyCode.N6,
        secondary: SpectrumKeyCode.CShift,
        wait: SP_KEY_WAIT,
        message: "Arrow down"
      },
      {
        type: "QueueKey",
        primary: SpectrumKeyCode.Enter,
        wait: 0,
        message: "Enter"
      },
      {
        type: "Wait",
        duration: 100
      },
      ...promptQueue
    );
    return keys;
  }

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   * @returns The start address of the injected code
   */
  injectCodeToRun(codeToInject: CodeToInject): number {
    // --- Clear the screen unless otherwise requested
    if (!codeToInject.options.noCls) {
      for (let addr = 0x4000; addr < 0x5800; addr++) {
        this.writeMemory(addr, 0);
      }
      for (let addr = 0x5800; addr < 0x5b00; addr++) {
        this.writeMemory(addr, 0x38);
      }
    }
    for (const segment of codeToInject.segments) {
      if (segment.bank !== undefined) {
        // TODO: Implement this
      } else {
        const addr = segment.startAddress;
        for (let i = 0; i < segment.emittedCode.length; i++) {
          this.writeMemory(addr + i, segment.emittedCode[i]);
        }
      }
    }

    // --- Prepare the run mode
    if (codeToInject.options.cursorl || codeToInject.options.cursork /* deprecated */) {
      // --- Set the keyboard in "L" mode
      this.writeMemory(0x5c3b, this.readMemory(0x5c3b) | 0x08);
    }

    // --- Use this start point
    return codeToInject.entryAddress ?? codeToInject.segments[0].startAddress;
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * @param _clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the
   * previous frame.
   */
  onInitNewFrame(_clockMultiplierChanged: boolean): void {
    // --- No screen tact rendered in this frame
    this.lastRenderedFrameTact = 0;

    // --- Prepare the screen device for the new machine frame
    this.composedScreenDevice.onNewFrame();

    // --- Prepare the beeper device for the new frame
    this.beeperDevice.onNewFrame();

    // --- Sync CTC to end of frame, then reset sync clock for next frame
    // --- (frameTacts wraps to ~0 each frame; readPort/writePort sync lazily)
    this.ctcDevice.onNewFrame(this.tactsInFrame);

    // --- Cache screen timing for hot-path use in onTactIncremented
    this._totalHC = this.composedScreenDevice.config.totalHC;
    this._copperCurrentLine = 0;
    this._copperCurrentColumn = 0;

    // --- Prepare audio devices for the new frame
    this._turboSoundDevice.onNewFrame();
    this._dacDevice.onNewFrame();
    this._audioMixerDevice.onNewFrame();

    // --- Advance DS1307 RTC clock (1 Hz tick via frame counting)
    this.i2cDevice.onNewFrame();

    // --- Auto-drain UART TX FIFOs
    this.uartDevice.onNewFrame();

    // --- Advance floppy disk motor timing
    this.floppyDevice.onFrameCompleted();
  }

  /**
   * Called after each Z80 instruction executes
   */
  afterInstructionExecuted(): void {
    super.afterInstructionExecuted();
    this._turboSoundDevice.calculateCurrentAudioValue(this.tacts);
    this._dacDevice.calculateCurrentAudioValue();
    this._audioMixerDevice.calculateCurrentAudioValue();
  }

  /**
   * Tests if the machine should raise a Z80 maskable interrupt
   * @returns True, if the INT signal should be active; otherwise, false.
   */
  shouldRaiseInterrupt(): boolean {
    const ulaActive = this.composedScreenDevice.pulseIntActive;
    const lineActive = this.composedScreenDevice.lineIntActive;
    const id = this.interruptDevice;

    if (id.hwIm2Mode) {
      if (ulaActive && !id.daisyInService[DAISY_PRIORITY_ULA]) {
        id.ulaInterruptStatus = true;
      }
      if (lineActive && id.lineInterruptEnabled && !id.daisyInService[DAISY_PRIORITY_LINE]) {
        id.lineInterruptStatus = true;
      }
      return id.daisyUpdateIrqState();
    }

    return ulaActive || (this.dmaDevice.getIp() === 1);
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented(): void {
    if (this.frameCompleted) return;
    while (this.lastRenderedFrameTact < this.currentFrameTact) {
      this.copperDevice.executeTick(this._copperCurrentLine, this._copperCurrentColumn);
      this._copperCurrentColumn++;
      if (this._copperCurrentColumn >= this._totalHC) {
        this._copperCurrentColumn = 0;
        this._copperCurrentLine++;
      }
      this.composedScreenDevice.renderTact(this.lastRenderedFrameTact++);
    }
    this.beeperDevice.setNextAudioSample();
    // --- Generate audio samples for all audio devices
    this._turboSoundDevice.setNextAudioSample(this.frameTacts);
    this._dacDevice.setNextAudioSample();
    this._audioMixerDevice.setNextAudioSample();
  }

  /**
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency = 1;

  /**
   * Processes the frame command
   */
  async processFrameCommand(messenger: MessengerBase): Promise<void> {
    // --- Lazy card-info initialization: fetch once on first frame command
    if (!this.sdCardDevice.hasCardInfo) {
      try {
        const info = await this.withIpcTimeout(
          createMainApi(messenger).getSdCardInfo(),
          "getSdCardInfo"
        );
        this.sdCardDevice.setCardInfo(info.totalSectors);
      } catch (err) {
        console.warn("SD card info fetch failed, using default CSD", err);
      }
    }

    const frameCommand = this.getFrameCommand();
    switch (frameCommand.command) {
      case "sd-write":
        try {
          // --- FIX for ISSUE #7: Wrap IPC call with timeout protection
          // --- Prevents renderer from hanging if main process becomes unresponsive
          const result = await this.withIpcTimeout(
            createMainApi(messenger).writeSdCardSector(frameCommand.sector, frameCommand.data),
            "writeSdCardSector"
          );
          // --- FIX for ISSUE #8: Only set write response after explicit persistence confirmation
          // --- The main process confirms that fsyncSync has completed
          if (result?.persistenceConfirmed) {
            this.sdCardDevice.setWriteResponse();
          } else {
            console.error("SD card write error: No persistence confirmation");
            this.sdCardDevice.setWriteErrorResponse("Persistence not confirmed");
          }
        } catch (err) {
          console.log("SD card sector write error", err);
          this.sdCardDevice.setWriteErrorResponse((err as Error).message);
        }
        break;
      case "sd-read": {
        // --- Wrap in block to properly scope sectorData variable
        try {
          // --- FIX for ISSUE #7: Wrap IPC call with timeout protection
          // --- Prevents renderer from hanging if main process becomes unresponsive
          const sectorData = await this.withIpcTimeout(
            createMainApi(messenger).readSdCardSector(frameCommand.sector),
            "readSdCardSector"
          );
          // --- FIX for ISSUE #6: Response Data Type Mismatch Potential
          // --- Validate that response is Uint8Array (defensive programming)
          if (sectorData instanceof Uint8Array) {
            this.sdCardDevice.setReadResponse(sectorData);
          } else if (Array.isArray(sectorData)) {
            // --- Convert Array to Uint8Array if needed (IPC edge case)
            this.sdCardDevice.setReadResponse(new Uint8Array(sectorData));
          } else {
            console.error("SD card read error: Invalid response data type", typeof sectorData);
            // --- Return error response using setMmcResponse with error status
            (this.sdCardDevice as any).setMmcResponse(new Uint8Array([0x0d, 0xff, 0xff]));
          }
        } catch (err) {
          console.log("SD card sector read error", err);
          // --- Return error response using setMmcResponse with error status
          (this.sdCardDevice as any).setMmcResponse(new Uint8Array([0x0d, 0xff, 0xff]));
        }
        break;
      }
      case "sd-write-card1":
        try {
          const result = await this.withIpcTimeout(
            createMainApi(messenger).writeSdCardSector(frameCommand.sector, frameCommand.data),
            "writeSdCard1Sector"
          );
          if (result?.persistenceConfirmed) {
            this.sdCardDevice.setCard1WriteResponse();
          } else {
            console.error("SD card 1 write error: No persistence confirmation");
            this.sdCardDevice.setCard1WriteErrorResponse("Persistence not confirmed");
          }
        } catch (err) {
          console.log("SD card 1 sector write error", err);
          this.sdCardDevice.setCard1WriteErrorResponse((err as Error).message);
        }
        break;
      case "sd-read-card1": {
        try {
          const sectorData = await this.withIpcTimeout(
            createMainApi(messenger).readSdCardSector(frameCommand.sector),
            "readSdCard1Sector"
          );
          if (sectorData instanceof Uint8Array) {
            this.sdCardDevice.setCard1ReadResponse(sectorData);
          } else if (Array.isArray(sectorData)) {
            this.sdCardDevice.setCard1ReadResponse(new Uint8Array(sectorData));
          } else {
            console.error("SD card 1 read error: Invalid response data type", typeof sectorData);
            this.sdCardDevice.setCard1WriteErrorResponse("Invalid data type");
          }
        } catch (err) {
          console.log("SD card 1 sector read error", err);
          this.sdCardDevice.setCard1WriteErrorResponse((err as Error).message);
        }
        break;
      }
      default:
        console.log("Unknown frame command", frameCommand);
        break;
    }
  }

  /**
   * Wraps an IPC call with timeout protection.
   * ISSUE #7 fix: Prevents renderer from hanging indefinitely if main process becomes unresponsive.
   *
   * @param promise The IPC promise to wrap
   * @param operationName Name of the operation for error logging
   * @returns Promise that resolves/rejects with the IPC result or timeout error
   */
  private withIpcTimeout<T>(promise: Promise<T>, operationName: string): Promise<T> {
    const IPC_TIMEOUT_MS = 5000; // 5 second timeout

    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(`IPC timeout: ${operationName} did not complete within ${IPC_TIMEOUT_MS}ms`)
            ),
          IPC_TIMEOUT_MS
        )
      )
    ]);
  }

  /**
   * Gets a disassembly section of the machine with the specified options.
   * @param _options The options for the disassembly section.
   * @returns The disassembly section.
   */
  getDisassemblySections(options: Record<string, any>): IMemorySection[] {
    const ram = !!options.ram;
    const screen = !!options.screen;
    const sections: IMemorySection[] = [];
    if (!ram || !screen) {
      // --- Use the memory segments according to the "ram" and "screen" flags
      sections.push({
        startAddress: 0x0000,
        endAddress: 0x3fff,
        sectionType: MemorySectionType.Disassemble
      });
      if (ram) {
        if (screen) {
          sections.push({
            startAddress: 0x4000,
            endAddress: 0xffff,
            sectionType: MemorySectionType.Disassemble
          });
        } else {
          sections.push({
            startAddress: 0x5b00,
            endAddress: 0xffff,
            sectionType: MemorySectionType.Disassemble
          });
        }
      } else if (screen) {
        sections.push({
          startAddress: 0x4000,
          endAddress: 0x5aff,
          sectionType: MemorySectionType.Disassemble
        });
      }
    } else {
      // --- Disassemble the whole memory
      sections.push({
        startAddress: 0x0000,
        endAddress: 0xffff,
        sectionType: MemorySectionType.Disassemble
      });
    }

    return sections;
  }
}
