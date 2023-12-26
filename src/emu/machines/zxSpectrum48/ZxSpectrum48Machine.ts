import { SysVar, SysVarType } from "@abstractions/SysVar";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import {
  AUDIO_SAMPLE_RATE,
  REWIND_REQUESTED,
  TAPE_MODE,
  TAPE_SAVER
} from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import { SP48_MAIN_ENTRY, ZxSpectrumBase } from "../ZxSpectrumBase";
import { ZxSpectrum48FloatingBusDevice } from "./ZxSpectrum48FloatingBusDevice";
import { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { MachineModel } from "@common/machines/info-types";
import { MC_MEM_SIZE, MC_SCREEN_FREQ } from "@common/machines/constants";

/**
 * This class represents the emulator of a ZX Spectrum 48 machine.
 */
export class ZxSpectrum48Machine extends ZxSpectrumBase {
  // --- This byte array represents the 64K memory, including the 16K ROM and 48K RAM.
  private readonly _memory = new Uint8Array(0x1_0000);
  private readonly _is16KModel: boolean;

  /**
   * The unique identifier of the machine type
   */
  public readonly machineId = "sp48";

  /**
   * Initialize the machine
   */
  constructor (public readonly modelInfo?: MachineModel) {
    super();
    // --- Set up machine attributes
    this._is16KModel = modelInfo?.config?.[MC_MEM_SIZE] === 16;
    const isNtsc = modelInfo?.config?.[MC_SCREEN_FREQ] === "ntsc";
    this.baseClockFrequency = isNtsc ? 3_527_500 : 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;

    // --- Create and initialize devices
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(
      this,
      isNtsc
        ? CommonScreenDevice.ZxSpectrum48NtscScreenConfiguration
        : CommonScreenDevice.ZxSpectrum48PalScreenConfiguration
    );
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.floatingBusDevice = new ZxSpectrum48FloatingBusDevice(this);
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  /**
   * Sets up the machine (async)
   */
  async setup (): Promise<void> {
    // --- Get the ROM file
    const romContents = await this.loadRomFromResource(this.romId);

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
    if (this._is16KModel) {
      for (let i = 0x8000; i < this._memory.length; i++) this._memory[i] = 0xff;
    }
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
    this.setMachineProperty(
      TAPE_SAVER,
      new TapeSaver(this.tapeDevice as TapeDevice)
    );
    this.setMachineProperty(REWIND_REQUESTED);

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
    const slot = address >>> 14;
    if ((this._is16KModel && slot === 1) || (!this._is16KModel && slot !== 0)) {
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

  /**
   * Gets the buffer that stores the rendered pixels
   */
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
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  getCodeInjectionFlow (model: string): CodeInjectionFlow {
    if (model === "sp48") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(
            SP48_MAIN_ENTRY
          )})`
        },
        {
          type: "Inject"
        },
        {
          type: "SetReturn",
          returnPoint: SP48_MAIN_ENTRY
        }
      ];
    }
    throw new Error(
      `Code for machine model '${model}' cannot run on this virtual machine.`
    );
  }

  /**
   * Gets the structure describing system variables
   */
  get sysVars (): SysVar[] {
    return zxSpectrum48SysVars;
  }
}

/**
 * System variables of ZX Spectrum 48K
 */
export const zxSpectrum48SysVars: SysVar[] = [
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
    address: 0x5c0d,
    name: "K-DATA",
    type: SysVarType.Byte,
    description: "Second byte of colour controls entered from keyboard"
  },
  {
    address: 0x5c0d,
    name: "TVDATA",
    type: SysVarType.Word,
    description: "Colour, AT and TAB controls going to television"
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
      "Stream $0F, MSB"
    ]
  },
  {
    address: 0x5c36,
    name: "CHARS",
    type: SysVarType.Word,
    description: "256 less than address of character set"
  },
  {
    address: 0x5c38,
    name: "RASP",
    type: SysVarType.Byte,
    description: "Length of warning buzz"
  },
  {
    address: 0x5c39,
    name: "PIP",
    type: SysVarType.Byte,
    description: "Length of keyboard click"
  },
  {
    address: 0x5c3a,
    name: "ERR-NR",
    type: SysVarType.Byte,
    description: "One less than the error report code"
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
  {
    address: 0x5c3c,
    name: "TV-FLAG",
    type: SysVarType.Flags,
    description: "Flags associated with the television",
    flagDecriptions: [
      "Set when printing to the lower screen",
      "Unused",
      "Unused",
      "Set when the input mode has changed",
      "Set when an automatic listing is being produced",
      "Set when the lower screen needs clearing",
      "Unused",
      "Unused"
    ]
  },
  {
    address: 0x5c3d,
    name: "ERR-SP",
    type: SysVarType.Word,
    description: "Address of item on machine stack to use as error return"
  },
  {
    address: 0x5c3f,
    name: "LIST-SP",
    type: SysVarType.Word,
    description: "Return address from automatic listing"
  },
  {
    address: 0x5c41,
    name: "MODE",
    type: SysVarType.Byte,
    description:
      "Specifies K, L, C, E or G cursor\n" +
      "0: C, K or L\n" +
      "1: E\n" +
      "2: G"
  },
  {
    address: 0x5c42,
    name: "NEWPPC",
    type: SysVarType.Word,
    description: "Line to be jumped to"
  },
  {
    address: 0x5c44,
    name: "NSPPC",
    type: SysVarType.Byte,
    description: "Statement number in line to be jumped to"
  },
  {
    address: 0x5c45,
    name: "PPC",
    type: SysVarType.Word,
    description: "Line number of statement being executed"
  },
  {
    address: 0x5c47,
    name: "SUBPPC",
    type: SysVarType.Byte,
    description: "Number within line of statement being executed"
  },
  {
    address: 0x5c48,
    name: "BORDCR",
    type: SysVarType.Byte,
    description: "Border colour"
  },
  {
    address: 0x5c49,
    name: "E-PPC",
    type: SysVarType.Word,
    description: "Number of current line"
  },
  {
    address: 0x5c4b,
    name: "VARS",
    type: SysVarType.Word,
    description: "Address of variables"
  },
  {
    address: 0x5c4d,
    name: "DEST",
    type: SysVarType.Word,
    description: "Address of variable in assignment"
  },
  {
    address: 0x5c4f,
    name: "CHANS",
    type: SysVarType.Word,
    description: "Address of channel data"
  },
  {
    address: 0x5c51,
    name: "CURCHL",
    type: SysVarType.Word,
    description: "Address of information used for input and output"
  },
  {
    address: 0x5c53,
    name: "PROG",
    type: SysVarType.Word,
    description: "Address of BASIC program"
  },
  {
    address: 0x5c55,
    name: "NXTLIN",
    type: SysVarType.Word,
    description: "Address of next line in program"
  },
  {
    address: 0x5c57,
    name: "DATADD",
    type: SysVarType.Word,
    description: "Address of terminator of last DATA item"
  },
  {
    address: 0x5c59,
    name: "E-LINE",
    type: SysVarType.Word,
    description: "Address of command being typed in"
  },
  {
    address: 0x5c5b,
    name: "K-CUR",
    type: SysVarType.Word,
    description: "Address of cursor"
  },
  {
    address: 0x5c5d,
    name: "CH-ADD",
    type: SysVarType.Word,
    description: "Address of the next character to be interpreted"
  },
  {
    address: 0x5c5f,
    name: "X-PTR",
    type: SysVarType.Word,
    description: "Address of the character after the '?' marker"
  },
  {
    address: 0x5c61,
    name: "WORKSP",
    type: SysVarType.Word,
    description: "Address of temporary work space"
  },
  {
    address: 0x5c63,
    name: "STKBOT",
    type: SysVarType.Word,
    description: "Address of bottom of calculator stack"
  },
  {
    address: 0x5c65,
    name: "STKEND",
    type: SysVarType.Word,
    description: "Address of start of spare space"
  },
  {
    address: 0x5c67,
    name: "BREG",
    type: SysVarType.Byte,
    description: "Calculator's B register"
  },
  {
    address: 0x5c68,
    name: "MEM",
    type: SysVarType.Word,
    description: "Address of area used for calculator's memory"
  },
  {
    address: 0x5c6a,
    name: "FLAGS2",
    type: SysVarType.Flags,
    description: "More flags",
    flagDecriptions: [
      "Reset when the screen is clear",
      "Set when the printer buffer is in use",
      "Set when in quotes during line parsing",
      "Set when CAPS LOCK is on",
      "Set when using channel K (keyboard)",
      "Unused",
      "Unused",
      "Unused"
    ]
  },
  {
    address: 0x5c6b,
    name: "DF-SZ",
    type: SysVarType.Byte,
    description: "The number of lines in the lower part of the screen"
  },
  {
    address: 0x5c6c,
    name: "S-TOP",
    type: SysVarType.Word,
    description: "The number of the top program line in automatic listings"
  },
  {
    address: 0x5c6e,
    name: "OLDPPC",
    type: SysVarType.Word,
    description: "Line number to which CONTINUE jumps"
  },
  {
    address: 0x5c70,
    name: "OSPPC",
    type: SysVarType.Byte,
    description: "Number within line of statement to which CONTINUE jumps"
  },
  {
    address: 0x5c71,
    name: "FLAGX",
    type: SysVarType.Flags,
    description: "Various flags",
    flagDecriptions: [
      "Set when dealing with a complete simple string",
      "Set when dealing with a new (rather than existing) variable",
      "Unused",
      "Unused",
      "Unused",
      "Reset when in editing mode, set when in INPUT mode",
      "Unused",
      "Set when dealing with INPUT LINE"
    ]
  },
  {
    address: 0x5c72,
    name: "STRLEN",
    type: SysVarType.Word,
    description: "Length of string type destination in assignment"
  },
  {
    address: 0x5c74,
    name: "T-ADDR",
    type: SysVarType.Word,
    description: "Address of next item in parameter table"
  },
  {
    address: 0x5c76,
    name: "SEED",
    type: SysVarType.Word,
    description: "The seed for RND"
  },
  {
    address: 0x5c78,
    name: "FRAMES",
    type: SysVarType.Array,
    length: 3,
    description: "Frame counter",
    byteDescriptions: ["LSB", "MSB", "MSB #2"]
  },
  {
    address: 0x5c7b,
    name: "UDG",
    type: SysVarType.Word,
    description: "Address of first user defined graphic"
  },
  {
    address: 0x5c7d,
    name: "UDG",
    type: SysVarType.Array,
    length: 2,
    description: "Coordinates of last point plotted",
    byteDescriptions: ["x-coordinate", "y-coordinate"]
  },
  {
    address: 0x5c7f,
    name: "P-POSN",
    type: SysVarType.Byte,
    description: "Column number of printer position"
  },
  {
    address: 0x5c80,
    name: "PR-CC",
    type: SysVarType.Word,
    description: "Address of next position for LPRINT to print at"
  },
  {
    address: 0x5c82,
    name: "ECHO-E",
    type: SysVarType.Array,
    length: 2,
    description: "Column and line number of end of input buffer",
    byteDescriptions: ["Column number", "Line number"]
  },
  {
    address: 0x5c84,
    name: "DF-CC",
    type: SysVarType.Word,
    description: "Address in display file of PRINT position"
  },
  {
    address: 0x5c86,
    name: "DF-CCL",
    type: SysVarType.Word,
    description: "Like DF-CC for lower part of screen"
  },
  {
    address: 0x5c88,
    name: "S-POSN",
    type: SysVarType.Word,
    description: "Column and line number for PRINT position"
  },
  {
    address: 0x5c8a,
    name: "S-POSNL",
    type: SysVarType.Word,
    description: "Like S-POSN for lower part of screen"
  },
  {
    address: 0x5c8c,
    name: "SCR-CT",
    type: SysVarType.Byte,
    description: "Scroll counter"
  },
  {
    address: 0x5c8d,
    name: "ATTR-P",
    type: SysVarType.Byte,
    description: "Permanent current colours"
  },
  {
    address: 0x5c8e,
    name: "MASK-P",
    type: SysVarType.Byte,
    description: "Used for transparent colours"
  },
  {
    address: 0x5c8f,
    name: "ATTR-T",
    type: SysVarType.Byte,
    description: "Temporary current colours"
  },
  {
    address: 0x5c90,
    name: "MASK-T",
    type: SysVarType.Byte,
    description: "Temporary transparent colours"
  },
  {
    address: 0x5c91,
    name: "P-FLAG",
    type: SysVarType.Flags,
    description: "More flags",
    flagDecriptions: [
      "OVER bit (temporary)",
      "OVER bit (permanent)e",
      "INVERSE bit (temporary)",
      "INVERSE bit (permanent)",
      "INK 9 if set (temporary)",
      "INK 9 if set (permanent)",
      "PAPER 9 if set (temporary)",
      "PAPER 9 if set (permanent)"
    ]
  },
  {
    address: 0x5c92,
    name: "MEMBOT",
    type: SysVarType.Array,
    length: 30,
    description: "Calculator's memory area",
    byteDescriptions: [
      "mem-0 (byte 0)",
      "mem-0 (byte 1)",
      "mem-0 (byte 2)",
      "mem-0 (byte 3)",
      "mem-0 (byte 4)",
      "mem-1 (byte 0)",
      "mem-1 (byte 1)",
      "mem-1 (byte 2)",
      "mem-1 (byte 3)",
      "mem-1 (byte 4)",
      "mem-2 (byte 0)",
      "mem-2 (byte 1)",
      "mem-2 (byte 2)",
      "mem-2 (byte 3)",
      "mem-2 (byte 4)",
      "mem-3 (byte 0)",
      "mem-3 (byte 1)",
      "mem-3 (byte 2)",
      "mem-3 (byte 3)",
      "mem-3 (byte 4)",
      "mem-4 (byte 0)",
      "mem-4 (byte 1)",
      "mem-4 (byte 2)",
      "mem-4 (byte 3)",
      "mem-4 (byte 4)",
      "mem-5 (byte 0)",
      "mem-5 (byte 1)",
      "mem-5 (byte 2)",
      "mem-5 (byte 3)",
      "mem-5 (byte 4)"
    ]
  },
  {
    address: 0x5cb0,
    name: "NMIADD",
    type: SysVarType.Word,
    description: "Non-maskable interrupt address"
  },
  {
    address: 0x5cb2,
    name: "RAMTOP",
    type: SysVarType.Word,
    description: "Address of last byte of BASIC system area"
  },
  {
    address: 0x5cb4,
    name: "P-RAMT",
    type: SysVarType.Word,
    description: "Address of last byte of physical RAM"
  },
  {
    address: 0x5cb6,
    name: "CHINFO",
    type: SysVarType.Array,
    length: 21,
    description: "Channel information",
    byteDescriptions: [
      "Keyboard PRINT_OUT address LSB",
      "Keyboard PRINT_OUT address MSB",
      "Keyboard KEY_INPUT address LSB",
      "Keyboard KEY_INPUT address MSB",
      "'K'",
      "Screen PRINT_OUT address LSB",
      "Screenb PRINT_OUT address MSB",
      "Screen REPORT_J address LSB",
      "Screen REPORT_J address MSB",
      "'S'",
      "Work space ADD_CHAR address LSB",
      "Work space ADD_CHAR address MSB",
      "Work space REPORT_J address LSB",
      "Work space REPORT_J address MSB",
      "'R'",
      "Printer PRINT_OUT address LSB",
      "Printer PRINT_OUT address MSB",
      "Printer REPORT_J address LSB",
      "Printer REPORT_J address MSB",
      "'P'",
      "End marker"
    ]
  }
];
