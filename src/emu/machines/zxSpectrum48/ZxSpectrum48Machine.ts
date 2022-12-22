import { TapeMode } from "@/emu/abstractions/ITapeDevice";
import { BeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../KeyboardDevice";
import { KBTYPE_48, REWIND_REQUESTED, TAPE_MODE } from "../machine-props";
import { TapeDevice } from "../tape/TapeDevice";
import { Z80MachineBase } from "../Z80MachineBase";
import { AUDIO_SAMPLE_RATE, ZxSpectrumBase } from "../ZxSpectrumBase";
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
     * The name of the machine type to display
     */
    public readonly displayName = "ZX Spectrum 48K";

    /**
     * Initialize the machine
     */
    constructor() {
        super();
        // --- Set up machine attributes
        this.baseClockFrequency = 3_500_000;
        this.clockMultiplier = 1;
        this.delayedAddressBus = true;
        
        // --- Create and initialize devices
        this.keyboardDevice = new KeyboardDevice(this);
        this.screenDevice = new CommonScreenDevice(this, CommonScreenDevice.ZxSpectrum48ScreenConfiguration);
        this.beeperDevice = new BeeperDevice(this);
        this.floatingBusDevice = new ZxSpectrum48FloatingBusDevice(this);
        this.tapeDevice = new TapeDevice(this);
        this.reset();

        // --- Initialize the machine's ROM (Roms/ZxSpectrum48/sp48.rom)
        this.uploadRomBytes(Z80MachineBase.loadRomFromResource(this.machineId));
    }

    /**
     * Gets the ULA issue number of the ZX Spectrum model (2 or 3)
     */
    ulaIssue = 3;

    /**
     * Emulates turning on a machine (after it has been turned off).
     */
    hardReset(): void {
        super.hardReset();
        for (let i = 0x4000; i < this._memory.length; i++) this._memory[i] = 0;
        this.reset();
    }

    /**
     * This method emulates resetting a machine with a hardware reset button.
     */
    reset(): void {
        // --- Reset the CPU
        super.reset();

        // --- Reset and setup devices
        this.keyboardDevice.reset();
        this.screenDevice.reset();
        this.beeperDevice.reset();
        this.beeperDevice.setAudioSampleRate(AUDIO_SAMPLE_RATE);
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
    readScreenMemory(offset: number): number {
        return this._memory[0x4000 + (offset & 0x3fff)];
    }

    /**
     * Get the 64K of addressable memory of the ZX Spectrum computer
     * @returns Bytes of the flat memory
     */
    get64KFlatMemory(): Uint8Array {
        return this._memory;
    }

    /**
     * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
     * @param index Partition index
     */
    get16KPartition(index: number): Uint8Array {
        throw new Error("This operation is not supported in the ZX Spectrum 48K model");
    }

    /**
     * Gets the audio sample rate
     * @returns 
     */
    getAudioSampleRate(): number {
        return this.beeperDevice.getAudioSampleRate();
    }

    /**
     * Gets the audio samples rendered in the current frame
     * @returns Array with the audio samples
     */
    getAudioSamples(): number[] {
        return this.beeperDevice.getAudioSamples();
    }

    /**
     * Get the number of T-states in a display line (use -1, if this info is not available)
     */
    get tactsInDisplayLine(): number {
        return this.screenDevice.screenWidth;
    }

    /**
     * Read the byte at the specified memory address.
     * @param address 16-bit memory address
     * @returns The byte read from the memory
     */
    doReadMemory(address: number): number {
        return this._memory[address];
    }

    /**
     * Write the given byte to the specified memory address.
     * @param address 16-bit memory address
     * @param value Byte to write into the memory
     */
    doWriteMemory(address: number, value: number): void
    {
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
    doReadPort(address: number): number {
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
    delayPortRead(address: number): void {
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
    doWritePort(address: number, value: number): void {
        if ((address & 0x0001) === 0) {
            this.writePort0xFE(value);
        }
    }

    /**
     * This function implements the I/O port write delay of the CPU.
     * @param address Port address
     */
    delayPortWrite(address: number): void {
        this.delayContendedIo(address);
    }

    /**
     * Width of the screen in native machine screen pixels
     */
    get screenWidthInPixels(): number {
        return this.screenDevice.screenWidth;
    }

    /**
     * Height of the screen in native machine screen pixels
     */
    get screenHeightInPixels(): number {
        return this.screenDevice.screenLines;
    }

    /// <summary>
    /// Gets the buffer that stores the rendered pixels
    /// </summary>
    getPixelBuffer(): Uint32Array {
        return this.screenDevice.getPixelBuffer();
    }

    /**
     * Uploades the specified ROM information to the ZX Spectrum 48 ROM memory
     * @param data ROM contents
     */
    uploadRomBytes(data: Uint8Array): void {
        for (let i = 0; i < data.length; i++) {
            this._memory[i] = data[i];
        }
    }
}
