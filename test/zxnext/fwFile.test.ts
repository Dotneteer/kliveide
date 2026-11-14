import { describe, expect, it } from "vitest";

import {
  FW_BLOCK,
  FW_MODULE_ADDRESS,
  findFwVersion,
  fwModuleTexts,
  isFwFileName,
  parseFwFile,
  readFwTestCard,
  type FwProblemCode
} from "@common/zxnext/fwFile";

/*
 * The TBBLUE.FW reader (`dev/plans/TBBLUE_FW_VIEWER_PLAN.md` §1, §1a), on files built here in the shape
 * of the real ones: the current layout (entries 1 and 3 alias the boot module), the 2019 layout, and
 * 1.46's unnamed entries. The committed cards' real firmware is read in `test/main/fw-cards.test.ts`.
 */

const STUB = [0x31, 0xff, 0xff, 0xf3];
const text = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

type Module = { blocks: number; bytes?: number[]; alias?: number };

/** A firmware file as the packer writes it: the map, then each module zero-padded to whole blocks */
function buildFw(modules: Module[]): Uint8Array {
  const map = new Uint8Array(FW_BLOCK);
  const bodies: Uint8Array[] = [];
  const placed: { start: number; blocks: number }[] = [];
  let next = 0;
  modules.forEach((m, i) => {
    let where = m.alias !== undefined ? placed[m.alias] : undefined;
    if (!where) {
      const body = new Uint8Array(m.blocks * FW_BLOCK);
      body.set(m.bytes ?? [...STUB, 0xc3, 0x10, 0x60]);
      bodies.push(body);
      where = { start: next, blocks: m.blocks };
      next += m.blocks;
    }
    placed.push(where);
    map.set([where.start & 0xff, where.start >> 8, where.blocks & 0xff, where.blocks >> 8], i * 4);
  });
  const file = new Uint8Array(FW_BLOCK * (1 + next));
  file.set(map);
  let at = FW_BLOCK;
  for (const body of bodies) {
    file.set(body, at);
    at += body.length;
  }
  return file;
}

/** A boot module with the version text, as 1.44-1.46 hold it */
const bootWith = (version: string) => [...STUB, 0xc3, 0x10, 0x60, ...text("Firmware v\0<none>\0"), ...text(version), 0, 0x3e];

/** A screens block: a 256×192 picture of index 1, then the palette: entry 0 black, entry 1 white */
function screens(): number[] {
  const bytes = new Array<number>(49152).fill(1);
  bytes.push(0x00, 0x00, 0xff, 0x01);
  bytes.push(...new Array<number>(223).fill(0));
  bytes.push(1, 2, 3);
  return bytes;
}

/** The current layout (1.44/1.45): nine entries, 1 and 3 aliases of boot */
const current = (extra: Module[] = []) =>
  buildFw([
    { blocks: 3, bytes: bootWith("1.46") },
    { blocks: 0, alias: 0 },
    { blocks: 2 },
    { blocks: 0, alias: 0 },
    { blocks: 2 },
    { blocks: 2 },
    { blocks: 2 },
    { blocks: 2 },
    { blocks: 98, bytes: screens() },
    ...extra
  ]);

const codes = (data: Uint8Array): FwProblemCode[] => parseFwFile(data).problems.map((p) => p.code);

describe("TBBLUE.FW file name", () => {
  it("matches the firmware file in any case and folder", () => {
    expect(isFwFileName("TBBLUE.FW")).toBe(true);
    expect(isFwFileName("/Volumes/NEXT/tbblue.fw")).toBe(true);
    expect(isFwFileName("C:\\sd\\TbBlue.Fw")).toBe(true);
  });

  it("does not match other files", () => {
    expect(isFwFileName("OTHER.FW")).toBe(false);
    expect(isFwFileName("/x/MYTBBLUE.FW")).toBe(false);
    expect(isFwFileName("TBBLUE.TBU")).toBe(false);
  });
});

describe("TBBLUE.FW, the current layout", () => {
  it("reads the map, the names, the aliases and the kinds", () => {
    const fw = parseFwFile(current());
    expect(fw.format).toBe("firmware");
    expect(fw.layout).toBe("current");
    expect(fw.problems).toEqual([]);
    expect(fw.version).toBe("1.46");
    expect(fw.modulesEnd).toBe(fw.fileSize);
    expect(fw.entries.map((e) => e.name)).toEqual([
      "boot", "editorOld", "updater", "coresOld", "editor", "cores", "testCard", "reset", "screens"
    ]);
    expect(fw.entries.map((e) => e.aliasOf)).toEqual([undefined, 0, undefined, 0, undefined, undefined, undefined, undefined, undefined]);
    expect(fw.entries[1]).toMatchObject({ start: 0, length: 3, fileOffset: FW_BLOCK, kind: "code", runsAt: FW_MODULE_ADDRESS });
    expect(fw.entries[2]).toMatchObject({ start: 3, length: 2, fileOffset: 4 * FW_BLOCK, byteLength: 2 * FW_BLOCK, kind: "code" });
    expect(fw.entries[8].kind).toBe("data");
    expect(fw.entries[8].runsAt).toBeUndefined();
  });

  it("measures each module's $00 padding", () => {
    const updater = parseFwFile(current()).entries[2];
    expect(updater.dataLength).toBe(7);
    expect(updater.paddingLength).toBe(2 * FW_BLOCK - 7);
  });

  it("numbers the entries the source does not name (1.46's 9-16)", () => {
    const fw = parseFwFile(current([{ blocks: 2 }, { blocks: 1, bytes: text("The Creators") }]));
    expect(fw.entries).toHaveLength(11);
    expect([fw.entries[9].name, fw.entries[9].kind]).toEqual([undefined, "code"]);
    expect([fw.entries[10].name, fw.entries[10].kind]).toEqual([undefined, "data"]);
    expect(fw.problems).toEqual([]);
  });

  it("reads the screens block's test card picture and its palette", () => {
    const data = current();
    const fw = parseFwFile(data);
    const card = readFwTestCard(data, fw.entries[8])!;
    expect(card.pixels).toHaveLength(256 * 192);
    expect(card.pixels.every((p) => p === 1)).toBe(true);
    // --- White is $01FF in the file: RRRGGGBB = $FF and the low blue bit 1
    expect(card.palette[0]).toBe(0);
    expect(card.palette[1]).toBe(0x1ff);
    expect(card.palette).toHaveLength(256);
    expect(readFwTestCard(data, fw.entries[2])).toBeUndefined();
  });
});

describe("TBBLUE.FW, the 2019 layout", () => {
  it("names entries 0-3 by position, as real modules, and numbers the rest", () => {
    const fw = parseFwFile(
      buildFw([{ blocks: 2 }, { blocks: 2 }, { blocks: 2 }, { blocks: 2 }, { blocks: 1, bytes: [0, 0, 7] }, { blocks: 1, bytes: [0, 0, 7] }])
    );
    expect(fw.layout).toBe("old");
    expect(fw.entries.map((e) => e.name)).toEqual(["boot", "editorOld", "updater", "coresOld", undefined, undefined]);
    expect(fw.entries.every((e) => e.aliasOf === undefined)).toBe(true);
    expect(fw.entries.map((e) => e.kind)).toEqual(["code", "code", "code", "code", "data", "data"]);
    expect(fw.version).toBeUndefined();
    expect(fw.problems).toEqual([]);
  });
});

describe("TBBLUE.FW problems", () => {
  it("refuses what is not a firmware file", () => {
    expect(codes(new Uint8Array(100))).toEqual(["tooShort"]);
    expect(codes(new Uint8Array(2048))).toEqual(["notFirmware"]);
    // --- A first entry that does not start at block 0
    const data = current();
    data[0] = 5;
    expect(codes(data)).toEqual(["notFirmware"]);
    expect(parseFwFile(data).format).toBe("unknown");
  });

  it("reports a module beyond the end of the file", () => {
    const data = current();
    expect(codes(data.subarray(0, data.length - FW_BLOCK))).toEqual(["entryOutOfRange"]);
  });

  it("reports a file that is not whole blocks, and data after the last module", () => {
    const data = current();
    const longer = new Uint8Array(data.length + 10);
    longer.set(data);
    expect(codes(longer)).toEqual(["notBlockAligned", "trailingData"]);
  });

  it("reports modules that partly overlap, but not aliases", () => {
    const data = current();
    // --- Entry 4 starts one block into the updater
    data[4 * 4] = 4;
    expect(parseFwFile(data).problems).toContainEqual({ code: "entryOverlap", severity: "error", entry: 4, otherEntry: 2 });
  });

  it("warns when there is no updater for the anti-brick boot ROM", () => {
    expect(codes(buildFw([{ blocks: 2 }, { blocks: 0, alias: 0 }]))).toEqual(["noUpdater"]);
    expect(codes(buildFw([{ blocks: 2 }, { blocks: 0, alias: 0 }, { blocks: 0, alias: 0 }]))).toEqual(["noUpdater"]);
  });
});

describe("TBBLUE.FW texts and version", () => {
  it("keeps words and drops printable picture bytes", () => {
    const bytes = [...STUB, 0, ...text("Flash core"), 0, ...text("$%%%%%%%%"), 0, ...text("GGGGGGGGGG"), 0, ...text("Ab1"), 0, ...text("Erase core")];
    const fw = parseFwFile(buildFw([{ blocks: 1, bytes }]));
    expect(fwModuleTexts(buildFw([{ blocks: 1, bytes }]), fw.entries[0])).toEqual(["Flash core", "Erase core"]);
  });

  it("stops at the limit", () => {
    const bytes = [...STUB, 0, ...text("First text"), 0, ...text("Second text"), 0, ...text("Third text")];
    const data = buildFw([{ blocks: 1, bytes }]);
    expect(fwModuleTexts(data, parseFwFile(data).entries[0], 2)).toEqual(["First text", "Second text"]);
  });

  it("finds the version only as a zero-terminated d.dd in a code boot module", () => {
    const data = buildFw([{ blocks: 1, bytes: [...STUB, 0, ...text("v1.2"), 0, ...text("21.4"), 0, ...text("1.45"), 0] }]);
    const fw = parseFwFile(data);
    expect(fw.version).toBe("1.45");
    expect(findFwVersion(data, { ...fw.entries[0], kind: "data" })).toBeUndefined();
  });
});
