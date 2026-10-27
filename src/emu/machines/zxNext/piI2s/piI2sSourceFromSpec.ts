import type { PiI2sSourceSpec } from "@common/zxnext/piI2s";
import { PcmPiI2sSource, TonePiI2sSource, type PiI2sSource } from "./PiI2sSource";
import { decodeWav } from "./wavDecoder";

/**
 * The source an IDE request describes (`.plans/PI_I2S_AUDIO_PLAN.md` §4); undefined for "off"
 * @throws WavDecodeError for a WAV file that cannot be decoded
 */
export function piI2sSourceFromSpec(spec: PiI2sSourceSpec): PiI2sSource | undefined {
  switch (spec.kind) {
    case "off":
      return undefined;
    case "tone":
      return new TonePiI2sSource(spec.frequency, spec.level, spec.channels);
    case "wav": {
      const wav = decodeWav(spec.contents);
      return new PcmPiI2sSource(spec.name, wav.rate, wav.left, wav.right);
    }
  }
}
