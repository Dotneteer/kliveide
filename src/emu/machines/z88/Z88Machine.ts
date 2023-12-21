import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { Z80MachineBase } from "../Z80MachineBase";
import { IZ88BeeperDevice } from "./IZ88BeeperDevice";
import { IZ88KeyboardDevice } from "./IZ88KeyboardDevice";
import { IZ88ScreenDevice } from "./IZ88ScreenDevice";
import { Z88KeyCode } from "./Z88KeyCode";
import { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import { KeyMapping } from "@renderer/abstractions/KeyMapping";
import { z88KeyMappings } from "./Z88KeyMappings";
import { EmulatedKeyStroke } from "@emu/structs/EmulatedKeyStroke";
import { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { CodeToInject } from "@abstractions/CodeToInject";
import { Z88KeyboardDevice } from "./Z88KeyboardDevice";
import { Z88ScreenDevice } from "./Z88ScreenDevice";
import { Z88BeeperDevice } from "./Z88BeeperDevice";
import { AUDIO_SAMPLE_RATE } from "../machine-props";
import { PagedMemory } from "../memory/PagedMemory";

export class Z88Machine extends Z80MachineBase implements IZ88Machine {
  private memory: PagedMemory;

  /**
   * The unique identifier of the machine type
   */
  public readonly machineId = "Z88";

  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId (): string {
    return this.machineId;
  }

  /**
   * Represents the keyboard device of Z88
   */
  keyboardDevice: IZ88KeyboardDevice;

  /**
   * Represents the screen device of Z88
   */
  screenDevice: IZ88ScreenDevice;

  /**
   * Represents the beeper device of Z88
   */
  beeperDevice: IZ88BeeperDevice;

  /**
   * Stores the key strokes to emulate
   */
  readonly emulatedKeyStrokes: EmulatedKeyStroke[] = [];

  /**
   * Initialize the machine
   */
  constructor () {
    super();
    // --- Set up machine attributes
    this.baseClockFrequency = 3_276_800;
    this.clockMultiplier = 1;

    // --- Z88 address bus is not delayed?
    this.delayedAddressBus = false;

    // --- Initialize the memory contents
    // TODO: Set up paged memory (romPages, ramPages)
    // this.memory = new PagedMemory(2, 8);

    // --- Create and initialize devices
    this.keyboardDevice = new Z88KeyboardDevice(this);
    this.screenDevice = new Z88ScreenDevice(this);
    this.beeperDevice = new Z88BeeperDevice(this);
    this.reset();
  }

  /**
   * Sets up the machine (async)
   */
  async setup (): Promise<void> {
    // TODO: Get the ROM file and upload it
  }

  /**
   * Dispose the resources held by the machine
   */
  dispose (): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
  }

  /**
   * Emulates turning on a machine (after it has been turned off).
   */
  hardReset (): void {
    super.hardReset();
    // TODO: Implement Z88-specific hard reset
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

    // TODO: Implement Z88-specific reset
    // TODO: Reset paged memory

    // --- Prepare for running a new machine loop
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;

    // --- Empty the queue of emulated keystrokes
    this.emulatedKeyStrokes.length = 0;
  }

  /**
   * Get the 64K of addressable memory of the Z88 computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory (): Uint8Array {
    // TODO: Implement this
    return new Uint8Array(0);
  }

  /**
   * Get the specified 16K partition (page or bank) of the Z88 computer
   * @param index Partition index
   * @returns Bytes of the partition
   */
  get16KPartition (index: number): Uint8Array {
    // TODO: Implement this
    return new Uint8Array(0);
  }

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples (): number[] {
    // TODO: Implement this
    return [];
  }

  /**
   * Read the byte at the specified memory address.
   * @param address 16-bit memory address
   * @returns The byte read from the memory
   */
  doReadMemory (address: number): number {
    return this.memory.readMemory(address);
  }

  /**
   * This function implements the memory read delay of the CPU.
   * @param address Memory address to read
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   *  action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryRead (address: number): void {
    // TODO: Implement this
  }

  /**
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory (address: number, value: number): void {
    this.memory.writeMemory(address, value);
  }

  /**
   * This function implements the memory write delay of the CPU.
   * @param address Memory address to write
   *
   * Normally, it is exactly 3 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 3-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 3 T-states!
   */
  delayMemoryWrite (address: number): void {
    // TODO: Implement this
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
    // TODO: Implement this
    return 0xff;
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
    // TODO: Implement this
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
    // TODO: Implement this
  }

  /**
   * This function implements the I/O port write delay of the CPU.
   * @param address  Port address
   *
   * Normally, it is exactly 4 T-states; however, it may be higher in particular hardware. If you do not set your
   * action, the Z80 CPU will use its default 4-T-state delay. If you use custom delay, take care that you increment
   * the CPU tacts at least with 4 T-states!
   */
  delayPortWrite (address: number): void {
    // TODO: Implement this
  }

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels () {
    return this.screenDevice.screenWidth;
  }

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels () {
    return this.screenDevice.screenLines;
  }

  /**
   * Gets the buffer that stores the rendered pixels
   * @returns
   */
  getPixelBuffer (): Uint32Array {
    return this.screenDevice.getPixelBuffer();
  }

  /**
   * Gets the key code set used for the machine
   */
  getKeyCodeSet (): KeyCodeSet {
    return Z88KeyCode;
  }

  /**
   * Gets the default key mapping for the machine
   */
  getDefaultKeyMapping (): KeyMapping {
    return z88KeyMappings;
  }

  /**
   * Set the status of the specified Z88 key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down.
   */
  setKeyStatus (key: number, isDown: boolean): void {
    this.keyboardDevice.setStatus(key, isDown);
  }

  /**
   * Emulates queued key strokes as if those were pressed by the user
   */
  emulateKeystroke (): void {
    if (this.emulatedKeyStrokes.length === 0) return;

    // --- Check the next keystroke
    const keyStroke = this.emulatedKeyStrokes[0];

    // --- Time has not come
    if (keyStroke.startTact > this.tacts) return;

    if (keyStroke.endTact < this.tacts) {
      // --- End emulation of this very keystroke
      this.keyboardDevice.setStatus(keyStroke.primaryCode, false);
      if (keyStroke.secondaryCode !== undefined) {
        this.keyboardDevice.setStatus(keyStroke.secondaryCode, false);
      }
      if (keyStroke.ternaryCode !== undefined) {
        this.keyboardDevice.setStatus(keyStroke.ternaryCode, false);
      }

      // --- Remove the keystroke from the queue
      this.emulatedKeyStrokes.shift();
      return;
    }

    // --- Emulate this very keystroke, and leave it in the queue
    this.keyboardDevice.setStatus(keyStroke.primaryCode, true);
    if (keyStroke.secondaryCode !== undefined) {
      this.keyboardDevice.setStatus(keyStroke.secondaryCode, true);
    }
    if (keyStroke.ternaryCode !== undefined) {
      this.keyboardDevice.setStatus(keyStroke.ternaryCode, true);
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
  queueKeystroke (
    frameOffset: number,
    frames: number,
    primary: number,
    secondary?: number
  ): void {
    const startTact =
      this.tacts + frameOffset * this.tactsInFrame * this.clockMultiplier;
    const endTact =
      startTact + frames * this.tactsInFrame * this.clockMultiplier;
    const keypress = new EmulatedKeyStroke(
      startTact,
      endTact,
      primary,
      secondary
    );
    this.emulatedKeyStrokes.push(keypress);
  }

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength (): number {
    return this.emulatedKeyStrokes.length;
  }

  /**
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  getCodeInjectionFlow (model: string): CodeInjectionFlow {
    // TODO: Implement this
    return [];
  }

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   * @returns The start address of the injected code
   */
  injectCodeToRun (codeToInject: CodeToInject): number {
    // TODO: Implement this
    return 0;
  }

  /**
   * The machine's execution loop calls this method when it is about to initialize a new frame.
   * @param clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the
   * previous frame.
   */
  onInitNewFrame (clockMultiplierChanged: boolean): void {
    // TODO: Implement this
  }

  /**
   * Tests if the machine should raise a Z80 maskable interrupt
   * @returns True, if the INT signal should be active; otherwise, false.
   */
  shouldRaiseInterrupt (): boolean {
    // TODO: Implement this
    return false;
  }

  /**
   * Whatever should be done before the CPU executes the next instruction
   */
  afterInstructionExecuted (): void {
    // TODO: Implement this
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented (): void {
    // TODO: Implement this
    // TODO: Screen rendering?
    this.beeperDevice.setNextAudioSample();
  }

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized (): boolean {
    // TODO: Implement this
    return true;
  }
}
