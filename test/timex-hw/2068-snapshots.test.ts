import { describe, expect, it } from "vitest";

import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { DCK_BANK_DOCK } from "@common/timex/dckFile";
import { createTimexSession, type TimexTestSession } from "../harness/timex";

/*
 * 2068 snapshots (`.plans/TIMEX_SCORPION_PLAN.md` G9.4b Phase 5): `.szx` machines 9 (TC2068) and 12
 * (TS2068) with the SCLD block, the AY block and a DOCK block per cartridge page; `.z80` hardware
 * modes 15 and 128 with $F4/$FF in bytes 35/36 and the AY in the header (no cartridge); `.sna` as a
 * 48K, with the losses named.
 */

/** A 2068 with a cartridge (ROM chunk 4, RAM chunk 5 written to), chunks 4-5 mapped, an AY tone */
async function busy2068(model: "tc2068" | "ts2068"): Promise<TimexTestSession> {
  const s = await createTimexSession({ model });
  s.bootToBasic();
  const rom = new Uint8Array(0x2000).fill(0x4c);
  s.insertCartridge({
    banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [0, 0, 0, 0, 2, 1, 0, 0], chunks: [, , , , rom] as never }]
  });
  s.out(0x00f4, 0x30);
  s.timex.doWriteMemory(0xa010, 0x99);
  s.out(0x00f5, 0).out(0x00f6, 0x40).out(0x00f5, 8).out(0x00f6, 0x0c).out(0x00f5, 7);
  s.out(0x00ff, 0x02);
  return s;
}

describe("2068 snapshots", () => {
  for (const [model, szxId, z80Mode] of [["tc2068", 9, 15], ["ts2068", 12, 128]] as const) {
    it(`${model}: a .szx keeps the machine, $F4, $FF, the AY and the cartridge`, async () => {
      const s = await busy2068(model);
      const { bytes, losses } = s.saveSnapshot("szx");
      expect(losses).toEqual([]);
      expect(bytes[6]).toBe(szxId);
      const parsed = parseSpectrumSnapshot("t.szx", bytes);
      expect(parsed.machine).toBe(model);
      expect(parsed.timex).toMatchObject({ portF4: 0x30, portFf: 0x02 });
      expect(parsed.timex?.dock?.map((p) => [p.page, p.ram])).toEqual([[4, false], [5, true]]);
      expect(parsed.ay?.on48k).toBeUndefined();
      expect(mapSpectrumSnapshotToKlive(parsed)).toMatchObject({ machineId: "timex", modelIds: [model], errors: [] });

      const t = await createTimexSession({ model });
      t.loadSnapshot("t.szx", bytes);
      expect([t.exports.timexGetPortF4(), t.portFf]).toEqual([0x30, 0x02]);
      expect([t.cpuPeek(0x8000), t.cpuPeek(0xa010)]).toEqual([0x4c, 0x99]);
      expect([t.exports.timexGetPsgRegisterValue(0), t.exports.timexGetPsgRegisterValue(8)]).toEqual([0x40, 0x0c]);
      expect(t.exports.timexGetPsgRegisterIndex()).toBe(7);
      expect(t.machine.pc).toBe(s.machine.pc);
    });

    it(`${model}: a .z80 (mode ${z80Mode}) keeps $F4, $FF and the AY, and names the cartridge it drops`, async () => {
      const s = await busy2068(model);
      const { bytes, losses } = s.saveSnapshot("z80");
      expect(losses.join("\n")).toMatch(/cartridge/);
      expect(bytes[34]).toBe(z80Mode);
      const parsed = parseSpectrumSnapshot("t.z80", bytes);
      expect(parsed.machine).toBe(model);
      expect(parsed.timex).toEqual({ portF4: 0x30, portFf: 0x02 });
      expect(parsed.ay?.regs[0]).toBe(0x40);
      expect(parsed.ay?.on48k).toBeUndefined();
      expect(parsed.peripherals.interface1).toBeUndefined();

      const t = await createTimexSession({ model });
      t.loadSnapshot("t.z80", bytes);
      expect([t.exports.timexGetPortF4(), t.portFf]).toEqual([0x30, 0x02]);
      expect(t.exports.timexGetPsgRegisterValue(8)).toBe(0x0c);
      expect(t.machine.pc).toBe(s.machine.pc);
    });
  }

  it("a .sna of a 2068 loads as a 48K and names what it loses", async () => {
    const s = await busy2068("ts2068");
    const { bytes, losses } = s.saveSnapshot("sna");
    const all = losses.join("\n");
    expect(all).toMatch(/Timex layout/);
    expect(all).toMatch(/port \$F4/);
    expect(all).toMatch(/cartridge/);
    expect(all).toMatch(/AY/);
    expect(parseSpectrumSnapshot("t.sna", bytes).machine).toBe("48k");
  });

  it("a 2068 state file keeps the chunk map, the AY and the cartridge", async () => {
    const s = await busy2068("ts2068");
    const state = s.timex.saveMachineState();
    const t = await createTimexSession({ model: "ts2068" });
    t.bootToBasic();
    t.timex.loadMachineState(state);
    expect([t.exports.timexGetPortF4(), t.cpuPeek(0x8000), t.cpuPeek(0xa010)]).toEqual([0x30, 0x4c, 0x99]);
    expect(t.exports.timexGetPsgRegisterValue(0)).toBe(0x40);
  });
});
