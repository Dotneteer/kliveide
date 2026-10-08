import { describe, expect, it } from "vitest";
import {
  ByteReader,
  ByteWriter,
  decodeJournal,
  encodeJournal,
  hasDebugRecordingMagic,
  isDebugRecordingPath,
  readDebugRecording,
  sha256,
  writeDebugRecording,
  type DebugRecording
} from "@common/debugRecording/debugRecordingFile";
import { concatBytes, encodeSection } from "@common/machineState/chunkedContainer";

/* `.plans/DEBUG_SESSION_RECORDING_PLAN.md` Phase 1: the `.klr` format, without a machine */

const PAGE = 4096;
const MEMORY = 5 * PAGE + 100;

function page(seed: number): Uint8Array {
  const p = new Uint8Array(PAGE);
  for (let i = 0; i < PAGE; i++) p[i] = (i * seed + seed) & 0xff;
  return p;
}

function recording(): DebugRecording {
  const pageCount = Math.ceil(MEMORY / PAGE);
  const newest = new Uint8Array(64).map((_, i) => i * 3);
  return {
    header: {
      machineId: "sp48",
      machineName: "ZX Spectrum 48K",
      kliveVersion: "0.64.0",
      coreId: "sp48",
      fingerprint: "f".repeat(32),
      codeHash: "c".repeat(64),
      contractHash: "a".repeat(64),
      memorySize: MEMORY,
      pageSize: PAGE,
      savedAt: "2026-10-08T12:00:00.000Z",
      base: { sequence: 10, sub: 1, phase: 0 },
      present: { sequence: 2 ** 40 + 5, sub: 3, phase: 2 },
      cursor: { sequence: 2 ** 40, sub: 1, phase: 0 },
      frames: 120.5,
      seconds: 2.41,
      records: 2 ** 40 - 5,
      keyframes: 2,
      sparse: false,
      pc: 0x8000
    },
    thumbnail: { width: 2, height: 2, rgba: new Uint8Array(16).fill(7) },
    pages: [page(1), page(2), page(3)],
    keyframes: [
      {
        seed: { position: { sequence: 10, sub: 1, phase: 0 }, newest },
        frame: 100,
        journalIndex: 0,
        complete: false,
        pages: Int32Array.from({ length: pageCount }, (_, i) => (i < 2 ? i : -1)),
        meta: { host: { normalFrames: 3 }, debug: { hits: [["$8000", 2]], oneShots: [] }, hitLogIndex: 0 }
      },
      {
        seed: { position: { sequence: 2 ** 40, sub: 7, phase: 1 } },
        frame: 120.25,
        journalIndex: 3,
        complete: true,
        pages: Int32Array.from({ length: pageCount }, (_, i) => (i === 0 ? 2 : i < 2 ? 1 : -1)),
        meta: { host: {}, hitLogIndex: 1 }
      }
    ],
    journal: [
      { kind: "call", position: { sequence: 11, sub: 1, phase: 0 }, exportName: "sp48SetKeyStatus", args: [3, 1] },
      { kind: "call", position: { sequence: 12, sub: 1, phase: 1 }, exportName: "sp48SetVolume", args: [-7, 0.25, 2 ** 53 + 2] },
      { kind: "write", position: { sequence: 13, sub: 2, phase: 0 }, address: 0x1234, length: 3, bytes: Uint8Array.from([9, 8, 7]) },
      { kind: "write", position: { sequence: 2 ** 40 + 1, sub: 1, phase: 0 }, address: 0x5000, length: 512, fill: 0xe5 },
      { kind: "call", position: { sequence: 2 ** 40 + 2, sub: 1, phase: 0 }, exportName: "sp48SetKeyStatus", args: [] }
    ],
    hits: [
      { position: { sequence: 12, sub: 1, phase: 0 }, key: "$8000" },
      { position: { sequence: 2 ** 40 + 3, sub: 1, phase: 0 }, key: "$8003:W" }
    ],
    ring: {
      view: { count: 2, writeIndex: 2, newestLo: 5, newestHi: 256, generation: 9 },
      records: new Uint8Array(128).map((_, i) => i)
    },
    present: { host: { normalFrames: 7 }, debug: { hits: [], oneShots: [] }, frames: 120.5 },
    breakpoints: { schemaVersion: 1, breakpoints: [{ address: 0x8000, exec: true }], watches: [{ expression: "hl" }] },
    media: [{ id: "tape", fileName: "game.tap", kind: "tape" }],
    sources: {
      compiler: "Klive Z80 Assembler",
      mainFile: "code/main.kz80.asm",
      files: [
        { path: "code/main.kz80.asm", sha256: "1".repeat(64), text: "  ld a,1\n" },
        { path: "code/lib.asm", sha256: "2".repeat(64) }
      ]
    },
    kls: Uint8Array.from([0x4b, 0x4c, 1, 2]),
    note: "Crashes after the second level — ünïcode too"
  };
}

describe("debug recording file (Phase 1)", () => {
  it("round-trips every section", async () => {
    const original = recording();
    const bytes = await writeDebugRecording(original);
    expect(hasDebugRecordingMagic(bytes)).toBe(true);
    const read = await readDebugRecording(bytes);
    expect(read.header).toEqual(original.header);
    expect(read.thumbnail).toEqual(original.thumbnail);
    expect(read.pages).toEqual(original.pages);
    expect(read.keyframes).toEqual(original.keyframes);
    expect(read.journal).toEqual(original.journal);
    expect(read.hits).toEqual(original.hits);
    expect(read.ring).toEqual(original.ring);
    expect(read.present).toEqual(original.present);
    expect(read.breakpoints).toEqual(original.breakpoints);
    expect(read.media).toEqual(original.media);
    expect(read.sources).toEqual(original.sources);
    expect(read.kls).toEqual(original.kls);
    expect(read.note).toBe(original.note);
    expect(read.unknownSections).toEqual([]);
    expect(Object.keys(read.sectionSizes)).toEqual([
      "THMB", "PAGE", "KEYF", "JRNL", "HITS", "RING", "PRES", "BRKP", "MEDI", "SRCS", "KLS", "NOTE", "END"
    ]);
  });

  it("reads the header alone without the timeline (the viewer)", async () => {
    const read = await readDebugRecording(await writeDebugRecording(recording()), { headerOnly: true });
    expect(read.header.present.sequence).toBe(2 ** 40 + 5);
    expect(read.note).toMatch(/second level/);
    expect(read.pages).toEqual([]);
    expect(read.keyframes).toEqual([]);
    expect(read.sources?.files[0].text).toBe("  ld a,1\n");
  });

  it("is the same bytes for the same recording", async () => {
    expect(await writeDebugRecording(recording())).toEqual(await writeDebugRecording(recording()));
  });

  it("refuses another kind of file and a truncated one", async () => {
    await expect(readDebugRecording(new TextEncoder().encode("KLIVESTA...."))).rejects.toThrow(/KLIVEREC header is missing/);
    const bytes = await writeDebugRecording(recording());
    await expect(readDebugRecording(bytes.subarray(0, bytes.length - 10))).rejects.toThrow(/truncated/);
    // --- Cut at a section boundary: the END section is gone
    const endAt = bytes.length - 8 - 32;
    await expect(readDebugRecording(bytes.subarray(0, endAt))).rejects.toThrow(/no END section/);
  });

  it("refuses a file whose contents do not match its END hash", async () => {
    const bytes = await writeDebugRecording(recording());
    const edited = bytes.slice();
    edited[200] ^= 0xff;
    await expect(readDebugRecording(edited)).rejects.toThrow(/damaged/);
  });

  it("catches an edit only by replay when the END hash was recomputed (the format cannot)", async () => {
    // --- A flipped journal byte with a recomputed hash reads fine: D9's replay checks catch it (Phase 2)
    const original = recording();
    const bytes = await writeDebugRecording(original);
    const body = bytes.subarray(0, bytes.length - 8 - 32);
    const forged = concatBytes([body, encodeSection("END ", await sha256(body))]);
    expect((await readDebugRecording(forged)).journal).toEqual(original.journal);
  });

  it("refuses a keyframe that refers to a page the file does not hold", async () => {
    const r = recording();
    r.keyframes[1].pages[0] = 3;
    await expect(readDebugRecording(await writeDebugRecording(r))).rejects.toThrow(/does not hold/);
  });

  it("stores positions as u64 and refuses one beyond 2^53 (T3)", () => {
    const w = new ByteWriter();
    w.position({ sequence: Number.MAX_SAFE_INTEGER, sub: 300, phase: 2 });
    expect(new ByteReader(w.toBytes(), "test").position()).toEqual({ sequence: Number.MAX_SAFE_INTEGER, sub: 300, phase: 2 });
    expect(() => w.u64(2 ** 53)).toThrow(/Not a position/);
    const raw = new ByteWriter();
    raw.u32(0);
    raw.u32(0x0020_0000); // --- 2^53
    expect(() => new ByteReader(raw.toBytes(), "test").u64()).toThrow(/beyond 2\^53/);
  });

  it("names each export once in the journal (T2)", () => {
    const entries = recording().journal;
    const bytes = encodeJournal(entries);
    const text = new TextDecoder().decode(bytes);
    expect(text.split("sp48SetKeyStatus").length - 1).toBe(1);
    expect(decodeJournal(bytes)).toEqual(entries);
  });

  it("recognises the extension", () => {
    expect(isDebugRecordingPath("bug.klr")).toBe(true);
    expect(isDebugRecordingPath(" a/B.KLR ")).toBe(true);
    expect(isDebugRecordingPath("bug.kls")).toBe(false);
  });
});
