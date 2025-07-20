import type { KeyMapping } from "@abstractions/KeyMapping";
import type { SysVar } from "@abstractions/SysVar";
import type { ISpectrumBeeperDevice } from "./zxSpectrum/ISpectrumBeeperDevice";
import type { IFloatingBusDevice } from "../abstractions/IFloatingBusDevice";
import type { ISpectrumKeyboardDevice } from "./zxSpectrum/ISpectrumKeyboardDevice";
import type { IScreenDevice } from "../abstractions/IScreenDevice";
import type { ITapeDevice } from "../abstractions/ITapeDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

import { EmulatedKeyStroke } from "../structs/EmulatedKeyStroke";
import { TapeMode } from "../abstractions/TapeMode";
import { Z80MachineBase } from "./Z80MachineBase";
import { SpectrumKeyCode } from "./zxSpectrum/SpectrumKeyCode";
import { spectrumKeyMappings } from "@emu/machines/zxSpectrum/SpectrumKeyMappings";

/**
 * ZX Spectrum 48 main execution cycle entry point
 */
export const SP48_MAIN_ENTRY = 0x12ac;

/**
 * ZX Spectrum 128 main waiting loop (Spectrum 128 ROM 0)
 */
export const SP128_MAIN_WAITING_LOOP = 0x2653;

/**
 * Return to Editor entry point in Spectrum 128 ROM-0
 */
export const SP128_RETURN_TO_EDITOR = 0x2604;

/**
 * ZX Spectrum 128/+2E/+3E main waiting loop (Spectrum +3E ROM 0)
 */
export const SPP3_MAIN_WAITING_LOOP = 0x0706;

/**
 * Return to Editor entry point in Spectrum +3E ROM 0
 */
export const SPP3_RETURN_TO_EDITOR = 0x0937;

/**
 * Wait between menu keys
 */
export const SP_KEY_WAIT = 250;

/**
 * The common core functionality for all ZX Spectrum machines
 */
export abstract class ZxSpectrumBase extends Z80MachineBase implements IZxSpectrumMachine {
  // --- This byte array stores the contention values associated with a particular machine frame tact.
  protected contentionValues: number[] = [];

  // --- Last value of bit 3 on port $FE
  private _portBit3LastValue = false;

  // --- Last value of bit 4 on port $FE
  private _portBit4LastValue = false;

  // --- Tacts value when last time bit 4 of $fe changed from 0 to 1
  private _portBit4ChangedFrom0Tacts = 0;

  // --- Tacts value when last time bit 4 of $fe changed from 1 to 0
  private _portBit4ChangedFrom1Tacts = 0;

  /**
   * Stores the key strokes to emulate
   */
  protected readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  /**
   * Represents the keyboard device of ZX Spectrum 48K
   */
  keyboardDevice: ISpectrumKeyboardDevice;

  /**
   * Represents the screen device of ZX Spectrum 48K
   */
  screenDevice: IScreenDevice;

  /**
   * Represents the beeper device of ZX Spectrum 48K
   */
  beeperDevice: ISpectrumBeeperDevice;

  /**
   * Represents the floating port device of ZX Spectrum 48K
   */
  floatingBusDevice: IFloatingBusDevice;

  /**
   * Represents the tape device of ZX Spectrum 48K
   */
  tapeDevice: ITapeDevice;

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
  abstract readScreenMemory(offset: number): number;

  /**
   * Gets the audio samples rendered in the current frame
   */
  abstract getAudioSamples(): number[];

  /**
   * Gets the structure describing system variables
   */
  abstract get sysVars(): SysVar[];

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine(): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * This function implements the memory read delay of the CPU.
   * @param address Memory address to read
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   *  action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryRead(address: number): void {
    this.delayAddressBusAccess(address);
    this.tactPlus3();
    this.totalContentionDelaySinceStart += 3;
    this.contentionDelaySincePause += 3;
  }

  /**
   * This function implements the memory write delay of the CPU.
   * @param address Memory address to write
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryWrite(address: number): void {
    this.delayMemoryRead(address);
  }

  /**
   * This method implements memory operation delays.
   * @param address Memory address
   *
   * Whenever the CPU accesses the 0x4000-0x7fff memory range, it contends with the ULA. We keep the contention
   * delay values for a particular machine frame tact in _contentionValues.Independently of the memory address,
   * the Z80 CPU takes 3 T-states to read or write the memory contents.
   */
  delayAddressBusAccess(address: number): void {
    if ((address & 0xc000) != 0x4000) return;

    // --- We read from contended memory
    const delay = this.contentionValues[this.currentFrameTact];
    this.tactPlusN(delay);
    this.totalContentionDelaySinceStart += delay;
    this.contentionDelaySincePause += delay;
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
  setContentionValue(tact: number, value: number): void {
    this.contentionValues[tact] = value;
  }

  /**
   * This method gets the contention value for the specified machine frame tact.
   * @param tact Machine frame tact
   * @returns The contention value associated with the specified tact.
   */
  getContentionValue(tact: number): number {
    return this.contentionValues[tact];
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
   * Reads a byte from the ZX Spectrum generic input port.
   * @param address Port address
   * @returns Byte value read from the generic port
   */
  protected readPort0Xfe(address: number): number {
    var portValue = this.keyboardDevice.getKeyLineStatus(address);

    // --- Check for LOAD mode
    if (this.tapeDevice.tapeMode === TapeMode.Load) {
      const earBit = this.tapeDevice.getTapeEarBit();
      this.beeperDevice.setEarBit(earBit);
      portValue = ((portValue & 0xbf) | (earBit ? 0x40 : 0)) & 0xff;
    } else {
      // --- Handle analog EAR bit
      var bit4Sensed = this._portBit4LastValue;
      if (!bit4Sensed) {
        // --- Changed later to 1 from 0 than to 0 from 1?
        let chargeTime = this._portBit4ChangedFrom1Tacts - this._portBit4ChangedFrom0Tacts;
        if (chargeTime > 0) {
          // --- Yes, calculate charge time
          chargeTime = chargeTime > 700 ? 2800 : 4 * chargeTime;

          // --- Calculate time ellapsed since last change from 1 to 0
          bit4Sensed = this.tacts - this._portBit4ChangedFrom1Tacts < chargeTime;
        }
      }

      // --- Calculate bit 6 value
      var bit6Value = this._portBit3LastValue ? 0x40 : bit4Sensed ? 0x40 : 0x00;

      // --- Check for ULA 3
      if (!bit4Sensed) {
        bit6Value = 0x00;
      }

      // --- Merge bit 6 with port value
      portValue = ((portValue & 0xbf) | bit6Value) & 0xff;
    }
    return portValue;
  }

  /**
   * Wites the specified data byte to the ZX Spectrum generic output port.
   * @param value Data byte to write
   */
  protected writePort0xFE(value: number): void {
    // --- Extract the border color
    this.screenDevice.borderColor = value & 0x07;

    // --- Store the last EAR bit
    var bit4 = value & 0x10;
    this.beeperDevice.setEarBit(bit4 !== 0);

    // --- Set the last value of bit3
    this._portBit3LastValue = (value & 0x08) !== 0;

    // --- Instruct the tape device process the MIC bit
    this.tapeDevice.processMicBit(this._portBit3LastValue);

    // --- Manage bit 4 value
    if (this._portBit4LastValue) {
      // --- Bit 4 was 1, is it now 0?
      if (!bit4) {
        this._portBit4ChangedFrom1Tacts = this.tacts;
        this._portBit4LastValue = false;
      }
    } else {
      // --- Bit 4 was 0, is it now 1?
      if (bit4) {
        this._portBit4ChangedFrom0Tacts = this.tacts;
        this._portBit4LastValue = true;
      }
    }
  }

  /**
   * Delays the I/O access according to address bus contention
   * @param address Port address
   */
  protected delayContendedIo(address: number): void {
    const spectrum = this;
    var lowbit = (address & 0x0001) !== 0;

    // --- Check for contended range
    if ((address & 0xc000) === 0x4000) {
      if (lowbit) {
        // --- Low bit set, C:1, C:1, C:1, C:1
        applyContentionDelay();
        this.tactPlus1();
        applyContentionDelay();
        this.tactPlus1();
        applyContentionDelay();
        this.tactPlus1();
        applyContentionDelay();
        this.tactPlus1();
      } else {
        // --- Low bit reset, C:1, C:3
        applyContentionDelay();
        this.tactPlus1();
        applyContentionDelay();
        this.tactPlus3();
      }
    } else {
      if (lowbit) {
        // --- Low bit set, N:4
        this.tactPlus4();
      } else {
        // --- Low bit reset, C:1, C:3
        this.tactPlus1();
        applyContentionDelay();
        this.tactPlus3();
      }
    }

    this.totalContentionDelaySinceStart += 4;
    this.contentionDelaySincePause += 4;

    // --- Apply I/O contention
    function applyContentionDelay(): void {
      const delay = spectrum.getContentionValue(spectrum.currentFrameTact);
      spectrum.tactPlusN(delay);
      spectrum.totalContentionDelaySinceStart += delay;
      spectrum.contentionDelaySincePause += delay;
    }
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels() {
    return this.screenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels() {
    return this.screenDevice.screenLines;
  }

  /**
   * Gets the buffer that stores the rendered pixels
   * @returns
   */
  getPixelBuffer(): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * This method renders the entire screen frame as the shadow screen
   * @param savedPixelBuffer Optional pixel buffer to save the rendered screen
   * @returns The pixel buffer that represents the previous screen
   */
  renderInstantScreen(savedPixelBuffer?: Uint32Array): Uint32Array {
    return this.screenDevice.renderInstantScreen(savedPixelBuffer);
  }

  /*
   * Gets the offset of the pixel buffer in the memory
   */
  getBufferStartOffset(): number {
    return this.screenDevice.screenWidth;
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
    const startTact = this.tacts + frameOffset * this.tactsInFrame * this.clockMultiplier;
    const endTact = startTact + frames * this.tactsInFrame * this.clockMultiplier;
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
   * @param model Machine model to use for code execution
   */
  abstract getCodeInjectionFlow(model: string): CodeInjectionFlow;

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
    if (codeToInject.options.cursork) {
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
    this.screenDevice.onNewFrame();

    // --- Prepare the beeper device for the new frame
    this.beeperDevice.onNewFrame();
  }

  /**
   * Tests if the machine should raise a Z80 maskable interrupt
   * @returns True, if the INT signal should be active; otherwise, false.
   */
  shouldRaiseInterrupt(): boolean {
    return this.currentFrameTact < 32;
  }

  /**
   * Check for current tape mode after each executed instruction
   */
  afterInstructionExecuted(): void {
    this.tapeDevice.updateTapeMode();
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented(): void {
    const machineTact = this.currentFrameTact;
    while (this.lastRenderedFrameTact <= machineTact) {
      this.screenDevice.renderTact(this.lastRenderedFrameTact++);
    }
    this.beeperDevice.setNextAudioSample();
  }

  /**
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency = 1;

  /**
   * Gets a flag for each 8K page that indicates if the page is a ROM
   */
  abstract getRomFlags(): boolean[];
}
