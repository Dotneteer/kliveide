import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { IGenericDevice } from "./IGenericDevice";

/**
 * This interface represents anaudio device that creates sound samples according to a particular sample rate.
 */
export interface IAudioDevice<T extends IZ80Machine> extends IGenericDevice<T> {
    /**
     * Gets the audio sample rate
     */
    getAudioSampleRate(): number;
    
    /**
     * Sets up the sample rate to use with this device
     * @param sampleRate Audio sample rate
     */
    setAudioSampleRate(sampleRate: number): void;

    /**
     * Gets the audio samples rendered in the current frame
     */
    getAudioSamples(): number[];

    /**
     * This method signs that a new machine frame has been started
     */
    onNewFrame(): void;

    /**
     * Renders the subsequent beeper sample according to the current EAR bit value
     */
    setNextAudioSample(): void;

    /**
     * Calculates the current audio value according to the CPU's clock
     */
    calculateCurrentAudioValue(): void;
}
