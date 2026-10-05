import { describe, it, expect } from "vitest";
import { parseSnaFile, SNA_48K_SIZE, SNA_128K_SIZE, SNA_128K_LONG_SIZE } from "@common/spectrum/snapshot/snaFile";
import { parseZ80File } from "@common/spectrum/snapshot/z80File";
import { parseSzxFile } from "@common/spectrum/snapshot/szxFile";
import {
  detectSnapshotFormat,
  parseSpectrumSnapshot
} from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { kliveSpectrumName, mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import {
  buildSna128,
  buildSna48,
  buildSzx,
  buildZ80,
  patternBank,
  state128,
  state48,
  szxBlock,
  szxDskBlock,
  szxTapeBlock,
  type TestState
} from "./builders";

/** The CPU fields every format carries */
function expectCpu(s: SpectrumSnapshot, t: TestState) {
  const c = s.cpu;
  expect([c.af, c.bc, c.de, c.hl]).toEqual([t.af, t.bc, t.de, t.hl]);
  expect([c.af_, c.bc_, c.de_, c.hl_]).toEqual([t.af_, t.bc_, t.de_, t.hl_]);
  expect([c.ix, c.iy, c.sp, c.pc]).toEqual([t.ix, t.iy, t.sp, t.pc]);
  expect([c.i, c.r, c.im]).toEqual([t.i, t.r, t.im]);
  expect(c.iff2).toBe(t.iff2);
}

function expectRam(s: SpectrumSnapshot, t: TestState) {
  expect([...s.ram.keys()].sort()).toEqual([...t.ram.keys()].sort());
  for (const [bank, bytes] of t.ram) {
    expect(s.ram.get(bank), `bank ${bank}`).toEqual(bytes);
  }
}

describe(".sna", () => {
  it("parses a 48K file and pops PC off the stack", () => {
    const t = state48();
    const bytes = buildSna48(t);
    expect(bytes.length).toBe(SNA_48K_SIZE);
    const s = parseSnaFile(bytes);
    expect(s.machine).toBe("48k");
    expect(s.formatVersion).toBe("48K");
    expectCpu(s, t);
    expect(s.cpu.iff1).toBe(true);
    expect(s.ula.border).toBe(3);
    expect(s.ula.frameTact).toBeUndefined();
    // --- The stack bytes stay as stored (the PC the file pushed)
    const stack = s.ram.get(0)!;
    expect(stack[(t.sp - 2) & 0x3fff]).toBe(t.pc & 0xff);
  });

  it("reads IFF2 from bit 2 and sets IFF1 to it", () => {
    const s = parseSnaFile(buildSna48(state48({ iff1: false, iff2: false })));
    expect(s.cpu.iff1).toBe(false);
    expect(s.cpu.iff2).toBe(false);
  });

  it("parses a 128K file with every bank in place", () => {
    const t = state128({ port7ffd: 0x13 });
    const bytes = buildSna128(t);
    expect(bytes.length).toBe(SNA_128K_SIZE);
    const s = parseSnaFile(bytes);
    expect(s.machine).toBe("128k");
    expectCpu(s, t);
    expect(s.paging).toEqual({ port7ffd: 0x13 });
    expectRam(s, t);
  });

  it.each([2, 5])("parses the long 128K layout when bank %i is paged", (paged) => {
    const t = state128({ port7ffd: 0x10 | paged });
    const bytes = buildSna128(t);
    expect(bytes.length).toBe(SNA_128K_LONG_SIZE);
    const s = parseSnaFile(bytes);
    expectRam(s, t);
  });

  it("refuses a short 128K layout whose paged bank is 2", () => {
    const t = state128({ port7ffd: 0x13 });
    const bytes = buildSna128(t);
    bytes[SNA_48K_SIZE + 2] = 0x12; // --- now says bank 2, which needs the long layout
    expect(() => parseSnaFile(bytes)).toThrow(/147487/);
  });

  it("warns about the TR-DOS ROM and refuses an odd size", () => {
    const s = parseSnaFile(buildSna128(state128(), 1));
    expect(s.peripherals.trdosPaged).toBe(true);
    expect(mapSpectrumSnapshotToKlive(s).warnings.join()).toMatch(/TR-DOS/);
    expect(() => parseSnaFile(new Uint8Array(1000))).toThrow(/49179/);
  });
});

describe(".z80", () => {
  it.each([true, false])("parses version 1 (compressed: %s)", (compressed) => {
    const t = state48();
    const s = parseZ80File(buildZ80(t, { version: 1, compressed }));
    expect(s.formatVersion).toBe("v1");
    expect(s.machine).toBe("48k");
    expectCpu(s, t);
    expect(s.cpu.iff1).toBe(true);
    expect(s.ula.border).toBe(3);
    expectRam(s, t);
  });

  it("reads byte 12 = $FF as 1", () => {
    const t = state48({ r: 0x25 });
    const s = parseZ80File(buildZ80(t, { version: 1, flags255: true }));
    expect(s.cpu.r).toBe(0xa5); // --- bit 7 from the "1"
    expect(s.ula.border).toBe(0);
  });

  it.each([2, 3] as const)("parses a 48K version %i file", (version) => {
    const t = state48({ frameTact: 30000 });
    const s = parseZ80File(buildZ80(t, { version }));
    expect(s.formatVersion).toBe(`v${version}`);
    expect(s.machine).toBe("48k");
    expectCpu(s, t);
    expectRam(s, t);
    expect(s.ay).toBeUndefined();
    expect(s.ula.frameTact).toBe(version === 3 ? 30000 : undefined);
  });

  it.each([2, 3] as const)("parses a 128K version %i file with paging and AY", (version) => {
    const t = state128({ frameTact: 54321 });
    const s = parseZ80File(buildZ80(t, { version, paged: true, compressed: false }));
    expect(s.machine).toBe("128k");
    expectCpu(s, t);
    expectRam(s, t);
    expect(s.paging?.port7ffd).toBe(0x13);
    expect(s.ay?.selected).toBe(7);
    expect([...s.ay!.regs]).toEqual(t.ay!.regs);
    if (version === 3) expect(s.ula.frameTact).toBe(54321);
  });

  it.each([
    [2, 0, false, "48k"],
    [2, 1, false, "48k"],
    [2, 3, false, "128k"],
    [2, 4, false, "128k"],
    [3, 3, false, "48k"],
    [3, 4, false, "128k"],
    [3, 5, false, "128k"],
    [3, 6, false, "128k"],
    [3, 7, false, "plus3"],
    [3, 8, false, "plus3"],
    [3, 12, false, "plus2"],
    [3, 13, false, "plus2a"],
    [2, 9, false, "pentagon"],
    [3, 9, false, "pentagon"],
    [3, 0, true, "16k"],
    [3, 4, true, "plus2"],
    [3, 7, true, "plus2a"]
  ] as const)("maps v%i hardware mode %i (modified: %s) to %s", (version, hwMode, modified, machine) => {
    const paged = !["48k", "16k"].includes(machine);
    const t = machine === "16k" ? state48({ ram: new Map([[5, patternBank(5)]]) }) : paged ? state128() : state48();
    const s = parseZ80File(buildZ80(t, { version, hwMode, modified, paged }));
    expect(s.machine).toBe(machine);
  });

  it.each([2, 10, 11, 14, 15, 128])("marks hardware mode %i unsupported", (hwMode) => {
    const s = parseZ80File(buildZ80(state48(), { version: 3, hwMode }));
    expect(typeof s.machine).toBe("object");
    expect(mapSpectrumSnapshotToKlive(s).errors.length).toBe(1);
  });

  it("reads $1FFD from the 55-byte header of a +3 file", () => {
    const t = state128({ port1ffd: 0x05 });
    const s = parseZ80File(buildZ80(t, { version: 3, hwMode: 7, paged: true, long: true }));
    expect(s.paging).toEqual({ port7ffd: 0x13, port1ffd: 0x05 });
  });

  it("marks an AY on a 48K and an Interface 1", () => {
    const t = { ...state48(), ay: { selected: 1, regs: new Array(16).fill(0) } };
    const s = parseZ80File(buildZ80(t, { version: 3, hwMode: 1, ay48: true, issue2: true }));
    expect(s.ay?.on48k).toBe(true);
    expect(s.peripherals.interface1).toBe(true);
    expect(s.peripherals.issue2).toBe(true);
    const w = mapSpectrumSnapshotToKlive(s).warnings.join("\n");
    expect(w).toMatch(/AY chip on a 48K/);
    expect(w).toMatch(/Interface 1/);
    expect(w).toMatch(/Issue 2/);
  });

  it("refuses a missing bank, a truncated block and a short file", () => {
    const t = state48();
    t.ram.delete(0);
    expect(() => parseZ80File(buildZ80(t, { version: 3 }))).toThrow(/bank\(s\) 0/);
    const full = buildZ80(state48(), { version: 3 });
    expect(() => parseZ80File(full.subarray(0, full.length - 10))).toThrow(/truncated/);
    expect(() => parseZ80File(new Uint8Array(20))).toThrow(/30-byte/);
  });

  it("refuses a non-snapshot .z80 (a PASTA/80 temp file) without crashing", () => {
    const junk = new TextEncoder().encode("program hello; begin writeln('hi') end.".padEnd(200, " "));
    expect(() => parseSpectrumSnapshot("hello.z80", junk)).toThrow();
  });
});

describe(".szx", () => {
  it.each([true, false])("parses a 48K file (compressed: %s)", (compressed) => {
    const t = state48({ frameTact: 12345, memptr: 0xbeef });
    const s = parseSzxFile(buildSzx(t, { machineId: 1, compressed }));
    expect(s.format).toBe("szx");
    expect(s.formatVersion).toBe("1.4");
    expect(s.machine).toBe("48k");
    expectCpu(s, t);
    expect(s.cpu.iff1).toBe(true);
    expect(s.cpu.memptr).toBe(0xbeef);
    expect(s.ula.frameTact).toBe(12345);
    expect(s.ula.border).toBe(3);
    expect(s.ula.lastFe).toBe(0x18);
    expect(s.creator).toBe("Klive test builder 1.2");
    expectRam(s, t);
  });

  it("parses a 128K file with paging, AY and CPU flags", () => {
    const t = state128({ halted: true, suppressInterrupt: false });
    const s = parseSzxFile(buildSzx(t, { machineId: 2 }));
    expect(s.machine).toBe("128k");
    expect(s.paging?.port7ffd).toBe(0x13);
    expect(s.paging?.port1ffd).toBeUndefined();
    expect(s.cpu.halted).toBe(true);
    expect(s.cpu.suppressInterrupt).toBe(false);
    expect(s.ay?.selected).toBe(7);
    expectRam(s, t);
  });

  it("reads the suppress-interrupt flag, and ignores MEMPTR before 1.4", () => {
    const t = state48({ suppressInterrupt: true, memptr: 0x1234 });
    const s = parseSzxFile(buildSzx(t, { machineId: 1, minor: 3 }));
    expect(s.cpu.suppressInterrupt).toBe(true);
    expect(s.cpu.memptr).toBeUndefined();
  });

  it.each([
    [0, "16k"],
    [1, "48k"],
    [2, "128k"],
    [3, "plus2"],
    [4, "plus2a"],
    [5, "plus3"],
    [6, "plus3e"],
    [7, "pentagon"],
    [15, "48k-ntsc"]
  ] as const)("maps machine id %i to %s", (machineId, machine) => {
    const paged = !["16k", "48k", "48k-ntsc"].includes(machine);
    const t = machine === "16k" ? state48({ ram: new Map([[5, patternBank(5)]]) }) : paged ? state128() : state48();
    const s = parseSzxFile(buildSzx(t, { machineId }));
    expect(s.machine).toBe(machine);
  });

  it.each([8, 9, 10, 11, 12, 13, 14, 16, 99])("marks machine id %i unsupported", (machineId) => {
    const s = parseSzxFile(buildSzx(state128(), { machineId }));
    expect(typeof s.machine).toBe("object");
    expect(mapSpectrumSnapshotToKlive(s).errors).toHaveLength(1);
  });

  it("reads $1FFD on a +3", () => {
    const s = parseSzxFile(buildSzx(state128({ port1ffd: 0x0d }), { machineId: 5 }));
    expect(s.paging).toEqual({ port7ffd: 0x13, port1ffd: 0x0d });
  });

  it("lists unknown and skipped blocks, with warnings", () => {
    const s = parseSzxFile(
      buildSzx(state48(), {
        machineId: 1,
        extra: [szxBlock("MFCE", [0, 0]), szxBlock("QQQQ", [1, 2, 3])]
      })
    );
    expect(s.chunks!.map((c) => c.id)).toEqual(["CRTR", "Z80R", "SPCR", "RAMP", "RAMP", "RAMP", "MFCE", "QQQQ"]);
    expect(s.chunks!.find((c) => c.id === "QQQQ")!.known).toBe(false);
    expect(s.warnings.join("\n")).toMatch(/Multiface/);
    expect(s.warnings.join("\n")).toMatch(/Unknown block "QQQQ"/);
  });

  it.each([true, false])("reads an embedded tape (compressed: %s)", (compressed) => {
    const tape = new Uint8Array(500).map((_, i) => i & 0xff);
    const s = parseSzxFile(
      buildSzx(state48(), { machineId: 1, extra: [szxTapeBlock(tape, "tzx", compressed, 3)] })
    );
    expect(s.peripherals.tape?.embedded).toEqual(tape);
    expect(s.peripherals.tape?.extension).toBe("tzx");
    expect(s.peripherals.tape?.currentBlock).toBe(3);
  });

  it("reads the +3 drives and linked disks, preferring two drives", () => {
    const s = parseSzxFile(
      buildSzx(state128(), {
        machineId: 5,
        extra: [szxBlock("+3", [2, 1]), szxDskBlock(0, "C:\\disks\\game.dsk"), szxDskBlock(1, "data.dsk")]
      })
    );
    expect(s.peripherals.plus3).toEqual({
      drives: 2,
      motorOn: true,
      disks: [
        { drive: 0, fileName: "C:\\disks\\game.dsk" },
        { drive: 1, fileName: "data.dsk" }
      ]
    });
    expect(mapSpectrumSnapshotToKlive(s).modelIds[0]).toBe("fdd2");
  });

  it("refuses a missing Z80R, a missing RAM page, a truncated block and a bad zlib stream", () => {
    expect(() => parseSzxFile(buildSzx(state48(), { machineId: 1, omit: ["Z80R"] }))).toThrow(/Z80R/);
    expect(() => parseSzxFile(buildSzx(state48(), { machineId: 1, omit: ["RAMP2"] }))).toThrow(/page\(s\) 2/);
    const full = buildSzx(state48(), { machineId: 1 });
    expect(() => parseSzxFile(full.subarray(0, full.length - 5))).toThrow(/truncated/);
    const bad = buildSzx(state48(), { machineId: 1, extra: [szxBlock("RAMP", [1, 0, 7, 1, 2, 3, 4])] });
    expect(() => parseSzxFile(bad)).toThrow(/decompressed/);
    expect(() => parseSzxFile(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(/ZXST/);
  });
});

describe("format detection and cross-format equality", () => {
  it("detects by name, checked against content", () => {
    const sna = buildSna48(state48());
    const szx = buildSzx(state48(), { machineId: 1 });
    expect(detectSnapshotFormat("GAME.SNA", sna)).toBe("sna");
    expect(detectSnapshotFormat("a.szx", szx)).toBe("szx");
    expect(detectSnapshotFormat("a.Z80", buildZ80(state48(), { version: 1 }))).toBe("z80");
    expect(() => detectSnapshotFormat("a.szx", sna)).toThrow(/ZXST/);
    expect(() => detectSnapshotFormat("a.sna", szx)).toThrow(/length/);
    expect(() => detectSnapshotFormat("a.z80", szx)).toThrow(/zx-state/);
    expect(() => detectSnapshotFormat("a.tap", sna)).toThrow(/not a \.sna/);
  });

  it("parses one 48K state written in all three formats to the same machine state", () => {
    const t = state48();
    const models = [
      parseSpectrumSnapshot("a.sna", buildSna48(t)),
      parseSpectrumSnapshot("a.z80", buildZ80(t, { version: 3 })),
      parseSpectrumSnapshot("a.szx", buildSzx(t, { machineId: 1 }))
    ];
    for (const m of models) {
      expect(m.machine).toBe("48k");
      expectCpu(m, t);
      expect(m.ula.border).toBe(t.border);
    }
    // --- RAM equal except the two .sna stack bytes the pushed PC overwrote
    const [sna, z80, szx] = models;
    expect(z80.ram).toEqual(szx.ram);
    const diff = [...sna.ram.get(0)!].filter((b, i) => b !== z80.ram.get(0)![i]).length;
    expect(diff).toBeLessThanOrEqual(2);
  });

  it("parses one 128K state written in all three formats to the same machine state", () => {
    const t = state128();
    const models = [
      parseSpectrumSnapshot("a.sna", buildSna128(t)),
      parseSpectrumSnapshot("a.z80", buildZ80(t, { version: 3, paged: true })),
      parseSpectrumSnapshot("a.szx", buildSzx(t, { machineId: 2 }))
    ];
    for (const m of models) {
      expect(m.machine).toBe("128k");
      expectCpu(m, t);
      expectRam(m, t);
      expect(m.paging?.port7ffd).toBe(0x13);
    }
  });
});

describe("mapping", () => {
  const map = (machine: SpectrumSnapshot["machine"]) =>
    mapSpectrumSnapshotToKlive({ ...parseSnaFile(buildSna48(state48())), machine });

  it.each([
    ["16k", "sp48", "pal-16k", false],
    ["48k", "sp48", "pal", false],
    ["48k-ntsc", "sp48", "ntsc", false],
    ["128k", "sp128", "sp128", false],
    ["plus2", "sp128", "sp128", true],
    ["pentagon", "sp128", "pentagon", false],
    ["plus2a", "spp3e", "nofdd", true],
    ["plus3", "spp3e", "fdd1", true],
    ["plus3e", "spp3e", "fdd1", false]
  ] as const)("maps %s to %s / %s", (machine, machineId, modelId, warns) => {
    const m = map(machine);
    expect(m.errors).toEqual([]);
    expect(m.machineId).toBe(machineId);
    expect(m.modelIds[0]).toBe(modelId);
    expect(m.warnings.length > 0).toBe(warns);
  });

  it("lists the 128K model first, then the Pentagon; a Pentagon snapshot runs only on the Pentagon", () => {
    expect(map("128k").modelIds).toEqual(["sp128", "pentagon"]);
    expect(map("plus2").modelIds).toEqual(["sp128", "pentagon"]);
    expect(map("pentagon").modelIds).toEqual(["pentagon"]);
    expect(map("pentagon").kliveName).toBe("Pentagon 128");
  });

  it("lists the +E models first, then the Amstrad ones (.plans/PLUS3_AMSTRAD_ROMS_PLAN.md P6)", () => {
    expect(map("plus2a").modelIds).toEqual(["nofdd", "fdd1", "fdd2", "plus2a", "plus2a-es"]);
    expect(map("plus3").modelIds).toEqual([
      "fdd1",
      "fdd2",
      "plus3-fdd1",
      "plus3-fdd2",
      "plus3-v40-fdd1",
      "plus3-v40-fdd2",
      "plus3-es-fdd1",
      "plus3-es-fdd2"
    ]);
    expect(map("plus3e").modelIds).toEqual(["fdd1", "fdd2"]);
  });

  it("marks the +E ROMs warning, so the loader can drop it on an Amstrad model", () => {
    const m = map("plus3");
    expect(m.eRomWarning).toMatch(/\+E ROMs instead of the Amstrad ones/);
    expect(m.warnings).toContain(m.eRomWarning);
    expect(map("plus2").eRomWarning).toBeUndefined();
    expect(map("plus3e").eRomWarning).toBeUndefined();
  });

  it("names the Amstrad models", () => {
    expect(kliveSpectrumName("spp3e", "plus3-es-fdd2")).toBe("ZX Spectrum +3 (Spanish, 2 FDDs)");
    expect(kliveSpectrumName("spp3e", "plus2a")).toBe("ZX Spectrum +2A");
    expect(kliveSpectrumName("spp3e", "fdd1")).toBe("ZX Spectrum +3E (1 FDD)");
    expect(kliveSpectrumName("spp3e", undefined)).toBe("ZX Spectrum +2A/+3/+2E/+3E");
  });

  it("prefers the two-drive +E model for a two-drive +3, ahead of the Amstrad ones", () => {
    const s = { ...parseSnaFile(buildSna48(state48())), machine: "plus3" as const };
    s.peripherals = { ...s.peripherals, plus3: { drives: 2, motorOn: false, disks: [] } };
    expect(mapSpectrumSnapshotToKlive(s).modelIds.slice(0, 3)).toEqual(["fdd2", "fdd1", "plus3-fdd1"]);
  });

  it("refuses an unsupported machine", () => {
    const m = map({ unsupported: "Scorpion ZS-256" });
    expect(m.errors).toEqual(["Klive cannot emulate the Scorpion ZS-256"]);
    expect(m.machineId).toBeUndefined();
  });

  it("warns when a halted CPU's PC is not on a HALT", () => {
    const t = state48({ halted: true });
    const s = parseSzxFile(buildSzx(t, { machineId: 1 }));
    expect(mapSpectrumSnapshotToKlive(s).warnings.join()).toMatch(/HALT/);
    s.ram.get(2)![t.pc & 0x3fff] = 0x76;
    expect(mapSpectrumSnapshotToKlive(s).warnings.join()).not.toMatch(/HALT/);
  });
});
