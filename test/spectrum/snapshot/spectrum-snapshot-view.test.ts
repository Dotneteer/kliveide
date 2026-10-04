import { describe, expect, it } from "vitest";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import {
  buildSpectrumAddressSpace,
  decode1ffd,
  decode7ffd,
  decodeAy,
  spectrumAddressLocation,
  spectrumBankItems,
  spectrumPagedRanges,
  spectrumScreenBank
} from "@renderer/appIde/DocumentPanels/Spectrum/spectrumSnapshotView";
import { buildSna48, buildSzx, state128, state48 } from "./builders";

/*
 * The React-free part of the snapshot viewer (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.8, Phase 6).
 */

const snap48 = () => parseSpectrumSnapshot("a.sna", buildSna48(state48()));
const snap128 = (port7ffd: number) => parseSpectrumSnapshot("a.szx", buildSzx(state128({ port7ffd }), { machineId: 2 }));
const snapP3 = (port7ffd: number, port1ffd: number) =>
  parseSpectrumSnapshot("a.szx", buildSzx(state128({ port7ffd, port1ffd }), { machineId: 5 }));

describe("ports", () => {
  it("decodes $7FFD and $1FFD", () => {
    expect(decode7ffd(0x3b)).toEqual({ bank: 3, shadowScreen: true, rom: 1, locked: true });
    expect(decode1ffd(0x0d)).toEqual({ specialPaging: true, config: 2, motorOn: true, printerStrobe: false });
  });
});

describe("paging", () => {
  it("pages a 48K as ROM, 5, 2, 0", () => {
    expect(spectrumPagedRanges(snap48()).map((r) => r.bank ?? `ROM${r.rom}`)).toEqual(["ROM0", 5, 2, 0]);
  });

  it("pages a 128K by $7FFD", () => {
    expect(spectrumPagedRanges(snap128(0x14)).map((r) => r.bank ?? `ROM${r.rom}`)).toEqual(["ROM1", 5, 2, 4]);
  });

  it("pages a +3 by $1FFD's special configurations and its ROM bit", () => {
    const cfg = (c: number) => spectrumPagedRanges(snapP3(0, 0x01 | (c << 1))).map((r) => r.bank);
    expect(cfg(0)).toEqual([0, 1, 2, 3]);
    expect(cfg(1)).toEqual([4, 5, 6, 7]);
    expect(cfg(2)).toEqual([4, 5, 6, 3]);
    expect(cfg(3)).toEqual([4, 7, 6, 3]);
    expect(spectrumPagedRanges(snapP3(0x10, 0x04))[0].rom).toBe(3);
  });

  it("finds the screen bank, PC's bank and the 64K", () => {
    expect(spectrumScreenBank(snap128(0x08))).toBe(7);
    expect(spectrumScreenBank(snap48())).toBe(5);
    const s = snap128(0x13);
    expect(spectrumAddressLocation(s, 0xc123)).toEqual({ bank: 3, rom: undefined, offset: 0x0123 });
    expect(spectrumAddressLocation(s, 0x0010)).toEqual({ bank: undefined, rom: 1, offset: 0x10 });
    const space = buildSpectrumAddressSpace(s);
    expect(space[0x0000]).toBe(0);
    expect(space.subarray(0xc000)).toEqual(s.ram.get(3));
    expect(space.subarray(0x4000, 0x8000)).toEqual(s.ram.get(5));
  });
});

describe("bank items", () => {
  it("lists the banks with where they are paged, PC, SP and the screen", () => {
    const s = snap128(0x13); // --- PC $8123 in bank 2, SP $FF40 in bank 3
    const items = spectrumBankItems(s, { 3: "disassembly" });
    expect(items.map((i) => i.bank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const by = (b: number) => items.find((i) => i.bank === b)!;
    expect(by(2)).toMatchObject({ pagedAt: 0x8000, listedAt: 0x8000, pc: 0x8123 });
    expect(by(3)).toMatchObject({ pagedAt: 0xc000, sp: 0xff40, lastView: "disassembly" });
    expect(by(5).screen).toBe(true);
    expect(by(4)).toMatchObject({ pagedAt: undefined, listedAt: 0xc000, lastView: "memory" });
  });
});

describe("AY", () => {
  it("decodes tone periods, the mixer, volumes and the envelope", () => {
    const regs = new Uint8Array([0x34, 0x12, 0xff, 0x0f, 1, 0, 0x1f, 0b00111010, 0x0f, 0x10, 3, 0x00, 0x10, 0x0e, 0, 0]);
    const ay = decodeAy(regs);
    expect(ay.tone).toEqual([0x234, 0xfff, 1]);
    expect(ay.noise).toBe(0x1f);
    expect(ay.mixer).toEqual([
      { tone: true, noise: false },
      { tone: false, noise: false },
      { tone: true, noise: false }
    ]);
    expect(ay.volume).toEqual([15, "envelope", 3]);
    expect(ay.envelopePeriod).toBe(0x1000);
    expect(ay.envelopeShape).toBe(0x0e);
  });
});
