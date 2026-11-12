import { describe, expect, it } from "vitest";

import {
  NEXT_PROFILE_IDS,
  NEXT_PROFILES,
  type NextProfileId
} from "@emu/machines/zxNext/nextProfiles";
import { createSession, type NextTestSession } from "../../harness/zxnext";
import { forEachProfile } from "../../harness/zxnext/script/profiles";

/*
 * 28 MHz memory wait states, by the page accessed (ported from the "Memory timing and wait states" part
 * of test/zxnext/MemoryDevice.test.ts; test/zxnext-hw/speed/cpu-speed.test.ts SPD-002 measures the
 * SRAM / bank 7 difference over a whole frame, this measures single instructions).
 *
 * Hardware (`dev/vendor/next-fpga/3.02.01/src/zxnext.vhd`):
 * - ~3168-3178: `sram_wait_n <= '0'` when `(sram_req_t = '1' or cpu_bank5_sched = '1') and
 *   cpu_rd_n = '0' and cpu_speed = "11"`: one wait state on every CPU *read* at 28 MHz (opcode fetches
 *   included) from SRAM or from bank 5's BRAM; none on writes (cpu_rd_n = 1), none at lower speeds.
 * - ~2917-2918, ~2994-3018: page $0A/$0B is bank 5 BRAM (`mem_active_bank5`), page $0E is bank 7 BRAM
 *   (`mem_active_bank7`, only the first 8K, ~6612) - neither starts an SRAM request (`sram_pre_active`
 *   = 0), and bank 7 has no scheduling wait, so a bank 7 read takes no wait state.
 * - Contention is off above 3.5 MHz (~4461), so the only difference is the wait state.
 *
 * Core 3.03 drops the wait: "Zero Wait State 28MHz" on issues 2, 4 and 5 (specnext.com/latestdistro,
 * System/Next 26.11a, core 3.03.03; the distribution's CHANGELOG puts it in 3.03.00). Its VHDL is not
 * published; that every read loses its wait is inferred from the name (VHDL-PENDING(3.03.03)). Each
 * test runs every profile: one wait state per read before 3.03, none from 3.03 on.
 *
 * `LD A,(nn)` is 13 T-states (4 + 3 + 3 + 3: opcode, two operand reads, data read), `LD (nn),A` 13 with a
 * data write, `NOP` 4. The instructions run from bank 7 (MMU6 = $0E), so the fetches add no wait; MMU2
 * maps the page under test at $4000. `s.tacts` counts CPU T-states.
 */

const LD_A_NN = [0x3a, 0x00, 0x40];
const LD_NN_A = [0x32, 0x00, 0x40];
const NOP = [0x00];

async function session(profile: NextProfileId): Promise<NextTestSession> {
  const s = await createSession({ profile });
  await s.loadCode(" .org $8000\n di\n jr $");
  return s;
}

/** T-states of `code` run once at `codeAddr` (slot 6 = page `codePage`) with page `dataPage` at $4000. */
function measure(
  s: NextTestSession,
  speed: number,
  codePage: number,
  dataPage: number,
  code: number[]
): number {
  s.setNextReg(0x07, speed).setNextReg(0x56, codePage).setNextReg(0x52, dataPage);
  s.poke(0xc000, [...code, 0x18, 0xfe]).setRegisters({ pc: 0xc000 });
  const t0 = s.tacts;
  s.step(1);
  return s.tacts - t0;
}

const BANK7 = 0x0e;
const BANK5 = 0x0a;
const SRAM = 0x10;

/** The wait states of one SRAM read at 28 MHz on a profile's core */
const waitOf = (profile: NextProfileId) => (NEXT_PROFILES[profile].coreVersion[1] >= 3 ? 0 : 1);

describe("28 MHz wait states", () => {
  forEachProfile(NEXT_PROFILE_IDS, (profile) => {
    const w = waitOf(profile);
    it(`reads from SRAM and bank 5 take ${w} wait state(s) at 28 MHz; bank 7 none`, async () => {
      const s = await session(profile);
      expect({
        bank7: measure(s, 3, BANK7, BANK7, LD_A_NN),
        bank5: measure(s, 3, BANK7, BANK5, LD_A_NN),
        bank5Upper: measure(s, 3, BANK7, 0x0b, LD_A_NN),
        sram: measure(s, 3, BANK7, SRAM, LD_A_NN)
      }).toEqual({ bank7: 13, bank5: 13 + w, bank5Upper: 13 + w, sram: 13 + w });
    });

    it("writes take no wait state at 28 MHz", async () => {
      const s = await session(profile);
      expect([BANK7, BANK5, SRAM].map((p) => measure(s, 3, BANK7, p, LD_NN_A))).toEqual([
        13, 13, 13
      ]);
    });

    it(`an opcode fetch from SRAM waits ${w}; from bank 7 it does not`, async () => {
      const s = await session(profile);
      expect({
        nopBank7: measure(s, 3, BANK7, SRAM, NOP),
        nopSram: measure(s, 3, SRAM, SRAM, NOP),
        // --- opcode, two operands and the data read all from SRAM: four reads
        ldSram: measure(s, 3, 0x11, SRAM, LD_A_NN)
      }).toEqual({ nopBank7: 4, nopSram: 4 + w, ldSram: 13 + 4 * w });
    });

    it("no wait state at 3.5, 7 and 14 MHz", async () => {
      const s = await session(profile);
      s.setNextReg(0x08, s.readNextReg(0x08) | 0x40); // --- no contention (~4461), so only wait states count
      const got = [0, 1, 2].map((speed) =>
        [BANK7, BANK5, SRAM].map((p) => measure(s, speed, SRAM, p, LD_A_NN))
      );
      expect(got.map((row) => row.join(","))).toEqual(["13,13,13", "13,13,13", "13,13,13"]);
    });
  });
});
