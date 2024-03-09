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
import { INTFlags, IZ88BlinkDevice, STAFlags } from "./IZ88BlinkDevice";
import { Z88BlinkDevice } from "./Z88BlinkDevice";
import { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import {
  MC_SCREEN_SIZE,
  MC_Z88_SLOT0,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3
} from "@common/machines/constants";
import { MC_Z88_INTROM } from "@common/machines/constants";
import { Z88BankedMemory } from "./memory/Z88BankedMemory";
import { Z88RomMemoryCard } from "./memory/Z88RomMemoryCard";
import { CARD_SIZE_EMPTY, createZ88MemoryCard } from "./memory/CardType";
import { SlotState } from "@renderer/appEmu/dialogs/Z88CardsDialog";
import { Z88UvEpromMemoryCard } from "./memory/Z88UvEpromMemoryCard";
import { Z88IntelFlashMemoryCard } from "./memory/Z88IntelFlashMemoryCard";
import { IZ88MemoryCard } from "./memory/IZ88MemoryCard";
import { CardSlotState } from "./memory/CardSlotState";

// --- Default ROM file
const DEFAULT_ROM = "z88v50-r1f99aaae";

export class Z88Machine extends Z80MachineBase implements IZ88Machine {
  private _emulatedKeyStrokes: EmulatedKeyStroke[] = [];
  private _shiftsReleased = false;

  /**
   * The unique identifier of the machine type
   */
  readonly machineId = "z88";

  /**
   * Gets the ROM ID to load the ROM file
   */
  get romId (): string {
    return this.machineId;
  }

  /**
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency = 8;

  /**
   * The physical memory of the machine (memory card model)
   */
  memory: Z88BankedMemory;

  /**
   * Represents the real time clock device of Z88
   */
  blinkDevice: IZ88BlinkDevice;

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
   * Indicates if Z88 is in sleep mode
   */
  isInSleepMode: boolean;

  /**
   * Stores the key strokes to emulate
   */

  /**
   * Initialize the machine
   */
  constructor (model: MachineModel, public readonly config: MachineConfigSet) {
    super(config);

    // --- config overrides model.config
    this.config = config ?? model?.config;

    // --- Set up machine attributes
    this.baseClockFrequency = 3_276_800;
    this.clockMultiplier = 1;

    // --- Z88 address bus is not delayed?
    this.delayedAddressBus = false;

    // --- Create the memory (new pattern using memory cards)
    this.memory = new Z88BankedMemory(this, 0xac23);

    // --- Create and initialize devices
    this.blinkDevice = new Z88BlinkDevice(this);
    this.keyboardDevice = new Z88KeyboardDevice(this);
    this.screenDevice = new Z88ScreenDevice(this);
    this.beeperDevice = new Z88BeeperDevice(this);

    // --- Set up the screen size
    let scw = 0xff;
    let sch = 8;
    switch (this.config?.[MC_SCREEN_SIZE]) {
      case "640x320":
        scw = 0xff;
        sch = 40;
        break;
      case "640x480":
        scw = 0xff;
        sch = 60;
        break;
      case "800x320":
        scw = 100;
        sch = 40;
        break;
      case "800x480":
        scw = 100;
        sch = 60;
        break;
    }

    // --- Now, reset the machine
    this.reset();
  }

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  getCurrentPartitions (): number[] {
    return this.memory.getPartitions();
  }

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  getCurrentPartitionLabels (): string[] {
    return this.memory.getPartitionLabels();
  }

  /**
   * Sets up the machine (async)
   */
  async setup (): Promise<void> {
    // --- Get the ROM file
    let romContents: Uint8Array;
    let romCard: IZ88MemoryCard | undefined;

    // --- Check Slot 0 for the ROM
    const slot0 = this.config?.[MC_Z88_SLOT0] as CardSlotState;
    if (slot0 && (slot0.size !== undefined && slot0.cardType !== "-")) {
      // --- There is a card in slot 0
      romCard = createZ88MemoryCard(this, slot0.size, slot0.cardType);
      if (slot0.file) {
        romContents = await this.loadRomFromFile(slot0.file);
      }
    } else {
      console.log("No ROM in slot 0")
      const intRom = this.config?.[MC_Z88_INTROM];
      if (intRom) {
        romContents = await this.loadRomFromResource(intRom);
      } else {
        console.log("Use default ROM")
        romContents = await this.loadRomFromResource(DEFAULT_ROM);
      }

      // --- Initialize the Z88 machine's default ROM
      romCard = new Z88RomMemoryCard(this, romContents.length);
    }
    this.memory.insertCard(0, romCard, romContents);

    // --- Configure the machine (using the dynamic configuration, too)
    this.configure();
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
   * Configures the machine after setting it up
   */
  async configure (): Promise<void> {
    // --- Use the dynamic configuation, too
    const config = { ...this.config, ...this.dynamicConfig };

    // --- Configure Slots
    const machine = this;
    handleSlot(1, config?.[MC_Z88_SLOT1]);
    handleSlot(2, config?.[MC_Z88_SLOT2]);
    handleSlot(3, config?.[MC_Z88_SLOT3]);

    // --- Handle the specified slot
    async function handleSlot (
      slotId: number,
      slot: CardSlotState
    ): Promise<void> {
      if (!slot || slot.cardType === "-" || slot.size === undefined) {
        // --- No slot info
        machine.memory.removeCard(slotId);
        return;
      }

      // --- There is a card in the slot
      let contents: Uint8Array | undefined;
      let type = slot.cardType;
      const card = createZ88MemoryCard(machine, slot.size, type);
      if (slot.file) {
        contents = await machine.loadRomFromFile(slot.file);
      }
      machine.memory.insertCard(slotId, card, contents);
    }
  }

  /**
   * Emulates turning on a machine (after it has been turned off).
   */
  async hardReset (): Promise<void> {
    await super.hardReset();
    this.memory.reset();
    await this.setup();
    this.reset();
  }

  /**
   * This method emulates resetting a machine with a hardware reset button.
   */
  reset (): void {
    // --- Reset the CPU
    super.reset();

    // --- Reset and setup devices
    this.blinkDevice.reset();
    this.keyboardDevice.reset();
    this._shiftsReleased = false;
    this.screenDevice.reset();
    this.beeperDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
    }

    // --- Prepare for running a new machine loop
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;

    // --- Empty the queue of emulated keystrokes
    this._emulatedKeyStrokes.length = 0;
    this.isInSleepMode = false;

    // --- Set up the machine frame length
    this.setTactsInFrame(16384);
  }

  /**
   * Get the 64K of addressable memory of the Z88 computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory (): Uint8Array {
    return this.memory.get64KFlatMemory();
  }

  /**
   * Get the specified 16K partition (page or bank) of the Z88 computer
   * @param index Partition index
   * @returns Bytes of the partition
   */
  get16KPartition (index: number): Uint8Array {
    return this.memory.get16KPartition(index);
  }

  /**
   * Reads the memory directly from the physical memory
   * @param absAddress Absolute memory address
   */
  directReadMemory (absAddress: number): number {
    return this.memory.directRead(absAddress);
  }

  /**
   * Gets the audio samples rendered in the current frame
   * @returns Array with the audio samples
   */
  getAudioSamples (): number[] {
    return this.beeperDevice.getAudioSamples();
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
   * Write the given byte to the specified memory address.
   * @param address 16-bit memory address
   * @param value Byte to write into the memory
   */
  doWriteMemory (address: number, value: number): void {
    this.memory.writeMemory(address, value);
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
    const addr8 = address & 0xff;
    const blink = this.blinkDevice;

    switch (addr8) {
      case 0xb0:
        // --- Machine Identification (MID)
        // --- $01: F88
        // --- $80: ZVM
        // --- $FF: Z88 (Blink on Cambridge Z88 does not implement read operation, and returns $FF)
        return 0x80;

      case 0xb1:
        return blink.STA;

      case 0xb2:
        // --- Read keyboard status
        if (blink.INT & INTFlags.KWAIT) {
          if (!this.keyboardDevice.isKeyPressed) {
            this.snoozeCpu();
            return 0xff;
          }
        }
        return this.keyboardDevice.getKeyLineStatus(address >> 8);

      case 0xb5:
        return blink.TSTA;

      case 0xd0:
        return blink.TIM0;

      case 0xd1:
        return blink.TIM1;

      case 0xd2:
        return blink.TIM2;

      case 0xd3:
        return blink.TIM3;

      case 0xd4:
        return blink.TIM4;

      case 0x70:
        return this.screenDevice.SCW;

      case 0x71:
        return this.screenDevice.SCH;

      case 0xe0:
        // --- Read RxD (not implemented yet)
        return 0x00;

      case 0xe1:
        // --- Read RxE (not implemented yet)
        return 0x00;

      case 0xe5:
        // --- Read UIT, UART Int status, always ready to receive... (not implemented yet)
        return 0x10;

      default:
        // --- Return the default port value
        return 0xff;
    }
  }

  /**
   * This function writes a byte (8-bit) to the 16-bit I/O port address provided in the first argument.
   * @param port Port address
   * @param value Value to send to the port
   *
   * When placing the CPU into an emulated environment, you must provide a concrete function that emulates the
   * I/O port write operation.
   */
  doWritePort (port: number, value: number): void {
    const addr8 = port & 0xff;
    // --- No ports below address 0x70 are handled
    if (addr8 < 0x70) {
      return;
    }

    // --- Check for screen ports (0x70..0x74)
    if (addr8 <= 0x74) {
      // --- This is a screen port, calculate the register value
      const screenRegVal = (port & 0xff00) | (value & 0xff);
      const screen = this.screenDevice;
      switch (addr8) {
        case 0x70:
          screen.PB0 = screenRegVal;
          return;
        case 0x71:
          screen.PB1 = screenRegVal;
          return;
        case 0x72:
          screen.PB2 = screenRegVal;
          return;
        case 0x73:
          screen.PB3 = screenRegVal;
          return;
        default:
          screen.SBR = screenRegVal;
          return;
      }
    }

    const blink = this.blinkDevice;
    switch (addr8) {
      case 0xd0:
        blink.setSR0(value);
        return;

      case 0xd1:
        blink.setSR1(value);
        return;

      case 0xd2:
        blink.setSR2(value);
        return;

      case 0xd3:
        blink.setSR3(value);
        return;

      case 0xb0:
        blink.setCOM(value);
        return;

      case 0xb1:
        blink.setINT(value);
        return;

      case 0xb3:
        blink.EPR = value;
        return;

      case 0xb4:
        blink.setTACK(value);
        return;

      case 0xb5:
        blink.TMK = value;
        return;

      case 0xb6:
        blink.setACK(value);
        return;
    }

    // 0xe2: RXC, UART Receiver Control (not yet implemented)
    // 0xe3: TXD, UART Transmit Data (not yet implemented)
    // 0xe4: TXC, UART Transmit Control (not yet implemented)
    // 0xe5: UMK, UART Int. mask (not yet implemented)
    // 0xe6 UAK, UART acknowledge int. mask (not yet implemented)
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
    if (this._emulatedKeyStrokes.length === 0) return;

    // --- Check the next keystroke
    const keyStroke = this._emulatedKeyStrokes[0];

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
      this._emulatedKeyStrokes.shift();
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
    this._emulatedKeyStrokes.push(keypress);
  }

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength (): number {
    return this._emulatedKeyStrokes.length;
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
    // --- 5ms frame completed, update the real time clock
    const blink = this.blinkDevice;
    blink.incrementRtc();

    // --- Awake the CPU when a key is pressed
    if (this.keyboardDevice.isKeyPressed && blink.INT & INTFlags.KWAIT) {
      this.awakeCpu();
    }

    // --- Render the screen (if it is time)
    this.screenDevice.renderScreen();

    // --- Check id the CPU is HALTed
    const keyboard = this.keyboardDevice;
    if (this.halted && this.i === 0x3f) {
      // --- Check if I is 0x3F
      this.isInSleepMode = true;
      if (this._shiftsReleased) {
        // --- Test if both shift keys are pressed again
        if (keyboard.isLeftShiftDown && keyboard.isRightShiftDown) {
          this._shiftsReleased = false;
          this.isInSleepMode = false;
          return;
        }
      } else {
        // --- Test if both shift keys are released
        if (!keyboard.isLeftShiftDown && !keyboard.isRightShiftDown) {
          this._shiftsReleased = true;
        }
      }
    } else {
      this.isInSleepMode = false;
    }

    // --- Prepare the beeper device for the new frame
    this.beeperDevice.onNewFrame();
  }

  /**
   * Tests if the machine should raise a Z80 maskable interrupt
   * @returns True, if the INT signal should be active; otherwise, false.
   */
  shouldRaiseInterrupt (): boolean {
    return this.blinkDevice.interruptSignalActive;
  }

  /**
   * Whatever should be done before the CPU executes the next instruction
   */
  afterInstructionExecuted (): void {
    // ---Awake the CPU whenever a key is pressed
    if (this.keyboardDevice.isKeyPressed) {
      this.awakeCpu();
    }
    this.beeperDevice.calculateOscillatorBit();
  }

  /**
   * Every time the CPU clock is incremented, this function is executed.
   * @param increment The tact increment value
   */
  onTactIncremented (): void {
    // TODO: Implement this
    this.beeperDevice.setNextAudioSample();
  }

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized (): boolean {
    // TODO: Implement this
    return true;
  }

  /**
   * Executes the specified custom command
   * @param command Command to execute
   */
  async executeCustomCommand (command: string): Promise<void> {
    const machine = this;
    switch (command) {
      case "battery_low":
        if (this.isInSleepMode) {
          await pressShifts();
        }
        this.blinkDevice.setSTA(this.blinkDevice.STA | STAFlags.BTL);
        break;
      case "press_shifts":
        await pressShifts();
        break;
      case "flap_open":
        this.signalFlapOpened();
        break;
      case "flap_close":
        this.signalFlapClosed();
        break;
    }

    async function pressShifts (): Promise<void> {
      machine.setKeyStatus(Z88KeyCode.ShiftL, true);
      machine.setKeyStatus(Z88KeyCode.ShiftR, true);
      await new Promise(r => setTimeout(r, 400));
      machine.setKeyStatus(Z88KeyCode.ShiftL, false);
      machine.setKeyStatus(Z88KeyCode.ShiftR, false);
    }
  }

  /**
   * The Blink only fires an IM 1 interrupt when the flap is opened and when
   * INT.FLAP is enabled. Both STA.FLAPOPEN and STA.FLAP is set at the time of
   * the interrupt. As long as the flap is open, no STA.TIME interrupts gets
   * out of the Blink (even though INT.TIME may be enabled and signals it to
   * fire those RTC interrupts). The Flap interrupt is only fired once; when
   * the flap is closed, and then opened. STA.FLAPOPEN remains enabled as long
   * as the flap is open; when the flap is closed, NO interrupt is fired -
   * only STA.FLAPOPEN is set to 0.
   */
  signalFlapOpened (): void {
    const blink = this.blinkDevice;
    const INT = this.blinkDevice.INT;
    if (!!(INT & INTFlags.FLAP) && !!(INT & INTFlags.GINT)) {
      // --- When flap is opened, time int's no longer come out..
      blink.setSTA(blink.STA | STAFlags.FLAP);
      this.awakeCpu();
      blink.setSTA(blink.STA | STAFlags.FLAPOPEN);
    }
  }

  /**
   * Signal that the flap was closed.<p> The Blink will start to fire STA.TIME
   * interrupts again if the INT.TIME is enabled and TMK has been setup to
   * fire Minute, Second or TICK's.
   *
   * This is not an interrupt (but Z80 goes out of snooze), only the STA.FLAPOPEN bit set to 0
   */
  signalFlapClosed (): void {
    this.blinkDevice.setACK(STAFlags.FLAPOPEN);
    this.awakeCpu();
  }
}
