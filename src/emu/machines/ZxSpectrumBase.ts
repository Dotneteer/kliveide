import { EmulatedKeyStroke } from "../abstractions/EmulatedKeyStroke";
import { IBeeperDevice } from "../abstractions/IBeeperDevice";
import { IFloatingBusDevice } from "../abstractions/IFloatingBusDevice";
import { IKeyboardDevice } from "../abstractions/IKeyboardDevice";
import { IScreenDevice } from "../abstractions/IScreenDevice";
import { ITapeDevice, TapeMode } from "../abstractions/ITapeDevice";
import { IZxSpectrumMachine } from "../abstractions/IZxSpectrumMachine";
import { SpectrumKeyCode } from "../abstractions/SpectrumKeyCode";
import { Z80MachineBase } from "./Z80MachineBase";

export const AUDIO_SAMPLE_RATE = 48_000;

/**
 * The common core functionality for all ZX Spectrum machines 
 */
export abstract class ZxSpectrumBase extends Z80MachineBase implements IZxSpectrumMachine
{
    // --- This byte array stores the contention values associated with a particular machine frame tact.
    private _contentionValues: number[] = [];

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
     * The clock multiplier value used in the previous machine frame
     */
    protected oldClockMultiplier: number;

    /**
     * Stores the last rendered machine frame tact.
     */
    protected lastRenderedFrameTact: number;

    /**
     * Represents the keyboard device of ZX Spectrum 48K
     */
    keyboardDevice: IKeyboardDevice;

    /**
     * Represents the screen device of ZX Spectrum 48K
     */
    screenDevice: IScreenDevice;

    /**
     * Represents the beeper device of ZX Spectrum 48K
     */
    beeperDevice: IBeeperDevice;

    /**
     * Represents the floating port device of ZX Spectrum 48K
     */
    floatingBusDevice: IFloatingBusDevice;

    /**
     * Represents the tape device of ZX Spectrum 48K
     */
    tapeDevice: ITapeDevice;

    /**
     * Indicates if the currently selected ROM is the ZX Spectrum 48 ROM
     */
    get isSpectrum48RomSelected(): boolean {
        return true;
    }

    /**
     * Reads the screen memory byte
     * @param offset Offset from the beginning of the screen memory
     * @returns The byte at the specified screen memory location
     */
    abstract readScreenMemory(offset: number): number;

    /**
     * Get the 64K of addressable memory of the ZX Spectrum computer
     * @returns Bytes of the flat memory
     */
    abstract get64KFlatMemory(): Uint8Array;

    /**
     * Get the specified 16K partition (page or bank) of the ZX Spectrum computer
     * @param index Partition index
     * 
     * Less than zero: ROM pages
     * 0..7: RAM bank with the specified index
     */
    abstract get16KPartition(index: number): Uint8Array;

    /**
     * Gets the audio sample rate
     */
    abstract getAudioSampleRate(): number;

    /**
     * Gets the audio samples rendered in the current frame
     */
    abstract getAudioSamples(): number[];

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
        const delay = this._contentionValues[this.currentFrameTact];
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
        this._contentionValues[tact] = value;
    }

    /**
     * This method gets the contention value for the specified machine frame tact.
     * @param tact Machine frame tact
     * @returns The contention value associated with the specified tact.
     */
    getContentionValue(tact: number): number {
        return this._contentionValues[tact];
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
            var bit6Value = this._portBit3LastValue
              ? 0x40
              : bit4Sensed
                ? 0x40
                : 0x00;

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
        // --- Extract bthe border color
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
            const delay = spectrum.getContentionValue(this.currentFrameTact);
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
     * Set the status of the specified ZX Spectrum key.
     * @param key Key code
     * @param isDown Indicates if the key is pressed down.
     */
    setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void {
        this.keyboardDevice.setStatus(key, isDown);
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
            this.keyboardDevice.setStatus(keyStroke.primaryCode, false);
            if (keyStroke.secondaryCode !== undefined) {
                this.keyboardDevice.setStatus(keyStroke.secondaryCode, false);
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
    }

    /**
     * Adds an emulated keypress to the queue of the provider.
     * @param startFrame Frame count to start the emulation
     * @param frames Number of frames to hold the emulation
     * @param primary Primary key code
     * @param secondary Optional secondary key code
     * 
     * The keyboard provider can play back emulated key strokes
     */
    queueKeystroke(
        startFrame: number, 
        frames: number, 
        primary: SpectrumKeyCode, 
        secondary?: SpectrumKeyCode): void
    {
        const startTact = startFrame * this.tactsInFrame * this.clockMultiplier;
        const endTact = startTact + frames * this.tactsInFrame * this.clockMultiplier;
        const keypress = new EmulatedKeyStroke(startTact, endTact, primary, secondary);
        if (this.emulatedKeyStrokes.length === 0) {
            this.emulatedKeyStrokes.push(keypress);
            return;
        }

        const last = this.emulatedKeyStrokes[0];
        if (last.primaryCode === keypress.primaryCode
            && last.secondaryCode === keypress.secondaryCode) {
            // --- The same key has been clicked
            if (keypress.startTact >= last.startTact && keypress.startTact <= last.endTact) {
                // --- Old and new click ranges overlap, lengthen the old click
                last.endTact = keypress.endTact;
                return;
            }
        }
        this.emulatedKeyStrokes.push(keypress);
    }

    /**
     * The machine's execution loop calls this method when it is about to initialize a new frame.
     * @param clockMultiplierChanged Indicates if the clock multiplier has been changed since the execution of the 
     * previous frame.
     */
    onInitNewFrame(clockMultiplierChanged: boolean): void {
        // --- No screen tact rendered in this frame
       this.lastRenderedFrameTact = 0;

        // --- Prepare the screen device for the new machine frame
        this.screenDevice.onNewFrame();

        // --- Handle audio sample recalculations when the actual clock frequency changes
        if (this.oldClockMultiplier !== this.clockMultiplier) {
            this.beeperDevice.setAudioSampleRate(AUDIO_SAMPLE_RATE);
            this.oldClockMultiplier = this.clockMultiplier;
        }

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
    onTactIncremented(increment: number): void {
        const machineTact = this.currentFrameTact;
        while (this.lastRenderedFrameTact <= machineTact) {
            this.screenDevice.renderTact(this.lastRenderedFrameTact++);
        }
        this.beeperDevice.setNextAudioSample();
    }
}