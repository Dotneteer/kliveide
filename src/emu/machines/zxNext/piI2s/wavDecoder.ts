/*
 * A WAV (RIFF/WAVE) decoder for the Pi I2S sample source (`.plans/PI_I2S_AUDIO_PLAN.md` §3): PCM at
 * 8, 16, 24 or 32 bits and IEEE float at 32 bits, any number of channels, any rate. Channels beyond
 * the second are ignored; a mono file plays on both sides. Compressed formats are out of scope.
 */

/** Why a file could not be decoded; the IDE turns it into text */
export type WavDecodeFailure = "notWav" | "noFormat" | "noData" | "unsupportedFormat" | "badRate";

export class WavDecodeError extends Error {
  constructor(readonly reason: WavDecodeFailure) {
    super(`WAV decode failed: ${reason}`);
  }
}

export type DecodedWav = {
  rate: number;
  /** The file's own channel count */
  channels: number;
  left: Int16Array;
  right: Int16Array;
};

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_IEEE_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

function tag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

/**
 * Decodes a WAV file into signed 16-bit samples per side
 * @throws WavDecodeError
 */
export function decodeWav(bytes: Uint8Array): DecodedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || tag(view, 0) !== "RIFF" || tag(view, 8) !== "WAVE") {
    throw new WavDecodeError("notWav");
  }

  let format: { code: number; channels: number; rate: number; bits: number; blockAlign: number } | undefined;
  let data: { offset: number; length: number } | undefined;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = tag(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && size >= 16 && body + 16 <= bytes.length) {
      let code = view.getUint16(body, true);
      // --- WAVE_FORMAT_EXTENSIBLE: the real format is the first two bytes of the sub-format GUID
      if (code === WAVE_FORMAT_EXTENSIBLE && size >= 40 && body + 26 <= bytes.length) {
        code = view.getUint16(body + 24, true);
      }
      format = {
        code,
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        blockAlign: view.getUint16(body + 12, true),
        bits: view.getUint16(body + 14, true)
      };
    } else if (id === "data") {
      // --- A truncated file keeps what it has
      data = { offset: body, length: Math.min(size, bytes.length - body) };
    }
    // --- Chunks are padded to an even size
    offset = body + size + (size & 1);
  }

  if (!format) throw new WavDecodeError("noFormat");
  if (!data) throw new WavDecodeError("noData");
  const { code, channels, rate, bits, blockAlign } = format;
  const isPcm = code === WAVE_FORMAT_PCM && (bits === 8 || bits === 16 || bits === 24 || bits === 32);
  const isFloat = code === WAVE_FORMAT_IEEE_FLOAT && bits === 32;
  if ((!isPcm && !isFloat) || channels < 1 || blockAlign < (channels * bits) / 8) {
    throw new WavDecodeError("unsupportedFormat");
  }
  if (rate < 1) throw new WavDecodeError("badRate");

  const count = Math.floor(data.length / blockAlign);
  const left = new Int16Array(count);
  const right = channels === 1 ? left : new Int16Array(count);
  const bytesPerSample = bits / 8;
  const read = (at: number): number => {
    if (isFloat) {
      const f = view.getFloat32(at, true);
      return Math.max(-32768, Math.min(32767, Math.round(f * 32767)));
    }
    switch (bits) {
      case 8:
        return (view.getUint8(at) - 128) << 8;
      case 16:
        return view.getInt16(at, true);
      case 24:
        return view.getInt16(at + 1, true);
      default:
        return view.getInt16(at + 2, true);
    }
  };
  for (let i = 0; i < count; i++) {
    const frame = data.offset + i * blockAlign;
    left[i] = read(frame);
    if (channels > 1) right[i] = read(frame + bytesPerSample);
  }
  return { rate, channels, left, right };
}
