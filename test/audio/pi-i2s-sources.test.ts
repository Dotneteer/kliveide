import { describe, expect, it } from "vitest";

import { PcmPiI2sSource, SilencePiI2sSource, TonePiI2sSource } from "@emu/machines/zxNext/piI2s/PiI2sSource";
import { decodeWav, WavDecodeError } from "@emu/machines/zxNext/piI2s/wavDecoder";

/*
 * The Pi I2S sample sources and the WAV decoder (`.plans/PI_I2S_AUDIO_PLAN.md` §3). The machine side is
 * `test/zxnext-hw/audio/pi-i2s.test.ts`.
 */

/** A RIFF/WAVE file from a format chunk and raw data */
function wav(opts: { code?: number; channels: number; rate: number; bits: number; data: number[]; extensible?: boolean; extra?: boolean }): Uint8Array {
  const { code = 1, channels, rate, bits, data, extensible = false, extra = false } = opts;
  const fmtSize = extensible ? 40 : 16;
  const chunks: number[] = [];
  const u16 = (v: number) => chunks.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (v: number) => chunks.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  const str = (s: string) => [...s].forEach((c) => chunks.push(c.charCodeAt(0)));
  str("RIFF");
  u32(0);
  str("WAVE");
  if (extra) {
    // --- An unknown chunk of odd size: skipped, with its pad byte
    str("LIST");
    u32(3);
    chunks.push(1, 2, 3, 0);
  }
  str("fmt ");
  u32(fmtSize);
  u16(extensible ? 0xfffe : code);
  u16(channels);
  u32(rate);
  const blockAlign = (channels * bits) / 8;
  u32(rate * blockAlign);
  u16(blockAlign);
  u16(bits);
  if (extensible) {
    u16(22);
    u16(bits);
    u32(0);
    u16(code);
    for (let i = 0; i < 14; i++) chunks.push(0);
  }
  str("data");
  u32(data.length);
  chunks.push(...data);
  return new Uint8Array(chunks);
}

describe("decodeWav", () => {
  it("decodes 16-bit stereo PCM", () => {
    // --- (1000, -1000), (32767, -32768)
    const d = decodeWav(wav({ channels: 2, rate: 22050, bits: 16, data: [0xe8, 0x03, 0x18, 0xfc, 0xff, 0x7f, 0x00, 0x80] }));
    expect(d.rate).toBe(22050);
    expect(d.channels).toBe(2);
    expect([...d.left]).toEqual([1000, 32767]);
    expect([...d.right]).toEqual([-1000, -32768]);
  });

  it("plays a mono file on both sides", () => {
    const d = decodeWav(wav({ channels: 1, rate: 8000, bits: 16, data: [0x10, 0x00, 0xf0, 0xff] }));
    expect([...d.left]).toEqual([16, -16]);
    expect(d.right).toBe(d.left);
  });

  it("decodes 8-bit (unsigned), 24-bit, 32-bit and float samples to 16 bits", () => {
    expect([...decodeWav(wav({ channels: 1, rate: 8000, bits: 8, data: [0x80, 0xff, 0x00] })).left]).toEqual([0, 0x7f00, -0x8000]);
    expect([...decodeWav(wav({ channels: 1, rate: 8000, bits: 24, data: [0x55, 0x34, 0x12] })).left]).toEqual([0x1234]);
    expect([...decodeWav(wav({ channels: 1, rate: 8000, bits: 32, data: [0, 0, 0x34, 0x12] })).left]).toEqual([0x1234]);
    const half = new Uint8Array(new Float32Array([0.5, -1]).buffer);
    expect([...decodeWav(wav({ code: 3, channels: 1, rate: 8000, bits: 32, data: [...half] })).left]).toEqual([16384, -32767]);
  });

  it("reads WAVE_FORMAT_EXTENSIBLE and skips unknown chunks", () => {
    const d = decodeWav(wav({ channels: 2, rate: 48000, bits: 16, data: [1, 0, 2, 0], extensible: true, extra: true }));
    expect([d.rate, d.left[0], d.right[0]]).toEqual([48000, 1, 2]);
  });

  it("says why a file cannot be decoded", () => {
    const reason = (bytes: Uint8Array) => {
      try {
        decodeWav(bytes);
        return "decoded";
      } catch (e) {
        return e instanceof WavDecodeError ? e.reason : String(e);
      }
    };
    expect(reason(new Uint8Array([1, 2, 3]))).toBe("notWav");
    expect(reason(wav({ code: 2, channels: 1, rate: 8000, bits: 4, data: [] }))).toBe("unsupportedFormat");
    const noData = wav({ channels: 1, rate: 8000, bits: 16, data: [] }).slice(0, 36);
    expect(reason(noData)).toBe("noData");
  });
});

describe("Pi I2S sources", () => {
  it("are pure functions of the sample index", () => {
    const tone = new TonePiI2sSource(441, 1, "both", 44100);
    const a = new Int16Array(200);
    const b = new Int16Array(200);
    tone.fill(1000, 100, a);
    tone.fill(990, 10, b);
    tone.fill(1000, 100, b);
    expect([...b]).toEqual([...a]);
    // --- 441 Hz at 44.1 kHz: a period of 100 samples
    const c = new Int16Array(200);
    tone.fill(1100, 100, c);
    expect([...c]).toEqual([...a]);
  });

  it("a tone plays on the sides it is given", () => {
    const out = new Int16Array(20);
    new TonePiI2sSource(1000, 0.5, "left").fill(1, 10, out);
    expect(out.filter((_, i) => i % 2 === 1).every((v) => v === 0)).toBe(true);
    expect(out.filter((_, i) => i % 2 === 0).some((v) => v !== 0)).toBe(true);
    expect(Math.max(...out)).toBeLessThanOrEqual(16384);
  });

  it("PCM ends at its length; silence never does", () => {
    const pcm = new PcmPiI2sSource("x", 8000, new Int16Array([1, 2, 3]), new Int16Array([4, 5, 6]));
    const out = new Int16Array(10);
    expect(pcm.fill(1, 5, out)).toBe(2);
    expect([...out.slice(0, 4)]).toEqual([2, 5, 3, 6]);
    expect(pcm.fill(3, 5, out)).toBe(0);
    expect(new SilencePiI2sSource().fill(1e9, 5, out.fill(7))).toBe(5);
    expect([...out]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
});
