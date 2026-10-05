/*
 * The RZX format layer (`.plans/RZX_PLAN.md` Phase 1): reader, writer, segments and finalising.
 * Every fixture is built by the tests themselves; no third-party file is used.
 */

import { describe, expect, it } from "vitest";
import { zlibSync } from "fflate";
import { parseRzxFile, hasRzxSignature } from "@common/spectrum/rzx/rzxFile";
import { writeRzxFile, encodeFrames } from "@common/spectrum/rzx/rzxWriter";
import { rzxSegments, rzxFrameCount, formatRzxDuration } from "@common/spectrum/rzx/rzxSegments";
import { finaliseRzxFile } from "@common/spectrum/rzx/rzxFinalise";
import { RzxError, type RzxFile, type RzxFrame } from "@common/spectrum/rzx/rzxModel";

// --- A tiny little-endian builder for hand-made files
class B {
  bytes: number[] = [];
  byte(...v: number[]) {
    this.bytes.push(...v.map((x) => x & 0xff));
    return this;
  }
  word(v: number) {
    return this.byte(v, v >> 8);
  }
  dword(v: number) {
    return this.byte(v, v >> 8, v >> 16, v >>> 24);
  }
  str(text: string, size: number) {
    for (let i = 0; i < size; i++) this.byte(i < text.length ? text.charCodeAt(i) : 0);
    return this;
  }
  raw(data: ArrayLike<number>) {
    for (let i = 0; i < data.length; i++) this.bytes.push(data[i]);
    return this;
  }
  get u8() {
    return Uint8Array.from(this.bytes);
  }
}

function header(flags = 0) {
  return new B().str("RZX!", 4).byte(0, 13).dword(flags);
}

function creatorBlock(b: B, name = "Test", major = 1, minor = 2, custom: number[] = []) {
  return b.byte(0x10).dword(29 + custom.length).str(name, 20).word(major).word(minor).raw(custom);
}

const SNAP = Uint8Array.from({ length: 64 }, (_, i) => i * 3);

function snapshotBlock(b: B, opts: { compressed?: boolean; external?: boolean; ext?: string } = {}) {
  const data = opts.compressed ? zlibSync(SNAP) : SNAP;
  const flags = (opts.external ? 1 : 0) | (opts.compressed ? 2 : 0);
  return b.byte(0x30).dword(17 + data.length).dword(flags).str(opts.ext ?? "z80", 4).dword(SNAP.length).raw(data);
}

function frameBytes(frames: Array<[number, number[] | "repeat"]>) {
  const b = new B();
  for (const [fetch, ins] of frames) {
    b.word(fetch);
    if (ins === "repeat") b.word(0xffff);
    else b.word(ins.length).raw(ins);
  }
  return b.u8;
}

function inputBlock(
  b: B,
  frames: Array<[number, number[] | "repeat"]>,
  opts: { compressed?: boolean; protected?: boolean; tstates?: number; extra?: number[] } = {}
) {
  let data = frameBytes(frames);
  if (opts.extra) data = Uint8Array.from([...data, ...opts.extra]);
  if (opts.compressed) data = zlibSync(data);
  const flags = (opts.protected ? 1 : 0) | (opts.compressed ? 2 : 0);
  return b
    .byte(0x80)
    .dword(18 + data.length)
    .dword(frames.length)
    .byte(0)
    .dword(opts.tstates ?? 1234)
    .dword(flags)
    .raw(data);
}

const sampleFrames: Array<[number, number[] | "repeat"]> = [
  [1000, [0xbf, 0xff]],
  [2000, "repeat"],
  [3, []],
  [17000, [0x1f]],
  [17001, "repeat"]
];

function expectFrames(frames: RzxFrame[]) {
  expect(frames.map((f) => f.fetchCount)).toEqual([1000, 2000, 3, 17000, 17001]);
  expect(frames.map((f) => Array.from(f.ins))).toEqual([[0xbf, 0xff], [0xbf, 0xff], [], [0x1f], [0x1f]]);
}

describe("RZX reader", () => {
  it("recognises the signature", () => {
    expect(hasRzxSignature(header().u8)).toBe(true);
    expect(hasRzxSignature(Uint8Array.from([1, 2, 3, 4]))).toBe(false);
    expect(() => parseRzxFile(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toThrow(RzxError);
  });

  it("reads an uncompressed input block, expanding repeats", () => {
    const b = header();
    creatorBlock(b, "Fuse", 1, 10, [9, 8]);
    snapshotBlock(b, { ext: "Z80" });
    inputBlock(b, sampleFrames, { tstates: 4321 });
    const file = parseRzxFile(b.u8);
    expect(file.major).toBe(0);
    expect(file.minor).toBe(13);
    expect(file.creator).toEqual({ name: "Fuse", major: 1, minor: 10, custom: Uint8Array.from([9, 8]) });
    const snap = file.blocks.find((x) => x.kind === "snapshot")!;
    expect(snap).toMatchObject({ extension: "z80", compressed: false });
    expect(Array.from((snap as any).bytes)).toEqual(Array.from(SNAP));
    const input = file.blocks.find((x) => x.kind === "input") as any;
    expect(input.tstates).toBe(4321);
    expect(input.compressed).toBe(false);
    expectFrames(input.frames);
    expect(file.notes).toEqual([]);
  });

  it("reads compressed snapshot and input blocks", () => {
    const b = header();
    snapshotBlock(b, { compressed: true, ext: "szx" });
    inputBlock(b, sampleFrames, { compressed: true });
    const file = parseRzxFile(b.u8);
    const snap = file.blocks[0] as any;
    expect(snap.compressed).toBe(true);
    expect(snap.extension).toBe("szx");
    expect(Array.from(snap.bytes)).toEqual(Array.from(SNAP));
    expectFrames((file.blocks[1] as any).frames);
  });

  it("refuses a repeat frame first in a block", () => {
    const b = header();
    snapshotBlock(b);
    inputBlock(b, [[10, "repeat"]]);
    expect(() => parseRzxFile(b.u8)).toThrow(/repeats a previous frame/);
  });

  it("does not let a repeat reach back into an earlier block", () => {
    const b = header();
    snapshotBlock(b);
    inputBlock(b, [[10, [1]]]);
    inputBlock(b, [[10, "repeat"]]);
    expect(() => parseRzxFile(b.u8)).toThrow(/repeats a previous frame/);
  });

  it("refuses an external snapshot and a protected input block (D5)", () => {
    const ext = header();
    snapshotBlock(ext, { external: true });
    expect(() => parseRzxFile(ext.u8)).toThrow(/external snapshot/);

    const prot = header();
    snapshotBlock(prot);
    inputBlock(prot, [[10, [1]]], { protected: true });
    expect(() => parseRzxFile(prot.u8)).toThrow(/protected/);
  });

  it("refuses a file with no snapshot", () => {
    const b = header();
    creatorBlock(b);
    inputBlock(b, [[10, [1]]]);
    expect(() => parseRzxFile(b.u8)).toThrow(/no snapshot/);
  });

  it("skips security and unknown blocks with a note (D6)", () => {
    const b = header(1);
    snapshotBlock(b);
    b.byte(0x20).dword(5 + 8).dword(1).dword(2);
    b.byte(0x21).dword(5 + 3).byte(1, 2, 3);
    b.byte(0x77).dword(5 + 2).byte(0xaa, 0xbb);
    inputBlock(b, [[10, [1]]]);
    const file = parseRzxFile(b.u8);
    expect(file.blocks.map((x) => x.kind)).toEqual(["snapshot", "skipped", "skipped", "skipped", "input"]);
    expect(file.notes.length).toBe(4);
    expect(file.notes[0]).toMatch(/signed/);
    expect(file.notes[3]).toMatch(/unknown block with ID 0x77/);
  });

  it("checks lengths", () => {
    const b = header();
    snapshotBlock(b);
    const good = b.u8;
    expect(() => parseRzxFile(good.subarray(0, good.length - 1))).toThrow(/invalid length/);

    const short = header();
    snapshotBlock(short);
    inputBlock(short, [[10, [1, 2]]]);
    // --- Declare 2 frames where only one is stored
    const bytes = short.u8;
    const at = 10 + 17 + SNAP.length + 5;
    bytes[at] = 2;
    expect(() => parseRzxFile(bytes)).toThrow(/declares 2 frames but ends after 1/);
  });

  it("notes bytes after the declared frames", () => {
    const b = header();
    snapshotBlock(b);
    inputBlock(b, [[10, [1]]], { extra: [0, 0] });
    expect(parseRzxFile(b.u8).notes[0]).toMatch(/Ignored 2 bytes/);
  });
});

describe("RZX writer", () => {
  function sample(): RzxFile {
    const b = header();
    creatorBlock(b, "Klive IDE", 0, 50);
    snapshotBlock(b, { ext: "szx" });
    inputBlock(b, sampleFrames);
    snapshotBlock(b, { ext: "szx" });
    inputBlock(b, [[5, []], [100, [7, 7]], [101, [7, 7]]], { tstates: 7 });
    return parseRzxFile(b.u8);
  }

  it("collapses repeats, but never a zero-IN frame", () => {
    const frames: RzxFrame[] = [
      { fetchCount: 1, ins: Uint8Array.from([5]) },
      { fetchCount: 2, ins: Uint8Array.from([5]) },
      { fetchCount: 3, ins: new Uint8Array(0) },
      { fetchCount: 4, ins: new Uint8Array(0) },
      { fetchCount: 5, ins: Uint8Array.from([5]) }
    ];
    expect(Array.from(encodeFrames(frames))).toEqual([
      1, 0, 1, 0, 5,
      2, 0, 0xff, 0xff,
      3, 0, 0, 0,
      4, 0, 0, 0,
      5, 0, 1, 0, 5
    ]);
  });

  it("round-trips byte-exactly (write → read → write)", () => {
    for (const compress of [true, false]) {
      const first = writeRzxFile(sample(), { compress });
      const reread = parseRzxFile(first);
      const second = writeRzxFile(reread, { compress });
      expect(second).toEqual(first);
      expect(reread.creator?.name).toBe("Klive IDE");
      expect(rzxFrameCount(reread)).toBe(8);
      expect(reread.blocks.filter((x) => x.kind === "input").every((x: any) => x.compressed === compress)).toBe(true);
    }
  });

  it("writes the creator first, from the options when given", () => {
    const bytes = writeRzxFile(sample(), { creator: { name: "Other", major: 3, minor: 4, custom: new Uint8Array(0) } });
    expect(bytes[10]).toBe(0x10);
    expect(parseRzxFile(bytes).creator).toMatchObject({ name: "Other", major: 3, minor: 4 });
  });
});

describe("RZX segments and finalising", () => {
  function twoSegments(): RzxFile {
    const b = header();
    snapshotBlock(b);
    inputBlock(b, [[100, [1]], [3, []]]);
    inputBlock(b, [[200, [2]]]);
    snapshotBlock(b);
    inputBlock(b, [[300, [3]], [400, [4]]]);
    return parseRzxFile(b.u8);
  }

  it("splits a file into segments", () => {
    const segments = rzxSegments(twoSegments());
    expect(segments.map((s) => [s.index, s.inputs.length, s.frameCount, s.pictureFrames, s.firstFrame])).toEqual([
      [0, 2, 3, 2, 0],
      [1, 1, 2, 2, 3]
    ]);
    expect(formatRzxDuration(50 * 83 + 20)).toBe("1:23.4");
  });

  it("refuses an input block before any snapshot", () => {
    const file = twoSegments();
    file.blocks.unshift(file.blocks.find((x) => x.kind === "input")!);
    expect(() => rzxSegments(file)).toThrow(/before any snapshot/);
  });

  it("keeps the first snapshot and merges the input blocks", () => {
    const finalised = finaliseRzxFile(twoSegments());
    expect(finalised.blocks.map((x) => x.kind)).toEqual(["snapshot", "input"]);
    const input = finalised.blocks[1] as any;
    expect(input.frames.map((f: RzxFrame) => f.fetchCount)).toEqual([100, 3, 200, 300, 400]);
    expect(input.tstates).toBe(1234);
    // --- The source file is not changed
    expect(rzxSegments(twoSegments())[0].frameCount).toBe(3);
    expect(parseRzxFile(writeRzxFile(finalised)).blocks.length).toBe(2);
  });
});
