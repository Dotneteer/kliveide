/*
 * The Interface 1 in snapshots (`.plans/MICRODRIVE_PLAN.md` Phase 5): `.z80` hardware modes 1 and 5
 * with byte 36, the `.szx` IF1 and MDRV blocks, the losses of `.sna` and `.z80`, the mapping and the
 * loader's machine fit.
 */

import { describe, it, expect } from "vitest";
import { zlibSync } from "fflate";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import type {
  SnapshotInterface1,
  SnapshotMachineKind,
  SpectrumSnapshot,
  SpectrumSnapshotFormat
} from "@common/spectrum/snapshot/spectrumSnapshot";
import { fitSpectrumMachine } from "@renderer/appEmu/machines/spectrumSnapshotLoad";
import { MC_DIVMMC, MC_INTERFACE1, MI_SPECTRUM_128, MI_SPECTRUM_48 } from "@common/machines/constants";
import { state128, state48, type TestState } from "./builders";

function model(t: TestState, machine: SnapshotMachineKind, if1?: SnapshotInterface1): SpectrumSnapshot {
  const paged = !["16k", "48k", "48k-ntsc"].includes(machine);
  const ram = new Map<number, Uint8Array>();
  for (const [b, bytes] of t.ram) if (machine !== "16k" || b === 5) ram.set(b, bytes.slice());
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
      iff2: t.iff2
    },
    ula: { border: t.border },
    paging: paged ? { port7ffd: t.port7ffd ?? 0 } : undefined,
    ram,
    ay: paged ? { selected: 0, regs: new Uint8Array(16) } : undefined,
    peripherals: if1 ? { interface1: true, if1 } : {},
    header: [],
    warnings: []
  };
}

function roundTrip(s: SpectrumSnapshot, format: SpectrumSnapshotFormat) {
  const written = writeSpectrumSnapshot(s, format);
  return { written, parsed: parseSpectrumSnapshot(`x.${format}`, written.bytes) };
}

const PAGED: SnapshotInterface1 = { paged: true, drives: 2, microdrives: [] };

describe(".z80 and the Interface 1", () => {
  it.each([
    ["48k", 1, false],
    ["16k", 1, true],
    ["128k", 5, false],
    ["plus2", 5, true]
  ] as const)("writes a %s with an Interface 1 as mode %i (modified %s)", (machine, mode, modified) => {
    const t = machine === "48k" || machine === "16k" ? state48() : state128();
    const { written, parsed } = roundTrip(model(t, machine, PAGED), "z80");
    expect(written.bytes[34]).toBe(mode);
    expect((written.bytes[37] & 0x80) !== 0).toBe(modified);
    expect(written.bytes[36]).toBe(0xff);
    expect(parsed.machine).toBe(machine);
    expect(parsed.peripherals.if1).toEqual({ paged: true, drives: 2, microdrives: [] });
  });

  it("writes byte 36 = 0 when the ROM is paged out, and the plain mode without the interface", () => {
    const out = roundTrip(model(state48(), "48k", { ...PAGED, paged: false }), "z80");
    expect(out.written.bytes[36]).toBe(0);
    expect(out.parsed.peripherals.if1?.paged).toBe(false);
    const plain = roundTrip(model(state128(), "128k"), "z80");
    expect(plain.written.bytes[34]).toBe(4);
    expect(plain.parsed.peripherals.interface1).toBeUndefined();
  });

  it("declares the cartridges and a custom ROM as losses", () => {
    const s = model(state48(), "48k", {
      ...PAGED,
      customRom: new Uint8Array(0x2000),
      microdrives: [{ drive: 0, running: false, position: 3, preamble: 0, fileName: "a.mdr" }]
    });
    const losses = writeSpectrumSnapshot(s, "z80").losses.join("\n");
    expect(losses).toMatch(/Microdrive cartridge/);
    expect(losses).toMatch(/standard Interface 1 ROM/);
  });
});

describe(".sna and the Interface 1", () => {
  it("says it does not record the interface, and when its ROM was paged", () => {
    expect(writeSpectrumSnapshot(model(state48(), "48k", { ...PAGED, paged: false }), "sna").losses.join("\n")).toMatch(
      /does not record the Interface 1$/m
    );
    expect(writeSpectrumSnapshot(model(state48(), "48k", PAGED), "sna").losses.join("\n")).toMatch(/ROM was paged in/);
  });
});

describe(".szx IF1 and MDRV blocks", () => {
  it("round-trips the paging, the drive count and the linked cartridges", () => {
    const if1: SnapshotInterface1 = {
      paged: true,
      drives: 2,
      microdrives: [
        { drive: 0, running: true, position: 117, preamble: 0, fileName: "/carts/games.mdr" },
        { drive: 1, running: false, position: 0, preamble: 0, fileName: "work.mdr" }
      ]
    };
    const { written, parsed } = roundTrip(model(state128(), "128k", if1), "szx");
    expect(written.losses).toEqual([]);
    expect(parsed.peripherals.interface1).toBe(true);
    expect(parsed.peripherals.if1).toEqual(if1);
    expect(parsed.chunks?.filter((c) => c.id === "IF1" || c.id === "MDRV").every((c) => c.known)).toBe(true);
    expect(parsed.warnings).toEqual([]);
  });

  it("embeds a custom ROM compressed, and leaves the standard one out", () => {
    const rom = new Uint8Array(0x2000).map((_, i) => i & 0xff);
    const custom = roundTrip(model(state48(), "48k", { ...PAGED, customRom: rom }), "szx").parsed;
    expect(custom.peripherals.if1?.customRom).toEqual(rom);
    const standard = roundTrip(model(state48(), "48k", PAGED), "szx");
    const ifBlock = standard.parsed.chunks?.find((c) => c.id === "IF1");
    expect(ifBlock?.size).toBe(40);
  });

  it("reports a cartridge without a file as a loss", () => {
    const s = model(state48(), "48k", { ...PAGED, microdrives: [{ drive: 1, running: false, position: 0, preamble: 0 }] });
    expect(writeSpectrumSnapshot(s, "szx").losses.join("\n")).toMatch(/Microdrive 2 has no file/);
  });

  it("ignores an IF1 block with the interface switched off, and reads a zlib ROM", () => {
    const base = writeSpectrumSnapshot(model(state48(), "48k"), "szx").bytes;
    const block = (flags: number, rom?: Uint8Array) => {
      const packed = rom ? zlibSync(rom) : new Uint8Array(0);
      const data = new Uint8Array(40 + packed.length);
      data[0] = flags;
      data[2] = 2;
      if (rom) {
        data[38] = rom.length & 0xff;
        data[39] = rom.length >> 8;
      }
      data.set(packed, 40);
      const out = new Uint8Array(8 + data.length);
      out.set([0x49, 0x46, 0x31, 0], 0);
      new DataView(out.buffer).setUint32(4, data.length, true);
      out.set(data, 8);
      return out;
    };
    const join = (extra: Uint8Array) => {
      const all = new Uint8Array(base.length + extra.length);
      all.set(base);
      all.set(extra, base.length);
      return parseSpectrumSnapshot("x.szx", all);
    };
    expect(join(block(0x00)).peripherals.if1).toBeUndefined();
    const rom = new Uint8Array(0x2000).fill(0x5a);
    expect(join(block(0x01 | 0x02 | 0x04, rom)).peripherals.if1).toMatchObject({ paged: true, drives: 2, customRom: rom });
  });
});

describe("mapping and machine fit", () => {
  it("loads a 48K or 128K Interface 1 snapshot without a warning, and warns on the Pentagon", () => {
    expect(mapSpectrumSnapshotToKlive(model(state48(), "48k", PAGED)).warnings).toEqual([]);
    expect(mapSpectrumSnapshotToKlive(model(state128(), "128k", PAGED)).warnings).toEqual([]);
    expect(mapSpectrumSnapshotToKlive(model(state128(), "pentagon", PAGED)).warnings.join("\n")).toMatch(/Interface 1/);
  });

  it("connects the Interface 1 and disconnects the DivMMC", () => {
    const s = model(state48(), "48k", PAGED);
    const fit = fitSpectrumMachine(
      { machineId: MI_SPECTRUM_48, modelId: "pal", config: { [MC_DIVMMC]: true } },
      mapSpectrumSnapshotToKlive(s),
      s,
      false
    );
    expect(fit.rebuild).toBe(true);
    expect(fit.config[MC_INTERFACE1]).toBe(true);
    expect(fit.config[MC_DIVMMC]).toBeUndefined();
    expect(fit.warnings.join("\n")).toMatch(/DivMMC is disconnected/);
  });

  it("keeps a machine that already has the interface, and leaves it on for a snapshot without one", () => {
    const withIf1 = { machineId: MI_SPECTRUM_128, modelId: "sp128", config: { [MC_INTERFACE1]: true } };
    const s = model(state128(), "128k", PAGED);
    expect(fitSpectrumMachine(withIf1, mapSpectrumSnapshotToKlive(s), s, false).rebuild).toBe(false);
    const plain = model(state128(), "128k");
    const fit = fitSpectrumMachine(withIf1, mapSpectrumSnapshotToKlive(plain), plain, false);
    expect(fit.rebuild).toBe(false);
    expect(fit.config[MC_INTERFACE1]).toBe(true);
  });
});
