import { describe, expect, it } from "vitest";

import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { ScorpionWasmV2Machine } from "@emu/machines/zxSpectrum128/ScorpionWasmV2Machine";
import { createSp128Session, type Sp128TestSession } from "../../harness/sp128";
import { buildTestTrdosRom, ENTRY } from "../beta128/test-rom";

/*
 * The Scorpion ZS-256 (`.plans/TIMEX_SCORPION_PLAN.md` G9.4c, §8), on the 128K's core. Its
 * programmer's guide: $7FFD answers with A0, A2, A5, A12, A14 high and A1, A15 low; $1FFD with A0,
 * A2, A5, A12 high and A1, A14, A15 low; $1FFD bit 0 puts RAM bank 0 at $0000, bit 1 the service ROM,
 * bit 4 adds 8 to the bank at $C000. $0000 shows RAM 0, else the service ROM, else TR-DOS, else ROM 0/1.
 * The timing is checked with the 128K and the Pentagon in `pentagon-timing.test.ts`.
 */

type X = Record<string, (...args: number[]) => number>;
const exportsOf = (s: Sp128TestSession) => s.machine.wasmV2Runtime!.exports as unknown as X;
const scorpion = (s: Sp128TestSession) => s.machine as ScorpionWasmV2Machine;

/** A 64K Scorpion ROM made by the test: 128K ROMs' stand-ins with a marker, service $5E, TR-DOS given */
function testScorpionRom(trdos?: Uint8Array): Uint8Array {
  const rom = new Uint8Array(0x10000);
  rom.fill(0x01, 0x0000, 0x4000); // --- "128K editor": never booted here
  rom.fill(0x02, 0x4000, 0x8000);
  rom.fill(0x5e, 0x8000, 0xc000); // --- the service monitor
  if (trdos) rom.set(trdos, 0xc000);
  return rom;
}

async function boot(): Promise<{ s: Sp128TestSession; x: X }> {
  const s = await createSp128Session("scorpion");
  s.runFrames(150);
  return { s, x: exportsOf(s) };
}

describe("Scorpion ZS-256 paging", () => {
  it("is its own machine on the 128K core, booting the 128K ROMs without its own", async () => {
    const { s, x } = await boot();
    expect(s.machine.machineId).toBe("scorpion");
    expect(x.sp128GetScorpion()).toBe(1);
    expect(scorpion(s).romInUse).toBe("sp128");
    expect(x.sp128GetRamSize()).toBe(0x40000);
  });

  it("$1FFD bit 4 with $7FFD bits 0-2 pages each of the sixteen banks at $C000", async () => {
    const { s, x } = await boot();
    for (let bank = 0; bank < 16; bank++) x.sp128WriteRamBank(bank, 0x123, 0xa0 + bank);
    for (let bank = 0; bank < 16; bank++) {
      x.sp128WritePort(0x1ffd, bank & 0x08 ? 0x10 : 0x00);
      x.sp128WritePort(0x7ffd, bank & 0x07);
      expect(x.sp128ReadMemory(0xc123), `bank ${bank}`).toBe(0xa0 + bank);
      expect(x.sp128GetSelectedBank()).toBe(bank);
      expect(scorpion(s).getCurrentPartitionLabels()[6]).toBe(`B${bank}`);
    }
  });

  it("$1FFD bit 0 puts RAM bank 0 at $0000 (writable), over the service ROM and the ROMs", async () => {
    const { s, x } = await boot();
    x.sp128WriteRamBank(0, 0x0010, 0x77);
    const rom0 = x.sp128ReadMemory(0x0010);
    x.sp128WritePort(0x1ffd, 0x03);
    expect(x.sp128ReadMemory(0x0010)).toBe(0x77);
    x.sp128WriteMemory(0x0011, 0x88);
    expect(x.sp128ReadRamBank(0, 0x0011)).toBe(0x88);
    expect(scorpion(s).getCurrentPartitionLabels()[0]).toBe("B0");
    expect(scorpion(s).getRomFlags().slice(0, 2)).toEqual([false, false]);
    // --- Bank 0 also at $C000: both views stay one bank
    x.sp128WritePort(0x7ffd, 0x00);
    x.sp128WriteMemory(0xc012, 0x99);
    expect(x.sp128ReadMemory(0x0012)).toBe(0x99);
    expect(s.machine.get64KFlatMemory()[0x0012]).toBe(0x99);
    x.sp128WritePort(0x1ffd, 0x00);
    expect(x.sp128ReadMemory(0x0010)).toBe(rom0);
    expect(scorpion(s).getRomFlags().slice(0, 2)).toEqual([true, true]);
  });

  it("$1FFD bit 1 puts the service ROM at $0000; without the Scorpion ROM it reads $FF", async () => {
    const { s, x } = await boot();
    x.sp128WritePort(0x1ffd, 0x02);
    expect(x.sp128ReadMemory(0x0000)).toBe(0xff);
    expect(scorpion(s).getCurrentPartitionLabels()[0]).toBe("R2");
    x.sp128WriteMemory(0x0000, 0x12); // --- a ROM
    expect(x.sp128ReadMemory(0x0000)).toBe(0xff);

    const own = await createSp128Session("scorpion", { scorpionRom: testScorpionRom() });
    const y = exportsOf(own);
    expect(scorpion(own).romInUse).toBe("scorpion");
    y.sp128WritePort(0x1ffd, 0x02);
    expect(y.sp128ReadMemory(0x1234)).toBe(0x5e);
    expect(scorpion(own).getMemoryPartition(-3)[0]).toBe(0x5e);
  });

  it("decodes its ports on more lines than the 128K: $7FF9 and $3FFD do not page", async () => {
    const { x } = await boot();
    x.sp128WritePort(0x7ffd, 0x01);
    expect(x.sp128GetSelectedBank()).toBe(1);
    x.sp128WritePort(0x7ff9, 0x02); // --- A2 low: not the Scorpion's $7FFD
    x.sp128WritePort(0x3ffd, 0x03); // --- A14 low, A12 high: the Scorpion's $1FFD, not $7FFD
    expect(x.sp128GetSelectedBank()).toBe(1);
    expect(x.sp128GetPort1ffd()).toBe(0x03);
    x.sp128WritePort(0x1ffd, 0x00);
    // --- The 128K decodes $7FF9 as $7FFD, and has no $1FFD
    const k = await createSp128Session("sp128");
    const kx = exportsOf(k);
    kx.sp128WritePort(0x7ff9, 0x02);
    expect(kx.sp128GetSelectedBank()).toBe(2);
    kx.sp128WritePort(0x1ffd, 0x01);
    expect(kx.sp128GetPort1ffd()).toBe(0);
  });

  it("$7FFD bit 5 locks $7FFD, not $1FFD", async () => {
    const { x } = await boot();
    x.sp128WritePort(0x7ffd, 0x20 | 0x02);
    x.sp128WritePort(0x7ffd, 0x05);
    expect(x.sp128GetSelectedBank()).toBe(2);
    x.sp128WritePort(0x1ffd, 0x10);
    expect(x.sp128GetSelectedBank()).toBe(10);
  });

  it("names its partitions R0-R3 and B0-B15", async () => {
    const { s } = await boot();
    const labels = scorpion(s).getPartitionLabels();
    expect([labels[-1], labels[-2], labels[-3], labels[-4], labels[0], labels[15]]).toEqual(["R0", "R1", "R2", "R3", "B0", "B15"]);
    expect(scorpion(s).parsePartitionLabel("b12")).toBe(12);
    expect(scorpion(s).parsePartitionLabel("R3")).toBe(-4);
    expect(scorpion(s).getMemoryPartition(13)).toHaveLength(0x4000);
  });
});

describe("Scorpion ZS-256 Beta 128", () => {
  it("takes TR-DOS from its own ROM and pages it in from $3D00 with 48K BASIC; RAM 0 and the service ROM block it", async () => {
    const trdos = await buildTestTrdosRom();
    const s = await createSp128Session("scorpion", { scorpionRom: testScorpionRom(trdos) });
    const x = exportsOf(s);
    expect(scorpion(s).beta128Active).toBe(true);
    expect(x.sp128BetaGetEnabled()).toBe(1);
    // --- ROM 1 (48K BASIC) selected, and a fetch at $3D00
    x.sp128WritePort(0x7ffd, 0x10);
    x.sp128SetCpuHalted(0);
    x.sp128SetCpuIff1(0);
    x.sp128SetCpuPc(ENTRY.STATUS);
    s.step(1);
    expect(x.sp128BetaGetPaged()).toBe(1);
    expect(scorpion(s).getCurrentPartitionLabels()[0]).toBe("R3");
    // --- Back to RAM: out
    x.sp128SetCpuPc(0x8000);
    s.poke(0x8000, [0x00, 0x00]);
    s.step(1);
    expect(x.sp128BetaGetPaged()).toBe(0);
    // --- With RAM at $0000, a $3Dxx fetch is RAM's, and TR-DOS stays out
    x.sp128WritePort(0x1ffd, 0x01);
    x.sp128WriteRamBank(0, 0x3d00, 0x00);
    x.sp128SetCpuPc(0x3d00);
    s.step(1);
    expect(x.sp128BetaGetPaged()).toBe(0);
  });

  it("without its own ROM, takes TR-DOS from the TR-DOS ROM setting, as the Pentagon does", async () => {
    const s = await createSp128Session("scorpion", { trdosRom: await buildTestTrdosRom() });
    expect(scorpion(s).beta128Active).toBe(true);
    const none = await createSp128Session("scorpion");
    expect(scorpion(none).beta128Active).toBe(false);
  });
});

describe("Scorpion ZS-256 flows and snapshots", () => {
  it("runs the 128K's flows on the 128K ROMs, and refuses them on its own ROM", async () => {
    const { s } = await boot();
    expect((await s.machine.getCodeInjectionFlow("sp128"))[0]).toMatchObject({ type: "ReachExecPoint" });
    expect((await s.machine.getCodeInjectionFlow("scorpion"))[0]).toMatchObject({ type: "ReachExecPoint" });
    const own = await createSp128Session("scorpion", { scorpionRom: testScorpionRom() });
    await expect(own.machine.getCodeInjectionFlow("sp128")).rejects.toThrow(/Scorpion ROM/);
    expect(() => own.machine.getTapeLoadFlow!()).toThrow(/Scorpion ROM/);
  });

  it("keeps the 48K BASIC page's tape traps only for a ROM whose tape routines are the 48K's", async () => {
    const own = await createSp128Session("scorpion", { scorpionRom: testScorpionRom() });
    // --- The test ROM's 48K page is $02 everywhere: no LD-BYTES, so no trap
    const x = exportsOf(own);
    x.sp128WritePort(0x7ffd, 0x10);
    x.sp128SetCpuPc(0x056c);
    own.step(1);
    expect(x.sp128TapeGetLoadStartCount()).toBe(0);
  });

  for (const format of ["szx", "z80"] as const) {
    it(`a .${format} keeps the sixteen banks and $1FFD`, async () => {
      const { s, x } = await boot();
      for (let bank = 0; bank < 16; bank++) x.sp128WriteRamBank(bank, 0x2000, 0x30 + bank);
      x.sp128WritePort(0x7ffd, 0x04);
      x.sp128WritePort(0x1ffd, 0x11); // --- bank 12 at $C000, RAM 0 at $0000
      const { bytes } = s.saveSnapshot(format);
      const parsed = parseSpectrumSnapshot(`s.${format}`, bytes);
      expect(parsed.machine).toBe("scorpion");
      expect(parsed.ram.size).toBe(16);
      expect(parsed.paging).toEqual({ port7ffd: 0x04, port1ffd: 0x11 });
      expect(mapSpectrumSnapshotToKlive(parsed)).toMatchObject({ machineId: "scorpion", errors: [] });

      const t = await createSp128Session("scorpion");
      t.loadSnapshot(`s.${format}`, bytes);
      const y = exportsOf(t);
      expect([y.sp128GetSelectedBank(), y.sp128GetPort1ffd()]).toEqual([12, 0x11]);
      for (let bank = 0; bank < 16; bank++) expect(y.sp128ReadRamBank(bank, 0x2000), `bank ${bank}`).toBe(0x30 + bank);
      expect(y.sp128ReadMemory(0x2000)).toBe(0x30);
    });
  }

  it("a .sna refuses $1FFD in use, and otherwise loads as a 128K", async () => {
    const { s, x } = await boot();
    x.sp128WritePort(0x1ffd, 0x10);
    expect(() => s.saveSnapshot("sna")).toThrow(/\$1FFD/);
    x.sp128WritePort(0x1ffd, 0x00);
    const { bytes, losses } = s.saveSnapshot("sna");
    expect(losses.join("\n")).toMatch(/banks 8-15/);
    expect(parseSpectrumSnapshot("s.sna", bytes).machine).toBe("128k");
  });
});
