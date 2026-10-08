import { beforeAll, describe, expect, it } from "vitest";
import { PF_CODE, PF_EXECUTED, PF_READ, PF_SELF_MODIFIED, PF_WRITTEN } from "@common/profile/profileTypes";
import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { spp3eProfileLayout as layout } from "@common/profile/layouts/spp3e";
import { createSp128Session, type Sp128TestSession } from "../../harness/sp128";
import { checkMapping, checkTimeSums, jump, out, profiled } from "./pagedSpectrumProfile";

/*
 * The access profile on the +2A/+3/+2E/+3E core (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` Phase 2):
 * physical offsets over RAM banks 0-7 and ROMs 0-3, mapped through the slot map - the special
 * (all-RAM) paging modes included - never the flat `spp3eMemory` copy (traps T2, T3).
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

/** The +3's special configurations ($1FFD bits 1-2): the banks at $0000, $4000, $8000, $C000 */
const SPECIAL = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [4, 5, 6, 3],
  [4, 7, 6, 3]
];

describe.each(["nofdd", "plus3-fdd1"] as const)("the access profile on the +3E core (%s)", (model) => {
  let s: Sp128TestSession;
  const at = (partition: number, address: number) => profileOffsetOf(layout, partition, address)!;
  const flagAt = (partition: number, address: number) => s.machine.readProfileFlags(at(partition, address), 1)![0];

  beforeAll(async () => {
    s = await createSp128Session(model);
    s.runFrames(50);
  });

  it("reports its layout", () => {
    const info = s.machine.getProfileInfo()!;
    expect(s.machine.profileMachineId).toBe("spp3e");
    expect(info.enabled).toBe(false);
    expect(info.flagBytes).toBe(0x30000);
    expect(info.poolPages).toBe(24);
    expect(info.timeUnit).toBe("T-states");
  });

  it("flags a program's bytes in the banks they live in", async () => {
    out(s, 0x1ffd, 0x04);
    out(s, 0x7ffd, 0x13); // --- ROM 3, bank 3 at $C000
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
    expect(flagAt(3, symbol("Patch"))).toBe(E | C | W | S);
    expect(flagAt(3, symbol("Data"))).toBe(R);
    expect(flagAt(3, symbol("Data") + 1)).toBe(0);
    expect(flagAt(3, symbol("Data2"))).toBe(W);
    for (const bank of [0, 1, 4, 5, 6, 7]) expect(flagAt(bank, symbol("Patch"))).toBe(0);
    expect(flagAt(2, 0xbfee)).toBe(R | W);
    expect(flagAt(2, 0xbfef)).toBe(R | W);
  });

  it("maps a read and a write in every slot to getPartition's bytes, in every paging state (T2, T3)", () => {
    // --- Normal paging: the four ROMs ($1FFD bit 2, $7FFD bit 4) by the eight banks
    for (let rom = 0; rom < 4; rom++) {
      for (let bank = 0; bank < 8; bank++) {
        out(s, 0x1ffd, rom & 0x02 ? 0x04 : 0x00);
        out(s, 0x7ffd, (rom & 0x01 ? 0x10 : 0x00) | bank);
        expect(s.machine.getPartition(0)).toBe(-(rom + 1));
        const reads = checkMapping(s, layout, `ROM ${rom}, bank ${bank}`);
        if (bank === 5) expect(reads[3]).toBe(reads[1]);
        else expect(reads[3]).not.toBe(reads[1]);
      }
    }
    // --- The special modes: all RAM, so every slot's write lands; reads and writes agree
    for (let mode = 0; mode < 4; mode++) {
      out(s, 0x7ffd, 0x10);
      out(s, 0x1ffd, 0x01 | (mode << 1));
      expect(s.machine.getCurrentPartitions().filter((_, i) => i % 2 === 0)).toEqual(SPECIAL[mode]);
      const reads = checkMapping(s, layout, `special mode ${mode}`);
      expect(reads).toEqual(SPECIAL[mode].map((bank) => bank * 0x4000 + 0x3000));
    }
    out(s, 0x1ffd, 0x00);
  });

  it("charges every T-state to an address or a header bucket (D7)", () => {
    checkTimeSums(s);
  });
});
