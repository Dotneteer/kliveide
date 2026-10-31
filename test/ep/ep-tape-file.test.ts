import { describe, expect, it } from "vitest";

import {
  EP_SAVE_UNIT_TACTS,
  EP_TAPE_FAST,
  EpTapeFileError,
  EpTapeRecorder,
  buildEp128emuTap,
  buildEpTapeProgram,
  buildEpteFile,
  decodeEpChunkRun,
  epFileChunks,
  epSavedFilesOf,
  epTapeCrc,
  epTapeProgramTacts,
  isEpTapeFileName,
  parseEpChunk,
  parseEpTapeFile
} from "@emu/machines/enterprise/EpTapeFile";

/*
 * Enterprise tape files (`EpTapeFile.ts`, `.plans/ENTERPRISE_PLAN.md` §9.3): the CRC, the chunks, the
 * three formats read, the two written, and the SAVE recording's decoder. `test/ep-hw/tape.test.ts` runs
 * them against EXOS itself.
 */

/** A BASIC-like module: 00h, 04h and some bytes */
const MODULE = Uint8Array.from([0x00, 0x04, ...Array.from({ length: 300 }, (_, i) => i & 0xff)]);

/** A recording of chunks as the core writes it: half-periods in 16 T units, 0 after each chunk */
function recordingOf(chunks: Uint8Array[]): Uint8Array {
  const units: number[] = [];
  const unit = (tacts: number) => Math.round(tacts / EP_SAVE_UNIT_TACTS);
  const cycle = (half: number) => units.push(unit(half), unit(half));
  for (const chunk of chunks) {
    for (let i = 0; i < 2000; i++) cycle(EP_TAPE_FAST.leader);
    cycle(EP_TAPE_FAST.sync);
    for (const byte of [0x00, 0x6a, ...chunk]) {
      for (let b = 0; b < 8; b++) cycle((byte >> b) & 1 ? EP_TAPE_FAST.one : EP_TAPE_FAST.zero);
    }
    for (let i = 0; i < 50; i++) cycle(EP_TAPE_FAST.leader);
    units.push(0);
  }
  return Uint8Array.from(units);
}

describe("Enterprise tape files", () => {
  it("computes EXOS's CRC as EXOS 2.1 wrote it for a header", () => {
    // --- Observed: SAVE "TAPE:TEST" wrote FF 04 'TEST' with CRC A5h ACh
    expect(epTapeCrc([0xff, 0x04, 0x54, 0x45, 0x53, 0x54])).toBe(0xaca5);
  });

  it("splits a file into a header chunk and 4 KB data chunks, the last one shorter", () => {
    const chunks = epFileChunks("NAME", new Uint8Array(8192));
    expect(chunks.length).toBe(4);
    const header = parseEpChunk(chunks[0])!;
    expect(header.header).toBe(true);
    expect(Array.from(header.blocks[0])).toEqual([0xff, 4, 0x4e, 0x41, 0x4d, 0x45]);
    expect(chunks.slice(1).map((c) => c[0])).toEqual([16, 16, 0]);
    expect(chunks.every((c) => parseEpChunk(c)!.crcOk)).toBe(true);
  });

  it("reads an EPTE tape Klive wrote, with or without 00h 6Ah before each chunk", () => {
    const chunks = epFileChunks("GAME", MODULE);
    const tape = parseEpTapeFile(buildEpteFile(chunks));
    expect(tape.format).toBe("epte");
    expect(tape.chunks!.map((c) => Array.from(c.bytes))).toEqual(chunks.map((c) => Array.from(c)));
    expect(tape.moduleType).toBe(4);
    const prefixed = buildEpteFile(chunks.map((c) => Uint8Array.from([0x00, 0x6a, ...c])));
    expect(parseEpTapeFile(prefixed).chunks!.length).toBe(2);
  });

  it("keeps an EPTE tape's CRC errors", () => {
    const epte = buildEpteFile(epFileChunks("GAME", MODULE));
    epte[512 + 10 + 20] ^= 1;
    const chunks = parseEpTapeFile(epte).chunks!;
    expect(parseEpChunk(chunks[1].bytes)!.crcOk).toBe(false);
  });

  it("writes an ep128emu native tape and reads it back as the same signal", () => {
    const chunks = epFileChunks("GAME", MODULE);
    const tap = buildEp128emuTap(chunks);
    expect(Array.from(tap.subarray(0, 16))).toEqual([0x02, 0x75, 0xcd, 0x72, 0x1c, 0x44, 0x51, 0x26, 0, 0, 0, 1, 0, 0, 0x5d, 0xc0]);
    expect((tap.length - 4096) % 512).toBe(0);
    const tape = parseEpTapeFile(tap);
    expect(tape.format).toBe("ep128emu");
    expect(tape.moduleType).toBe(4);
    // --- About 2.5 s and 2 s of leader, the chunks and the pauses
    const seconds = epTapeProgramTacts(tape.program) / 4_000_000;
    expect(seconds).toBeGreaterThan(5);
    expect(seconds).toBeLessThan(8);
  });

  it("reads a WAV file's zero crossings", () => {
    // --- 8-bit mono at 48 kHz: the native tape's 24 kHz samples, each twice, as +-100
    const tap = buildEp128emuTap(epFileChunks("W", MODULE));
    const samples: number[] = [];
    for (let i = 4096; i < tap.length; i++) {
      for (let b = 7; b >= 0; b--) {
        const v = (tap[i] >> b) & 1 ? 228 : 28;
        samples.push(v, v);
      }
    }
    const wav = new Uint8Array(44 + samples.length);
    const view = new DataView(wav.buffer);
    wav.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
    view.setUint32(4, 36 + samples.length, true);
    wav.set([..."WAVEfmt "].map((c) => c.charCodeAt(0)), 8);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 48000, true);
    view.setUint32(28, 48000, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    wav.set([..."data"].map((c) => c.charCodeAt(0)), 36);
    view.setUint32(40, samples.length, true);
    wav.set(samples, 44);
    const tape = parseEpTapeFile(wav);
    expect(tape.format).toBe("wav");
    expect(tape.moduleType).toBe(4);
  });

  it("refuses anything else", () => {
    expect(() => parseEpTapeFile(new Uint8Array(1000))).toThrow(EpTapeFileError);
    expect(isEpTapeFileName("game.TAP")).toBe(true);
    expect(isEpTapeFileName("game.cas")).toBe(false);
  });

  it("builds a tape program of EXOS's fast timings", () => {
    const program = buildEpTapeProgram(epFileChunks("X", new Uint8Array(10)));
    // --- Silence, the leader as one run of halves, the sync's two halves, then bytes
    expect(program[0] >>> 30).toBe(0);
    expect(program[1] >>> 30).toBe(1);
    expect((program[1] >>> 16) & 0x3fff).toBe(EP_TAPE_FAST.leader);
    expect(program[2]).toBe((0x4000_0000 | (EP_TAPE_FAST.sync << 16) | 2) >>> 0);
    expect(program[3]).toBe(0x8000_0000);
    expect(program[4]).toBe(0x8000_006a);
  });

  it("decodes a recording into whole files and checks every CRC", () => {
    const chunks = epFileChunks("SAVED", new Uint8Array(5000).map((_, i) => i * 7));
    const recording = recordingOf(chunks);
    const decoded = decodeEpChunkRun(recording.subarray(0, recording.indexOf(0)));
    expect(decoded?.header).toBe(true);
    const recorder = new EpTapeRecorder();
    const ring = new Uint8Array(1 << 20);
    ring.set(recording);
    // --- Fed in two parts: nothing before the last chunk
    expect(recorder.feed(ring, recording.length - 100)).toEqual([]);
    const [file] = recorder.feed(ring, recording.length);
    expect(file.name).toBe("SAVED");
    expect(file.protect).toBe(0xff);
    expect(Array.from(file.payload)).toEqual(Array.from(new Uint8Array(5000).map((_, i) => i * 7)));
    expect(parseEpTapeFile(file.tap).format).toBe("ep128emu");
  });

  it("leaves out a file with a CRC error", () => {
    const chunks = epFileChunks("BAD", MODULE);
    chunks[1][10] ^= 0x40;
    const recording = recordingOf(chunks);
    const runs: Uint8Array[] = [];
    for (let at = 0; at < recording.length; ) {
      const end = recording.indexOf(0, at);
      runs.push(recording.subarray(at, end));
      at = end + 1;
    }
    const decoded = runs.map((r) => decodeEpChunkRun(r));
    expect(decoded[1]?.crcOk).toBe(false);
    expect(epSavedFilesOf(decoded).files).toEqual([]);
  });
});
