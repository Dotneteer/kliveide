import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  analyzeTape,
  blockLoadAddress,
  blockPayload,
  defaultTapeBlockView,
  filterTapeBlocks,
  formatPlayTime,
  parseTapeHeader,
  segmentOfBlock,
  tapeBlockViews,
  tapeTimeline,
  type TapeBlockInfo
} from "@renderer/appIde/DocumentPanels/Tape/tapeView";
import { zxText } from "@renderer/appIde/DocumentPanels/Tape/zxText";
import { SpectrumTapeHeader } from "@emu/machines/tape/SpectrumTapeHeader";

const floatSpy = new Uint8Array(readFileSync(resolve(__dirname, "../../testfiles/floatspy.tap")));

// ─── Tape builders ───────────────────────────────────────────────────────────

const word = (v: number) => [v & 0xff, (v >> 8) & 0xff];
const dword = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const withChecksum = (bytes: number[]) => [...bytes, bytes.reduce((a, b) => a ^ b, 0)];

function headerBytes(type: number, name: string, length: number, p1: number, p2: number): number[] {
  return withChecksum([
    0x00,
    type,
    ...ascii(name.padEnd(10, " ")),
    ...word(length),
    ...word(p1),
    ...word(p2)
  ]);
}
const dataBytes = (payload: number[]) => withChecksum([0xff, ...payload]);

const tzx = (...blocks: number[][]) =>
  new Uint8Array([...ascii("ZXTape!"), 0x1a, 1, 20, ...blocks.flat()]);
const std = (data: number[], pause = 1000) => [0x10, ...word(pause), ...word(data.length), ...data];
const turbo = (data: number[]) => [
  0x11,
  ...word(2168),
  ...word(667),
  ...word(735),
  ...word(855),
  ...word(1710),
  ...word(3223),
  8,
  ...word(1000),
  data.length & 0xff,
  (data.length >> 8) & 0xff,
  0,
  ...data
];
const tone = (len: number, count: number) => [0x12, ...word(len), ...word(count)];
const pulses = (...lengths: number[]) => [0x13, lengths.length, ...lengths.flatMap(word)];
const pause = (ms: number) => [0x20, ...word(ms)];
const text = (s: string) => [0x30, s.length, ...ascii(s)];
const archive = (fields: [number, string][]) => {
  const body = [fields.length, ...fields.flatMap(([t, v]) => [t, v.length, ...ascii(v)])];
  return [0x32, ...word(body.length), ...body];
};
/** A generalized block: no pilot, eight 1-bit data symbols of two pulses each */
const generalized = () => {
  const body = [
    ...word(0), // pause
    ...dword(0), // totp
    0, // npp
    0, // asp
    ...dword(8), // totd
    2, // npd
    2, // asd
    0,
    ...word(100),
    ...word(100), // symbol 0
    0,
    ...word(200),
    ...word(200), // symbol 1
    0b10100000 // the data stream: 1,0,1,0,0,0,0,0
  ];
  return [0x19, ...dword(body.length), ...body];
};

const demoTzx = () =>
  tzx(
    archive([
      [0x00, "Demo"],
      [0x01, "Klive"],
      [0x03, "2026"]
    ]),
    std(headerBytes(0, "demo", 3, 10, 3)),
    std(dataBytes([0x00, 0x0a, 0x00])),
    pause(500),
    tone(2168, 100),
    pulses(1000, 2000),
    turbo(dataBytes([1, 2, 3, 4])),
    text("Side A"),
    generalized(),
    std(headerBytes(3, "after", 2, 0x8000, 0)),
    std(dataBytes([0xc9, 0x00]))
  );

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("zxText", () => {
  it("trims the padding of a tape name", () => {
    expect(zxText(ascii("Float Spy "))).toBe("Float Spy");
  });

  it("spells out control codes with their arguments", () => {
    expect(zxText([0x16, 0x01, 0x00, ...ascii("Y.")])).toBe("{AT 1,0}Y.");
    expect(zxText([0x10, 0x02, ...ascii("x")])).toBe("{INK 2}x");
  });

  it("maps the Spectrum's own characters", () => {
    expect(zxText([0x60, 0x7f])).toBe("£©");
    expect(zxText([0x8f, 0x80, 0x83])).toBe("█ ▀");
    expect(zxText([0x90])).toBe("{UDG A}");
  });

  it("prints tokens as words", () => {
    expect(zxText([...ascii("A"), 0xbf, ...ascii("B")])).toBe("A IN B");
  });
});

describe("SpectrumTapeHeader", () => {
  it("reads the header it is given", () => {
    const header = new SpectrumTapeHeader(new Uint8Array(headerBytes(3, "code", 256, 32768, 0)));
    expect(header.type).toBe(3);
    expect(header.name).toBe("code");
    expect(header.dataLength).toBe(256);
    expect(header.parameter1).toBe(32768);
    expect(header.checksumValid).toBe(true);
  });

  it("still starts zero-filled with no argument", () => {
    const header = new SpectrumTapeHeader();
    expect(Array.from(header.headerBytes)).toEqual(new Array(19).fill(0));
  });

  it("tells a bad checksum", () => {
    const bytes = headerBytes(0, "x", 1, 0, 0);
    bytes[18] ^= 0xff;
    expect(new SpectrumTapeHeader(new Uint8Array(bytes)).checksumValid).toBe(false);
  });
});

describe("parseTapeHeader", () => {
  it("reads the name from offset 2, not 1", () => {
    // --- The old viewer read bytes 1-10: the type byte and nine name characters
    expect(parseTapeHeader(new Uint8Array(headerBytes(0, "ABCDEFGHIJ", 1, 0, 0))).name).toBe(
      "ABCDEFGHIJ"
    );
  });

  it("decodes a program's autostart and variables offset", () => {
    const h = parseTapeHeader(new Uint8Array(headerBytes(0, "p", 300, 10, 250)));
    expect(h.autostart).toBe(10);
    expect(h.variablesOffset).toBe(250);
    expect(
      parseTapeHeader(new Uint8Array(headerBytes(0, "p", 3, 0x8000, 3))).autostart
    ).toBeUndefined();
  });

  it("names an array", () => {
    const h = parseTapeHeader(new Uint8Array(headerBytes(2, "s", 10, 0xc100, 0)));
    expect(h.arrayName).toBe("a$()");
  });
});

describe("analyzeTape on a TAP file", () => {
  const { analysis } = analyzeTape(floatSpy);

  it("reads the four blocks and pairs them into two files", () => {
    expect(analysis?.summary.format).toBe("TAP");
    expect(analysis?.blocks).toHaveLength(4);
    expect(analysis?.files.map((f) => f.label)).toEqual([
      'Program "Float Spy"',
      'Bytes "float.cde"'
    ]);
  });

  it("knows what each data block holds", () => {
    const [h0, basic, h2, code] = analysis!.blocks;
    expect(h0.chip).toBe("HDR");
    expect(h0.header?.autostart).toBe(9996);
    expect(basic.role).toBe("basic");
    expect(basic.chip).toBe("BASIC");
    expect(basic.headerIndex).toBe(0);
    expect(basic.lengthMismatch).toBe(false);
    expect(basic.checksumOk).toBe(true);
    expect(h2.header?.startAddress).toBe(32764);
    expect(code.role).toBe("code");
    expect(blockLoadAddress(code, h2.header)).toBe(32764);
  });

  it("groups each header with its data", () => {
    const keys = analysis!.blocks.map((b) => b.groupKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).toBe(keys[3]);
    expect(keys[1]).not.toBe(keys[2]);
  });

  it("works out a play time", () => {
    // --- 5.7K of data at ~1,365 bit/s (~30-34 s), two 5 s header pilots, two 2 s data pilots and four
    // --- one-second pauses: about 48 s (zero bits, the shorter ones, outnumber one bits)
    expect(analysis!.summary.durationMs).toBeGreaterThan(42_000);
    expect(analysis!.summary.durationMs).toBeLessThan(56_000);
    expect(analysis!.summary.unplayableCount).toBe(0);
  });

  it("strips the flag and checksum from the payload", () => {
    const basic = analysis!.blocks[1];
    expect(blockPayload(basic)?.length).toBe(5476);
  });
});

describe("analyzeTape on a TZX file", () => {
  const { analysis, error } = analyzeTape(demoTzx());

  it("reads the whole file, past a generalized block", () => {
    expect(error).toBeUndefined();
    expect(analysis!.summary.version).toBe("1.20");
    expect(analysis!.blocks).toHaveLength(11);
    expect(analysis!.blocks[10].role).toBe("code");
  });

  it("collects the archive fields", () => {
    expect(analysis!.summary.title).toBe("Demo");
    expect(analysis!.summary.publisher).toBe("Klive");
    expect(analysis!.summary.year).toBe("2026");
  });

  it("flags the blocks Klive does not play", () => {
    const unplayable = analysis!.blocks.filter((b) => b.carriesSignal && !b.playable);
    // --- A pure tone has no data, and the player treats a block with no data as a pause
    expect(unplayable.map((b) => b.blockId)).toEqual([0x12, 0x13, 0x19]);
    expect(analysis!.summary.unplayableCount).toBe(3);
  });

  it("times a pulse sequence from its little-endian words", () => {
    const seq = analysis!.blocks.find((b) => b.blockId === 0x13)!;
    expect(seq.durationMs).toBeCloseTo(3000 / 3500, 5);
  });

  it("times a generalized block from its symbols", () => {
    const gen = analysis!.blocks.find((b) => b.blockId === 0x19)!;
    // --- Two 1-symbols (400T each) and six 0-symbols (200T each)
    expect(gen.durationMs).toBeCloseTo(2000 / 3500, 5);
    expect(gen.durationApprox).toBe(true);
  });

  it("puts the pause after a file into the file's group", () => {
    const [, , data, pauseBlock] = analysis!.blocks;
    expect(pauseBlock.groupKey).toBe(data.groupKey);
  });

  it("treats turbo data without a header as headerless", () => {
    const t = analysis!.blocks.find((b) => b.blockId === 0x11)!;
    expect(t.role).toBe("headerless");
    expect(t.chip).toBe("$11");
    expect(t.groupLabel).toBe("Headerless");
  });

  it("filters", () => {
    const items = analysis!.blocks.map((block) => ({ block }));
    expect(filterTapeBlocks(items, "basic").map((i) => i.block.index)).toEqual([2]);
    expect(filterTapeBlocks(items, "code").map((i) => i.block.index)).toEqual([10]);
    expect(filterTapeBlocks(items, "notPlayed")).toHaveLength(3);
    expect(filterTapeBlocks(items, "all")).toHaveLength(11);
  });

  it("offers the views that fit a block", () => {
    const basic = analysis!.blocks[2];
    expect(tapeBlockViews(basic)).toEqual(["memory", "disassembly", "basic"]);
    expect(defaultTapeBlockView(basic)).toBe("basic");
    expect(tapeBlockViews(analysis!.blocks[0])).toEqual([]);
    // --- A header: its details already show every byte
    expect(tapeBlockViews(analysis!.blocks[1])).toEqual([]);
  });

  it("reports a reader error", () => {
    expect(analyzeTape(new Uint8Array([1, 2, 3])).error).toBeTruthy();
  });
});

describe("formatPlayTime", () => {
  it("reads like a tape counter", () => {
    expect(formatPlayTime(0)).toBe("0:00");
    expect(formatPlayTime(61_400)).toBe("1:01");
  });
});

describe("tapeTimeline", () => {
  const block = (index: number, durationMs: number, extra: Partial<TapeBlockInfo> = {}) =>
    ({
      index,
      kind: "data",
      kindName: "Data",
      chip: "DATA",
      pauseMs: 0,
      durationMs,
      carriesSignal: true,
      playable: true,
      summary: "",
      groupKey: "g",
      groupLabel: "g",
      ...extra
    }) as TapeBlockInfo;

  it("sizes segments by play time and fills the width", () => {
    const segments = tapeTimeline([block(0, 100), block(1, 300)], 400);
    expect(segments.map((s) => s.width)).toEqual([100, 300]);
    expect(segments[1].x).toBe(100);
  });

  it("keeps a short block visible", () => {
    const segments = tapeTimeline([block(0, 1), block(1, 10_000)], 100);
    expect(segments[0].width).toBe(2);
    expect(segments[0].width + segments[1].width).toBeCloseTo(100, 5);
  });

  it("draws no segment for a block without signal", () => {
    const segments = tapeTimeline(
      [block(0, 100), block(1, 0, { kind: "text", carriesSignal: false }), block(2, 100)],
      200
    );
    expect(segments.map((s) => s.first)).toEqual([0, 2]);
    expect(segmentOfBlock(segments, 1)).toBeUndefined();
  });

  it("colours a block that will not play", () => {
    const [segment] = tapeTimeline([block(0, 100, { playable: false })], 100);
    expect(segment.tone).toBe("unplayable");
  });

  it("merges sub-pixel blocks on a long tape", () => {
    const blocks = [block(0, 100_000), ...Array.from({ length: 600 }, (_, i) => block(i + 1, 1))];
    const segments = tapeTimeline(blocks, 300);
    expect(segments.length).toBeLessThan(100);
    expect(segments.some((s) => s.tone === "merged")).toBe(true);
    expect(segmentOfBlock(segments, 300)).toBeDefined();
    const total = segments.reduce((sum, s) => sum + s.width, 0);
    expect(total).toBeCloseTo(300, 5);
  });

  it("splits the width evenly when every block needs the minimum", () => {
    const segments = tapeTimeline([block(0, 1), block(1, 1), block(2, 1)], 4);
    expect(segments.every((s) => Math.abs(s.width - 4 / 3) < 1e-9)).toBe(true);
  });
});
