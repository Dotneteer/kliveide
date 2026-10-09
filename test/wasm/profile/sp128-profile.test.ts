import { beforeAll, describe, expect, it } from "vitest";
import { PF_CODE, PF_EXECUTED, PF_READ, PF_SELF_MODIFIED, PF_WRITTEN } from "@common/profile/profileTypes";
import { profileOffsetOf, type ProfileLayout } from "@common/profile/layouts/profileLayout";
import { scorpionProfileLayout, sp128ProfileLayout } from "@common/profile/layouts/sp128";
import { createSp128Session, type Sp128TestSession } from "../../harness/sp128";
import { buildTestTrdosRom, ENTRY } from "../../sp128-hw/beta128/test-rom";
import { checkCallEdge, checkMapping, checkTimeSums, jump, out, profiled } from "./pagedSpectrumProfile";

/*
 * The access profile on the 128K core (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` Phase 2): the ZX
 * Spectrum 128K, the Pentagon 128 and the Scorpion ZS-256. The offsets are physical - RAM, the ROMs,
 * TR-DOS - mapped through the slot map, never the flat `sp128Memory` copy (trap T3).
 */

const E = PF_EXECUTED;
const C = PF_CODE;
const R = PF_READ;
const W = PF_WRITTEN;
const S = PF_SELF_MODIFIED;

const PROGRAM = `
        .org $8000
Main:   di
        ld hl,Data
        ld a,(hl)
        ld (Data2),a
        ld a,$c9
        ld (Patch),a
        call Patch
End:    jr End
        .org $c000
Patch:  nop
Data:   .defb 1,2
Data2:  .defb 0
`;

const MODELS = [
  { model: "sp128", layout: sp128ProfileLayout, banks: 8 },
  { model: "pentagon", layout: sp128ProfileLayout, banks: 8 },
  { model: "scorpion", layout: scorpionProfileLayout, banks: 16 }
] as const;

async function boot(model: (typeof MODELS)[number]["model"], trdosRom?: Uint8Array): Promise<Sp128TestSession> {
  const s = await createSp128Session(model, trdosRom ? { trdosRom } : {});
  s.runFrames(50);
  return s;
}

describe.each(MODELS)("the access profile on the $model", ({ model, layout, banks }) => {
  let s: Sp128TestSession;
  const at = (partition: number, address: number) => profileOffsetOf(layout, partition, address)!;
  const flagAt = (partition: number, address: number) => s.machine.readProfileFlags(at(partition, address), 1)![0];

  beforeAll(async () => {
    s = await boot(model);
  });

  it("reports its layout", () => {
    const info = s.machine.getProfileInfo()!;
    expect(s.machine.profileMachineId).toBe(layout.id);
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(layout.flagBytes);
    expect(info.poolPages).toBe(layout.flagBytes / 0x2000);
    expect(info.timeUnit).toBe("T-states");
  });

  it("flags a program's bytes in the banks they live in", async () => {
    out(s, 0x7ffd, 0x13); // --- ROM 1, bank 3 at $C000
    if (model === "scorpion") out(s, 0x1ffd, 0x00);
    const { symbol } = await s.loadCode(PROGRAM);
    profiled(s, () => {
      jump(s, symbol("Main"));
      s.machine.sp = 0xbff0;
      s.runTo(symbol("End"), { maxFrames: 2 });
    });
    const main = symbol("Main");
    expect(flagAt(2, main)).toBe(E | C);
    expect(flagAt(2, main + 1)).toBe(E | C);
    expect(flagAt(2, main + 2)).toBe(C);
    // --- Bank 3's bytes, not bank 7's or the address's
    expect(flagAt(3, symbol("Patch"))).toBe(E | C | W | S);
    expect(flagAt(3, symbol("Data"))).toBe(R);
    expect(flagAt(3, symbol("Data") + 1)).toBe(0);
    expect(flagAt(3, symbol("Data2"))).toBe(W);
    for (const bank of [0, 1, 4, 5, 6, 7]) expect(flagAt(bank, symbol("Patch"))).toBe(0);
    // --- The return address CALL pushed in bank 2, and RET read back
    expect(flagAt(2, 0xbfee)).toBe(R | W);
    expect(flagAt(2, 0xbfef)).toBe(R | W);
    const counts = s.machine.readProfileCounts(at(3, symbol("Patch")), 1)!;
    expect(counts.exec[0]).toBe(1);
    expect(counts.write[0]).toBe(1);
  });

  it("maps a read and a write in every slot to getPartition's bytes, in every paging state (T2, T3)", () => {
    for (const rom of [0x00, 0x10]) {
      for (let bank = 0; bank < banks; bank++) {
        if (model === "scorpion") out(s, 0x1ffd, bank & 0x08 ? 0x10 : 0x00);
        out(s, 0x7ffd, rom | (bank & 0x07));
        const reads = checkMapping(s, layout, `ROM ${rom >> 4}, bank ${bank}`);
        expect(s.machine.getPartition(0xc000)).toBe(bank);
        // --- Bank 5 at $C000 is the bank at $4000: the same bytes; any other bank is not (T3)
        if (bank === 5) expect(reads[3]).toBe(reads[1]);
        else expect(reads[3]).not.toBe(reads[1]);
      }
    }
    if (model === "scorpion") {
      // --- $1FFD bit 0: RAM bank 0 at $0000, writable; bit 1: the service ROM, not
      out(s, 0x7ffd, 0x13);
      out(s, 0x1ffd, 0x01);
      expect(s.machine.getPartition(0)).toBe(0);
      const reads = checkMapping(s, layout, "RAM 0 at $0000");
      expect(reads[0]).toBe(0x3000);
      out(s, 0x1ffd, 0x02);
      expect(s.machine.getPartition(0)).toBe(-3);
      checkMapping(s, layout, "the service ROM");
      out(s, 0x1ffd, 0x00);
    }
  });

  it("charges every T-state to an address or a header bucket (D7)", () => {
    checkTimeSums(s);
  });

  it("tracks a CALL and its RET as one edge (PROFILER_PLAN Phase 3)", () => {
    checkCallEdge(s, layout);
  });
});

describe.each([
  { model: "pentagon", layout: sp128ProfileLayout, trdos: -3 },
  { model: "scorpion", layout: scorpionProfileLayout, trdos: -4 }
] as const)("the access profile with the $model's Beta 128", ({ model, layout, trdos }) => {
  it("credits a fetch the Beta 128 pages TR-DOS in for to the TR-DOS ROM", async () => {
    const s = await boot(model, await buildTestTrdosRom());
    const stub = 0x8000;
    // --- DI; the 48K BASIC ROM (arms the trap); CALL STATUS; JR $
    s.poke(stub, [0xf3, 0x01, 0xfd, 0x7f, 0x3e, 0x10, 0xed, 0x79, 0xcd, ENTRY.STATUS & 0xff, ENTRY.STATUS >> 8, 0x18, 0xfe]);
    let partition: number | undefined;
    profiled(s, () => {
      jump(s, stub);
      s.machine.sp = 0xbff0;
      s.runTo(ENTRY.STATUS, { maxFrames: 2 });
      expect(s.machine.getPartition(0)).toBe(-2);
      s.step(1);
      // --- The entry's fetch paged TR-DOS in
      partition = s.machine.getPartition(ENTRY.STATUS);
      s.runTo(stub + 11, { maxFrames: 2 });
      // --- The return address's own fetch pages TR-DOS out
      s.step(1);
    });
    expect(partition).toBe(trdos);
    const flag = (p: number, a: number) => s.machine.readProfileFlags(profileOffsetOf(layout, p, a)!, 1)![0];
    expect(flag(trdos, ENTRY.STATUS) & E).toBe(E);
    // --- Not the 48K BASIC ROM, which was selected at $0000 when the fetch began
    expect(flag(-2, ENTRY.STATUS)).toBe(0);
    // --- Back in RAM: the return address
    expect(s.machine.getPartition(0)).toBe(-2);
    expect(flag(2, stub + 11) & E).toBe(E);
  });
});
