import { TapeMode } from "@/emu/abstractions/ITapeDevice";
import { SysVar, SysVarType } from "@/emu/abstractions/SysVar";
import { BeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../KeyboardDevice";
import {
  AUDIO_SAMPLE_RATE,
  KBTYPE_48,
  REWIND_REQUESTED,
  TAPE_MODE
} from "../machine-props";
import { TapeDevice } from "../tape/TapeDevice";
import { ZxSpectrumBase } from "../ZxSpectrumBase";
import { ZxSpectrum48FloatingBusDevice } from "./ZxSpectrumFloatingBusDevice";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrum48Machine extends ZxSpectrumBase {
  // --- This byte array represents the 64K memory, including the 16K ROM and 48K RAM.
  private readonly _memory = new Uint8Array(0x1_0000);

  /**
   * The unique identifier of the machine type
   */
  public readonly machineId = "sp48";

  /**
   * Initialize the machine
   */
  constructor () {
    super();
    // --- Set up machine attributes
    this.baseClockFrequency = 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    // --- Create and initialize devices
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(
      this,
      CommonScreenDevice.ZxSpectrum48ScreenConfiguration
    );
    this.beeperDevice = new BeeperDevice(this);
    this.floatingBusDevice = new ZxSpectrum48FloatingBusDevice(this);
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  /**
   * Sets up the machine (async)
   */
  async setup (): Promise<void> {
    // --- Get the ROM file
    const romContents = await this.loadRomFromResource(this.machineId);

    // --- Initialize the machine's ROM (roms/sp48.rom)
    this.uploadRomBytes(romContents);
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose (): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.floatingBusDevice?.dispose();
    this.tapeDevice?.dispose();
  }

  /**
   * Gets the ULA issue number of the ZX Spectrum model (2 or 3)
   */
  ulaIssue = 3;

  /**
   * Emulates turning on a machine (after it has been turned off).
   */
  hardReset (): void {
    super.hardReset();
    for (let i = 0x4000; i < this._memory.length; i++) this._memory[i] = 0;
    this.reset();
  }

  /**
   * This method emulates resetting a machine with a hardware reset button.
   */
  reset (): void {
    // --- Reset the CPU
    super.reset();

    // --- Reset and setup devices
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
    }
    this.floatingBusDevice.reset();
    this.tapeDevice.reset();

    // --- Set default property values
    this.setMachineProperty(TAPE_MODE, TapeMode.Passive);
    this.setMachineProperty(REWIND_REQUESTED);
    this.setMachineProperty(KBTYPE_48, true);

    // --- Unknown clock multiplier in the previous frame
    this.oldClockMultiplier = -1;

    // --- Prepare for running a new machine loop
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;
    this.lastRenderedFrameTact = 0;

    // --- Empty the queue of emulated keystrokes
    this.emulatedKeyStrokes.length = 0;
  }

  /**
   * Reads the screen memory byte
   * @param offset Offset from the beginning of the screen memory
   * @returns The byte at the specified screen memory location
   */
  readScreenMemory (offset: number): number {
    return this._memory[0x4000 + (offset & 0x3fff)];
  }

  /**
   * Get the 64K of addressable memory of the ZX Spectrum computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory (): Uint8Array {
    return this._memory;
  }

  /**
   * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
   * @param index Partition index
   */
  get16KPartition (index: number): Uint8Array {
    throw new Error(
      "This operation is not supported in the ZX Spectrum 48K model"
    );
  }

  /**
   * Gets the audio sample rate
   * @returns
   */
  getAudioSampleRate (): number {
    return this.beeperDevice.getAudioSampleRate();
  }

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples (): number[] {
    return this.beeperDevice.getAudioSamples();
  }

  /**
   * Get the number of T-states in a display line (use -1, if this info is not available)
   */
  get tactsInDisplayLine (): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @returns The byte read from the memory
   */
  doReadMemory (address: number): number {
    return this._memory[address];
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory (address: number, value: number): void {
    if ((address & 0xc000) !== 0x0000) {
      this._memory[address] = value;
    }
  }

  /**
   * This function reads a byte (8-bit) from an I/O port using the provided 16-bit address.
   * @param address
   * @returns Byte read from the specified port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port read operation.
   */
  doReadPort (address: number): number {
    return (address & 0x0001) == 0
      ? this.readPort0Xfe(address)
      : this.floatingBusDevice.readFloatingBus();
  }

  /**
   * This function implements the I/O port read delay of the CPU.
   * @param address Port address
   *
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortRead (address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param address Port address
   * @param value Value to send to the port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort (address: number, value: number): void {
    if ((address & 0x0001) === 0) {
      this.writePort0xFE(value);
    }
  }

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param address Port address
   */
  delayPortWrite (address: number): void {
    this.delayContendedIo(address);
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels (): number {
    return this.screenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels (): number {
    return this.screenDevice.screenLines;
  }

  /// <summary>
  /// Gets the buffer that stores the rendered pixels
  /// </summary>
  getPixelBuffer (): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * Uploades the specified ROM information to the ZX Spectrum 48 ROM memory
   * @param data ROM contents
   */
  uploadRomBytes (data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this._memory[i] = data[i];
    }
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars (): SysVar[] {
    return [
      {
        address: 0x5c00,
        name: "KSTATE",
        type: SysVarType.Array,
        length: 8,
        description:
          "Used in reading the keyboard.\nThere are two sets of four bytes here,\n" +
          "each set corresponding to a separate keypress.",
        byteDescriptions: [
          "$FF if the set is unused, or a main code from the main key table otherwise",
          "Call counter; initially +05, and decremented on each call to the KEYBOARD routine",
          "Repeat delay counter; initially REPDEL, decremented on each call to KEYBOARD, " +
            "reset to REPPER whenever it reaches zero",
          "Final code from the key tables (as computed by K_DECODE)",
          "$FF if the set is unused, or a main code from the main key table otherwise",
          "Call counter; initially +05, and decremented on each call to the KEYBOARD routine",
          "Repeat delay counter; initially REPDEL, decremented on each call to KEYBOARD, " +
            "reset to REPPER whenever it reaches zero",
          "Final code from the key tables (as computed by K_DECODE)"
        ]
      },
      {
        address: 0x5c08,
        name: "LAST-K",
        type: SysVarType.Byte,
        description: "Last key pressed"
      },
      {
        address: 0x5c09,
        name: "REPDEL",
        type: SysVarType.Byte,
        description: "Time that a key must be held down before it repeats"
      },
      {
        address: 0x5c0a,
        name: "REPPER",
        type: SysVarType.Byte,
        description: "Delay between successive repeats of a key held down"
      },
      {
        address: 0x5c0b,
        name: "DEFADD",
        type: SysVarType.Word,
        description: "Address of arguments of user defined function"
      },
      {
        address: 0x5c10,
        name: "STRMS",
        type: SysVarType.Array,
        length: 38,
        description: "Addresses of channels attached to streams",
        byteDescriptions: [
          "Stream $FD (keyboard), LSB",
          "Stream $FD (keyboard), MSB",
          "Stream $FE (screen), LSB",
          "Stream $FE (screen), MSB",
          "Stream $FF (workspace), LSB",
          "Stream $FF (workspace), MSB",
          "Stream $00 (keyboard), LSB",
          "Stream $00 (keyboard), MSB",
          "Stream $01 (keyboard), LSB",
          "Stream $01 (keyboard), MSB",
          "Stream $02 (screen), LSB",
          "Stream $02 (screen), MSB",
          "Stream $03 (printer), LSB",
          "Stream $03 (printer), MSB",
          "Stream $04, LSB",
          "Stream $04, MSB",
          "Stream $05, LSB",
          "Stream $05, MSB",
          "Stream $06, LSB",
          "Stream $06, MSB",
          "Stream $07, LSB",
          "Stream $07, MSB",
          "Stream $08, LSB",
          "Stream $08, MSB",
          "Stream $09, LSB",
          "Stream $09, MSB",
          "Stream $0A, LSB",
          "Stream $0A, MSB",
          "Stream $0B, LSB",
          "Stream $0B, MSB",
          "Stream $0C, LSB",
          "Stream $0C, MSB",
          "Stream $0D, LSB",
          "Stream $0D, MSB",
          "Stream $0E, LSB",
          "Stream $0E, MSB",
          "Stream $0F, LSB",
          "Stream $0F, MSB",
        ]
      },
      {
        address: 0x5c3b,
        name: "FLAGS",
        type: SysVarType.Flags,
        description: "Various flags to control the BASIC system",
        flagDecriptions: [
          "Leading space flag (set to suppress leading space)",
          "Printer flag (set when printer in use)",
          "Printer mode: K (reset) or L (set)",
          "Keyboard mode: K (reset) or L (set)",
          "Unused",
          "Set when a new key has been pressed",
          "Variable type flag: string (reset) or numeric (set)",
          "Reset when checking syntax, set during execution"
        ]
      },
    ];
  }
}
