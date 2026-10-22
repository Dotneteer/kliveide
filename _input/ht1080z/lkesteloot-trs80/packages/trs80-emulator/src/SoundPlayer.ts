
export interface SoundPlayer {
    /**
     * Sets the specific audio value, for sound output.
     * @param leftValue left channel value in the range -1 to 1.
     * @param rightValue right channel value in the range -1 to 1.
     * @param tStateCount the computer current t-state count.
     * @param clockHz the computer's current clock speed.
     */
    setAudioValue(leftValue: number, rightValue: number, tStateCount: number, clockHz: number): void;

    /**
     * Specify whether the motor is on right now. Motors are on for all drives at the same time.
     */
    setFloppyMotorOn(motorOn: boolean): void;

    /**
     * Specify that we've just moved this many tracks.
     */
    trackMoved(moveCount: number): void;
}

/**
 * Interface for an object that can be muted.
 */
export interface Mutable {
    mute(): void;
    unmute(): void;
    isMuted(): boolean;
}

/**
 * A sound player that does nothing.
 */
export class SilentSoundPlayer implements SoundPlayer, Mutable {
    setAudioValue(leftValue: number, rightValue: number, tStateCount: number, clockHz: number): void {
        // Nothing.
    }

    setFloppyMotorOn(motorOn: boolean): void {
        // Nothing.
    }

    trackMoved(moveCount: number): void {
        // Nothing.
    }

    isMuted(): boolean {
        return false;
    }

    mute(): void {
        // Nothing.
    }

    unmute(): void {
        // Nothing.
    }
}
