/*
 * What the IDE and the emulator exchange about the ZX Spectrum Next's Raspberry Pi I2S input
 * (`.plans/PI_I2S_AUDIO_PLAN.md` §3, §4).
 */

/** Which side(s) of the link a tone plays on */
export type PiI2sToneChannels = "both" | "left" | "right";

/** The sample source to put in the Pi's place on the I2S link */
export type PiI2sSourceSpec =
  | { kind: "off" }
  | { kind: "tone"; frequency: number; level: number; channels: PiI2sToneChannels }
  | { kind: "wav"; name: string; contents: Uint8Array };

/** The Pi I2S stream as the IDE shows it */
export type PiI2sStatus = {
  /** The source's name; undefined for a stream restored from a state without its source */
  name?: string;
  rate: number;
  /** The sample the receiver latches next */
  position: number;
  /** Samples in the source; undefined when endless */
  length?: number;
  /** No more samples will come; the receiver holds its last words */
  ended: boolean;
};
