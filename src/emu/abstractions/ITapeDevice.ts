import { IGenericDevice } from "./IGenericDevice";
import { IZxSpectrumMachine } from "./IZxSpectrumMachine";

/**
 * This interface defines the properties and operations of the ZX Spectrum's tape device.
 */
export interface ITapeDevice extends IGenericDevice<IZxSpectrumMachine> {
    /**
     * Get the current operation mode of the tape device.
     */
    tapeMode: TapeMode;

    /**
     * This method updates the current tape mode according to the current ROM index and PC value
     */
    updateTapeMode(): void;

    /**
     * This method returns the value of the EAR bit read from the tape.
     */
    getTapeEarBit(): boolean;

    /**
     * The current value of the MIC bit
     */
    micBit: boolean;
    
    /**
     * Process the specified MIC bit value.
     * @param micBit MIC bit to process
     */
    processMicBit(micBit: boolean): void;
}

/**
 * This enum indicates the current mode of the tape device.
 */
export enum TapeMode {
    /**
     * The tape device is passive.
     */
    Passive,

    /**
     * The tape device is in LOAD mode, affecting the read operation of the EAR bit.
     */
    Load,

    /**
     * The tape device is in SAVE mode, affecting the write operation of the MIC bit.
     */
    Save
}
