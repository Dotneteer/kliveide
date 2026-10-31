import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";
import { nextProfileOf } from "@emu/machines/zxNext/nextProfiles";

/*
 * Machine identity registers (catalogue NR-006 - NR-008). All three are read-only: the read mux
 * returns generics (`g_machine_id`, `g_version`, `g_sub_version`, `g_board_issue`; zxnext.vhd ~5830-5860)
 * and no write branch assigns them.
 *
 * - `$00`: `vendor/next-fpga/3.02.01/nextreg.txt` lists `0000 1000 = EMULATORS` ($08); the FPGA reports `$0A`.
 * - `$01`: bits 7-4 major, 3-0 minor; `$0E`: sub-minor. The value is the core version the emulator
 *   claims to implement: the profile's `coreVersion` (`nextProfiles.ts`), which the core's reset sets.
 * - `$0F`: bits 7-4 "Reserved, 0", bits 3-0 board ID.
 */
const [MAJOR, MINOR, SUB_MINOR] = nextProfileOf().coreVersion;
const EXPECTED: Array<[reg: number, value: number, what: string]> = [
  [0x00, 0x08, "machine ID: emulators"],
  [0x01, (MAJOR << 4) | MINOR, "core version major.minor"],
  [0x0e, SUB_MINOR, "core version sub-minor"]
];

describe("machine identity registers", () => {
  for (const [reg, value, what] of EXPECTED) {
    it(`$${reg.toString(16).padStart(2, "0")} ${what}: $${value.toString(16)}, read-only, kept across resets`, async () => {
      const s = await createSession();
      expect(s.readNextReg(reg)).toBe(value);
      s.setNextReg(reg, value ^ 0xff);
      expect(s.readNextReg(reg), "after a write").toBe(value);
      s.reset();
      expect(s.readNextReg(reg), "after a soft reset").toBe(value);
      s.hardReset();
      expect(s.readNextReg(reg), "after a hard reset").toBe(value);
    });
  }

  it("$0F board ID: bits 7-4 read 0, read-only", async () => {
    const s = await createSession();
    const board = s.readNextReg(0x0f);
    expect(board & 0xf0).toBe(0x00);
    expect(board, "g_board_issue").toBe(nextProfileOf().boardIssue);
    s.setNextReg(0x0f, 0xff);
    expect(s.readNextReg(0x0f)).toBe(board);
  });
});
