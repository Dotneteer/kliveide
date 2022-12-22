// --- Pilot pulse length
export const PILOT_PL = 2168;

// --- Pilot pulses in the ROM header block
export const HEADER_PILOT_COUNT = 8063;

// --- Pilot pulses in the ROM data block
export const DATA_PILOT_COUNT = 3223;

/// --- Sync 1 pulse length
export const SYNC_1_PL = 667;

// --- Sync 2 pulse lenth
export const SYNC_2_PL = 735;

// --- Bit 0 pulse length
export const BIT_0_PL = 855;

// --- Bit 1 pulse length
export const BIT_1_PL = 1710;

// --- End sync pulse length
export const TERM_SYNC = 947;

// --- 1 millisecond pause
export const PAUSE_MS = 1000;

/**
 * Represents the playing phase of the current block
 */
export enum PlayPhase {
    /**
     * The player is passive
     */
    None = 0,

    /**
     * Pilot signals
     */
    Pilot,

    /**
     * Sync signals at the end of the pilot
     */
    Sync,

    /**
     * Bits in the data block
     */
    Data,

    /**
     * Short terminating sync signal before pause
     */
    TermSync,

    /**
     * Pause after the data block
     */
    Pause,

    /**
     * The entire block has been played back
     */
    Completed
}

/**
 * This enum defines the MIC pulse types according to their widths
 */
export enum MicPulseType {
    /**
     * No pulse information
     */
    None = 0,

    /**
     * Too short to be a valid pulse
     */
    TooShort,

    /**
     * Too long to be a valid pulse
     */
    TooLong,

    /**
     * PILOT pulse (Length: 2168 tacts)
     */
    Pilot,

    /**
     * SYNC1 pulse (Length: 667 tacts)
     */
    Sync1,

    /**
     * SYNC2 pulse (Length: 735 tacts)
     */
    Sync2,

    /**
     * BIT0 pulse (Length: 855 tacts)
     */
    Bit0,

    /**
     * BIT1 pulse (Length: 1710 tacts)
     */
    Bit1,

    /**
     * TERM_SYNC pulse (Length: 947 tacts)
     */
    TermSync
}


/**
 * This enumeration defines the phases of the SAVE operation
 */
export enum SavePhase {
    /**
     * No SAVE operation is in progress
     */
    None = 0,

    /**
     * Emitting PILOT impulses
     */
    Pilot,

    /**
     * Emitting SYNC1 impulse
     */
    Sync1,

    /**
     * Emitting SYNC2 impulse
     */
    Sync2,

    /**
     * Emitting BIT0/BIT1 impulses
     */
    Data,

    /**
     * Unexpected pulse detected
     */
    Error
}

/**
 * This class represents a data block that the tape device can play
 */
export class TapeDataBlock {
    /**
     * Block Data
     */
    data = new Uint8Array(0);

    /**
     * Pause after this block (given in milliseconds)
     */
    pauseAfter = 1000;

    /**
     * Length of pilot pulse
     */
    pilotPulseLength = PILOT_PL;

    /**
     * Length of the first sync pulse
     */
    sync1PulseLength = SYNC_1_PL;

    /**
     * Length of the second sync pulse
     */
    sync2PulseLength = SYNC_2_PL;

    /**
     * Length of the zero bit
     */
    zeroBitPulseLength = BIT_0_PL;

    /**
     * Length of the one bit
     */
    oneBitPulseLength = BIT_1_PL;

    /**
     * Lenght of ther end sync pulse
     */
    endSyncPulseLenght = TERM_SYNC;
}
