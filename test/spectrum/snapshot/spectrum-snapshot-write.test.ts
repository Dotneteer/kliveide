/*
 * The snapshot writers (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` Phase 1): every format
 * round-trips through Klive's parsers to the same model, minus the losses the writer declares, and
 * the `.sna` output equals the spec-written test builders byte for byte (D14).
 */

import { describe, it, expect } from "vitest";
import {
  compressZ80DataBlock,
  decompressZ80DataBlock
} from "@common/spectrum/snapshot/z80Compression";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import { SnapshotRefusedError } from "@common/spectrum/snapshot/snapshotBytes";
import { z80TStateCounter } from "@common/spectrum/snapshot/z80Writer";
import { captureSpectrumSnapshot } from "@emu/machines/zxSpectrum/spectrumSnapshotCapture";
import {
  SNA_128K_LONG_SIZE,
  SNA_128K_SIZE,
  SNA_48K_SIZE
} from "@common/spectrum/snapshot/snaFile";
import type {
  SnapshotMachineKind,
  SpectrumSnapshot,
  SpectrumSnapshotFormat
} from "@common/spectrum/snapshot/spectrumSnapshot";
import { buildSna128, buildSna48, patternBank, state128, state48, type TestState } from "./builders";

/** A snapshot model from a builder state */
function model(
  t: TestState,
  machine: SnapshotMachineKind,
  over: Partial<SpectrumSnapshot> = {}
): SpectrumSnapshot {
  const paged = !["16k", "48k", "48k-ntsc"].includes(machine);
  const ram = new Map<number, Uint8Array>();
  for (const [b, bytes] of t.ram) {
    if (machine === "16k" && b !== 5) continue;
    ram.set(b, bytes.slice());
  }
  return {
    format: "szx",
    formatVersion: "",
    machine,
    cpu: {
      af: t.af,
      bc: t.bc,
      de: t.de,
      hl: t.hl,
      af_: t.af_,
      bc_: t.bc_,
      de_: t.de_,
      hl_: t.hl_,
      ix: t.ix,
      iy: t.iy,
      sp: t.sp,
      pc: t.pc,
      i: t.i,
      r: t.r,
      im: t.im,
      iff1: t.iff1,
      iff2: t.iff2,
      halted: t.halted,
      suppressInterrupt: t.suppressInterrupt,
      memptr: t.memptr
    },
    ula: { border: t.border, frameTact: t.frameTact },
    paging: paged ? { port7ffd: t.port7ffd ?? 0, port1ffd: t.port1ffd } : undefined,
    ram,
    ay: t.ay ? { selected: t.ay.selected, regs: Uint8Array.from(t.ay.regs) } : undefined,
    peripherals: {},
    header: [],
    warnings: [],
    ...over
  };
}

/** Writes, then parses back */
function roundTrip(s: SpectrumSnapshot, format: SpectrumSnapshotFormat) {
  const written = writeSpectrumSnapshot(s, format);
  const parsed = parseSpectrumSnapshot(`x.${format}`, written.bytes);
  return { written, parsed };
}

function expectSameCpu(a: SpectrumSnapshot, b: SpectrumSnapshot) {
  const keys = ["af", "bc", "de", "hl", "af_", "bc_", "de_", "hl_", "ix", "iy", "sp", "pc", "i", "r", "im", "iff1", "iff2"] as const;
  for (const k of keys) expect(b.cpu[k], k).toBe(a.cpu[k]);
}

function expectSameRam(a: SpectrumSnapshot, b: SpectrumSnapshot) {
  expect([...b.ram.keys()].sort()).toEqual([...a.ram.keys()].sort());
  for (const [bank, bytes] of a.ram) expect(b.ram.get(bank), `bank ${bank}`).toEqual(bytes);
}

describe("compressZ80DataBlock", () => {
  const cases: [string, number[]][] = [
    ["empty", []],
    ["a run of 4 stays literal", [1, 1, 1, 1]],
    ["a run of 5 is encoded", [1, 1, 1, 1, 1]],
    ["two EDs are encoded", [0xed, 0xed]],
    ["a lone ED before a run", [0xed, 0, 0, 0, 0, 0, 0]],
    ["ED at the end", [7, 0xed]],
    ["three EDs", [0xed, 0xed, 0xed, 1]],
    ["a run longer than 255", new Array(600).fill(9)],
    ["ED then ED ED", [0xed, 5, 0xed, 0xed, 0xed]],
    ["zeros before the end", [1, 2, 0, 0]]
  ];

  it.each(cases)("round-trips %s", (_name, data) => {
    const bytes = Uint8Array.from(data);
    expect(decompressZ80DataBlock(compressZ80DataBlock(bytes))).toEqual(bytes);
    expect(decompressZ80DataBlock(compressZ80DataBlock(bytes, true), true)).toEqual(bytes);
  });

  it("encodes the spec's example: ED followed by a run is ED, the byte, then the rest", () => {
    expect([...compressZ80DataBlock(Uint8Array.from([0xed, 0, 0, 0, 0, 0, 0]))]).toEqual([
      0xed, 0, 0xed, 0xed, 5, 0
    ]);
  });

  it("round-trips random banks, and banks rich in ED and zero", () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16;
    for (let n = 0; n < 20; n++) {
      const bank = new Uint8Array(0x4000);
      const palette = n % 2 ? [0, 0xed, 0xed, 1] : [0, 0xed];
      for (let i = 0; i < bank.length; i++) {
        bank[i] = n < 10 ? rnd() & 0xff : palette[rnd() % palette.length];
      }
      expect(decompressZ80DataBlock(compressZ80DataBlock(bank))).toEqual(bank);
    }
  });
});

describe(".sna writer", () => {
  it("writes a 48K file equal to the builder's, with PC pushed", () => {
    const t = state48();
    const s = model(t, "48k");
    const { bytes, losses } = writeSpectrumSnapshot(s, "sna");
    expect(bytes.length).toBe(SNA_48K_SIZE);
    expect(bytes).toEqual(buildSna48(t));
    expect(losses).toEqual([]);
  });

  it("does not touch the model's RAM or SP (D5)", () => {
    const s = model(state48(), "48k");
    const before = s.ram.get(0)!.slice();
    writeSpectrumSnapshot(s, "sna");
    expect(s.ram.get(0)).toEqual(before);
    expect(s.cpu.sp).toBe(0xff40);
  });

  it("round-trips a 48K state", () => {
    const s = model(state48(), "48k");
    const { parsed } = roundTrip(s, "sna");
    expectSameCpu(s, parsed);
    // --- The two stack bytes below SP hold the pushed PC; everything else is the same
    const sp = s.cpu.sp - 2;
    const expected = s.ram.get(0)!.slice();
    expected[sp & 0x3fff] = s.cpu.pc & 0xff;
    expected[(sp + 1) & 0x3fff] = s.cpu.pc >> 8;
    expect(parsed.ram.get(0)).toEqual(expected);
    expect(parsed.ram.get(5)).toEqual(s.ram.get(5));
  });

  it.each([0x0000, 0xfffe])("accepts SP = %i (the push stays in RAM)", (sp) => {
    const s = model(state48({ sp }), "48k");
    const { parsed } = roundTrip(s, "sna");
    expect(parsed.cpu.sp).toBe(sp);
    expect(parsed.cpu.pc).toBe(s.cpu.pc);
  });

  it.each([0x4000, 0x4001, 0x3000, 0x0001])("refuses SP = $%s, whose push would land in ROM", (sp) => {
    const s = model(state48({ sp }), "48k");
    expect(() => writeSpectrumSnapshot(s, "sna")).toThrow(SnapshotRefusedError);
  });

  it("reports IFF1 ≠ IFF2, the frame position and the EI delay as losses", () => {
    const s = model(state48({ iff1: false, iff2: true, frameTact: 1234, suppressInterrupt: true }), "48k");
    const { losses } = writeSpectrumSnapshot(s, "sna");
    expect(losses.join("\n")).toMatch(/IFF1/);
    expect(losses.join("\n")).toMatch(/T-state 1234/);
    expect(losses.join("\n")).toMatch(/EI/);
  });

  it("is not lossy because of HALT (PC stays on the HALT opcode)", () => {
    const s = model(state48({ halted: true }), "48k");
    expect(writeSpectrumSnapshot(s, "sna").losses).toEqual([]);
  });

  it("writes a 16K as a 48K with zeroed upper RAM, with a loss", () => {
    const s = model(state48({ sp: 0x7ff0 }), "16k");
    const { written, parsed } = roundTrip(s, "sna");
    expect(written.losses.join()).toMatch(/16K/);
    expect(parsed.machine).toBe("48k");
    expect(parsed.ram.get(2)!.every((b) => b === 0)).toBe(true);
  });

  it("writes a 128K file equal to the builder's", () => {
    const t = state128({ port7ffd: 0x13, ay: undefined });
    const { bytes, losses } = writeSpectrumSnapshot(model(t, "128k"), "sna");
    expect(bytes.length).toBe(SNA_128K_SIZE);
    expect(bytes).toEqual(buildSna128(t));
    expect(losses).toEqual([]);
  });

  it.each([2, 5])("writes the long 128K layout when bank %i is paged", (paged) => {
    const t = state128({ port7ffd: 0x10 | paged, ay: undefined });
    const s = model(t, "128k");
    const { written, parsed } = roundTrip(s, "sna");
    expect(written.bytes.length).toBe(SNA_128K_LONG_SIZE);
    expect(written.bytes).toEqual(buildSna128(t));
    expectSameRam(s, parsed);
    expect(parsed.paging?.port7ffd).toBe(0x10 | paged);
  });

  it("reports the AY registers as a loss on a 128K", () => {
    const { losses } = writeSpectrumSnapshot(model(state128(), "128k"), "sna");
    expect(losses.join()).toMatch(/AY/);
  });

  it("writes a +3E in normal paging as a 128K, with a loss", () => {
    const s = model(state128({ port1ffd: 0x04 }), "plus3e");
    const { written, parsed } = roundTrip(s, "sna");
    expect(written.losses.join()).toMatch(/\$1FFD/);
    expect(parsed.machine).toBe("128k");
  });

  it("refuses a +3E in special paging", () => {
    const s = model(state128({ port1ffd: 0x01 }), "plus3e");
    expect(() => writeSpectrumSnapshot(s, "sna")).toThrow(/special paging/);
  });
});

describe(".z80 writer", () => {
  it.each([0, 1, 224, 17471, 17472, 30000, 69887])(
    "encodes frame tact %i so the parser reads it back (48K)",
    (tact) => {
      const s = model(state48({ frameTact: tact }), "48k");
      const { parsed } = roundTrip(s, "z80");
      expect(parsed.ula.frameTact).toBe(tact);
    }
  );

  it.each([0, 17726, 17727, 70907])("encodes frame tact %i on a 128K", (tact) => {
    const { parsed } = roundTrip(model(state128({ frameTact: tact }), "128k"), "z80");
    expect(parsed.ula.frameTact).toBe(tact);
  });

  it("puts the high counter at 3 just after the interrupt (spec)", () => {
    expect(z80TStateCounter(0, false)).toEqual({ low: 17471, high: 3 });
  });

  it.each<[SnapshotMachineKind, SnapshotMachineKind]>([
    ["16k", "16k"],
    ["48k", "48k"],
    ["48k-ntsc", "48k"],
    ["128k", "128k"],
    ["plus2", "plus2"],
    ["plus2a", "plus2a"],
    ["plus3", "plus3"]
  ])("round-trips a %s state as a %s", (machine, readBack) => {
    const t = machine === "16k" || machine.startsWith("48k") ? state48({ frameTact: 999 }) : state128({ frameTact: 999, port1ffd: 0x04 });
    const s = model(t, machine);
    const { written, parsed } = roundTrip(s, "z80");
    expect(parsed.formatVersion).toBe("v3");
    expect(parsed.machine).toBe(readBack);
    expectSameCpu(s, parsed);
    expectSameRam(s, parsed);
    expect(parsed.ula.border).toBe(s.ula.border);
    expect(parsed.ula.frameTact).toBe(999);
    if (s.paging) expect(parsed.paging?.port7ffd).toBe(s.paging.port7ffd);
    if (machine === "plus2a" || machine === "plus3") expect(parsed.paging?.port1ffd).toBe(0x04);
    if (s.ay) {
      expect(parsed.ay?.selected).toBe(s.ay.selected);
      expect(parsed.ay?.regs).toEqual(s.ay.regs);
    }
    expect(written.losses.length > 0).toBe(machine === "48k-ntsc");
  });

  it("names a +3E with drives a +3 and a +2E a +2A, with a loss", () => {
    const withDrive = model(state128(), "plus3e", {
      peripherals: { plus3: { drives: 1, motorOn: false, disks: [] } }
    });
    const r1 = roundTrip(withDrive, "z80");
    expect(r1.parsed.machine).toBe("plus3");
    expect(r1.written.losses.join()).toMatch(/\+3e/);
    const r2 = roundTrip(model(state128(), "plus3e"), "z80");
    expect(r2.parsed.machine).toBe("plus2a");
    expect(r2.written.losses.join()).toMatch(/\+2E/);
  });

  it("keeps an add-on AY of a 48K", () => {
    const s = model(state48(), "48k", {
      ay: { selected: 3, regs: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0]), on48k: true }
    });
    const { parsed } = roundTrip(s, "z80");
    expect(parsed.ay?.on48k).toBe(true);
    expect(parsed.ay?.regs).toEqual(s.ay!.regs);
  });

  it("stores an incompressible page raw", () => {
    const t = state48();
    let seed = 7;
    const noisy = new Uint8Array(0x4000).map(() => (seed = (seed * 75 + 74) % 65537) & 0xff);
    t.ram.set(2, noisy);
    const { parsed } = roundTrip(model(t, "48k"), "z80");
    expect(parsed.ram.get(2)).toEqual(noisy);
  });

  it("reports the EI delay and media as losses", () => {
    const s = model(state128({ suppressInterrupt: true }), "128k", {
      peripherals: { tape: { currentBlock: 2, fileName: "game.tzx" } }
    });
    const { losses } = writeSpectrumSnapshot(s, "z80");
    expect(losses.join("\n")).toMatch(/EI/);
    expect(losses.join("\n")).toMatch(/game\.tzx/);
  });
});

describe(".szx writer", () => {
  it.each<SnapshotMachineKind>(["16k", "48k", "48k-ntsc", "128k", "plus2", "plus2a", "plus3", "plus3e"])(
    "round-trips a %s state without losses",
    (machine) => {
      const small = machine === "16k" || machine.startsWith("48k");
      const t = small
        ? state48({ frameTact: 4321, memptr: 0xbeef, suppressInterrupt: true })
        : state128({ frameTact: 4321, memptr: 0xbeef, halted: true, port1ffd: 0x05 });
      const s = model(t, machine);
      s.ula.lastFe = 0x1b;
      const { written, parsed } = roundTrip(s, "szx");
      expect(written.losses).toEqual([]);
      expect(parsed.machine).toBe(machine);
      expectSameCpu(s, parsed);
      expectSameRam(s, parsed);
      expect(parsed.cpu.memptr).toBe(0xbeef);
      expect(parsed.cpu.halted).toBe(!!t.halted);
      expect(parsed.cpu.suppressInterrupt).toBe(!!t.suppressInterrupt);
      expect(parsed.ula).toMatchObject({ border: s.ula.border, frameTact: 4321, lastFe: 0x1b });
      if (!small) {
        expect(parsed.paging?.port7ffd).toBe(s.paging!.port7ffd);
        expect(parsed.ay?.regs).toEqual(s.ay!.regs);
        expect(parsed.ay?.selected).toBe(s.ay!.selected);
      }
      if (machine === "plus2a" || machine === "plus3" || machine === "plus3e") {
        expect(parsed.paging?.port1ffd).toBe(0x05);
      }
      expect(parsed.creator).toBe("Klive IDE 0.0");
      expect(parsed.warnings).toEqual([]);
    }
  );

  it("writes the creator it is given", () => {
    const { bytes } = writeSpectrumSnapshot(model(state48(), "48k"), "szx", {
      name: "Klive IDE",
      major: 1,
      minor: 7
    });
    expect(parseSpectrumSnapshot("x.szx", bytes).creator).toBe("Klive IDE 1.7");
  });

  it("writes HALT rather than the EI delay when both are set (they are exclusive)", () => {
    const s = model(state48({ halted: true, suppressInterrupt: true }), "48k");
    const { parsed } = roundTrip(s, "szx");
    expect(parsed.cpu.halted).toBe(true);
    expect(parsed.cpu.suppressInterrupt).toBe(false);
  });

  it("links drives' disks and the tape by file name", () => {
    const s = model(state128(), "plus3e", {
      peripherals: {
        plus3: {
          drives: 2,
          motorOn: true,
          disks: [
            { drive: 0, fileName: "/disks/a.dsk" },
            { drive: 1, fileName: "C:\\disks\\b.dsk", sideB: true }
          ]
        },
        tape: { currentBlock: 3, fileName: "/tapes/game.tzx" }
      }
    });
    const { written, parsed } = roundTrip(s, "szx");
    expect(written.losses).toEqual([]);
    expect(parsed.peripherals.plus3).toEqual({
      drives: 2,
      motorOn: true,
      disks: [
        { drive: 0, fileName: "/disks/a.dsk" },
        { drive: 1, fileName: "C:\\disks\\b.dsk", sideB: true }
      ]
    });
    expect(parsed.peripherals.tape).toEqual({ currentBlock: 3, fileName: "/tapes/game.tzx" });
    // --- Two drives pick the two-drive model when loaded
    expect(mapSpectrumSnapshotToKlive(parsed).modelIds[0]).toBe("fdd2");
  });

  it("embeds a tape that has no file (D17)", () => {
    const tape = patternBank(0x42).slice(0, 1000);
    const s = model(state48(), "48k", {
      peripherals: { tape: { currentBlock: 1, embedded: tape, extension: "TAP" } }
    });
    const { parsed } = roundTrip(s, "szx");
    expect(parsed.peripherals.tape).toEqual({ currentBlock: 1, embedded: tape, extension: "tap" });
  });

  it("reports a disk without a file as a loss", () => {
    const s = model(state128(), "plus3e", {
      peripherals: { plus3: { drives: 1, motorOn: false, disks: [{ drive: 0 }] } }
    });
    expect(writeSpectrumSnapshot(s, "szx").losses.join()).toMatch(/drive A/);
  });

  it("writes no +3 block for a +2E, so it maps back to the +2E", () => {
    const { parsed } = roundTrip(model(state128(), "plus3e"), "szx");
    expect(parsed.chunks?.map((c) => c.id)).not.toContain("+3");
    expect(mapSpectrumSnapshotToKlive(parsed).modelIds[0]).toBe("nofdd");
  });

  it("refuses a model with a missing bank", () => {
    const s = model(state128(), "128k");
    s.ram.delete(6);
    expect(() => writeSpectrumSnapshot(s, "szx")).toThrow(/bank 6/);
  });

  it("refuses an unsupported machine in every format", () => {
    const s = model(state128(), "128k", { machine: { unsupported: "Pentagon 128" } });
    for (const f of ["sna", "z80", "szx"] as const) {
      expect(() => writeSpectrumSnapshot(s, f)).toThrow(/Pentagon/);
    }
  });
});

describe("cross-format", () => {
  it("one 128K state written in all three formats parses to the same machine state", () => {
    const s = model(state128({ ay: undefined, iff1: true, iff2: true }), "128k");
    const results = (["sna", "z80", "szx"] as const).map((f) => roundTrip(s, f).parsed);
    for (const p of results) {
      expectSameCpu(s, p);
      expectSameRam(s, p);
      expect(p.paging?.port7ffd).toBe(s.paging!.port7ffd);
      expect(p.ula.border).toBe(s.ula.border);
    }
  });
});

describe("capture guards", () => {
  /** Fake core exports: every getter returns 0, the prefix the given value */
  function fakeCore(prefix: number) {
    const exports = new Proxy(
      {},
      { get: (_t, name: string) => () => (name === "sp48GetCpuPrefix" ? prefix : 0) }
    );
    return { prefix: "sp48" as const, exports, ram: new Uint8Array(0x10000), modelId: "pal" };
  }

  it("refuses a CPU between a prefix and its opcode", () => {
    expect(() => captureSpectrumSnapshot(fakeCore(1))).toThrow(SnapshotRefusedError);
    expect(() => captureSpectrumSnapshot(fakeCore(1))).toThrow(/step once more/);
  });

  it("captures at an instruction boundary", () => {
    const s = captureSpectrumSnapshot(fakeCore(0), { tapeFile: "t.tap" });
    expect(s.machine).toBe("48k");
    expect([...s.ram.keys()]).toEqual([5, 2, 0]);
    // --- No tape in the deck: the media store's file is not recorded
    expect(s.peripherals.tape).toBeUndefined();
  });
});
