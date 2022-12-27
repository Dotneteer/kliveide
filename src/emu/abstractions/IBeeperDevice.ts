import { IAudioDevice } from "./IAudioDevice";

/**
 * This interface defines the properties and operations of the ZX Spectrum's beeper device.
 */
export interface IBeeperDevice extends IAudioDevice {
    /**
     * The current value of the EAR bit
     */
    earBit: boolean;
    
    /**
     * This method sets the EAR bit value to generate sound with the beeper.
     * @param value EAR bit value to set
     */
    setEarBit(value: boolean): void;
}
