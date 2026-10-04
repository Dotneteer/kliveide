import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ZX80_KEY_WAIT } from "@emu/machines/zx8081/zx8081MachineInfo";
import { createZx81Session, Zx81TestSession } from "../harness/zx81";
import { expectGolden } from "./goldens";

/**
 * The ZX80 on the shared core (`.plans/ZX8081_WASM_PLAN.md` Phase 5): the 4K ROM with the ZX80 ULA (no
 * NMI generator, a line timer that only the INT acknowledge resets), `.O` files, and the ZX80 with
 * the 8K ROM upgrade.
 */
const HI_O = join(__dirname, "fixtures/hi.o");

describe("ZX80", () => {
  it("boots to the K cursor with a centred picture", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    expect(s.screenText()[23]).toBe("[K]");
    // --- The cursor's cell, as on the ZX81: 48 pixels of border, row 23
    expect(s.isInk(48, 232)).toBe(true);
    expect(s.isInk(47, 232)).toBe(false);
    expectGolden("zx80-boot", s.screenPixels());
  });

  it("types with its own keyword layout: O is PRINT, SHIFT+Y the quote", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    s.typeKeys('10O"HI"\n', { settle: 30 });
    expect(s.screenText()[0]).toBe('  10[>]PRINT "HI"');
  });

  it("reaches the prompt loop the tape-load flow waits for", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    s.runTo(ZX80_KEY_WAIT, { maxFrames: 5 });
  });

  it("fast-loads and real-time-loads a .O file to the same program", async () => {
    const file = Zx81TestSession.readProgram(HI_O);
    expect(file.isZx81).toBe(false);
    const programs: number[][] = [];
    for (const fastLoad of [true, false]) {
      const s = await createZx81Session({ machineId: "zx80" });
      s.bootToBasic();
      s.loadProgram(file, { fastLoad, autoRun: false, maxFrames: 1000 });
      expect(s.wasm.zx8081TapeGetTraps()).toBe(fastLoad ? file.tapeBytes.length : 0);
      expect(s.screenText()[0]).toBe('  10[>]PRINT "HI"');
      // --- The BASIC program: $4028 (after the system variables, some of which keep counting) up to VARS
      const vars = file.data[0x08] | (file.data[0x09] << 8);
      programs.push([...file.data.subarray(0x28, vars - 0x4000)].map((_, i) => s.peek(0x4028 + i)));
    }
    expect(programs[1]).toEqual(programs[0]);
    expect(programs[0]).toEqual([...file.data.subarray(0x28, (file.data[0x08] | (file.data[0x09] << 8)) - 0x4000)]);
    expect(programs[0].length).toBeGreaterThan(5);
  });

  it("with the 8K ROM upgrade, boots the ZX81 ROM (FAST mode only: no NMI generator) and loads .P files", async () => {
    const s = await createZx81Session({ machineId: "zx80", model: "zx80-8krom-16k" });
    s.bootToBasic();
    // --- The ZX81 ROM finds no working NMI generator and stays in FAST mode (CDFLAG bit 7 clear)
    expect(s.peek(0x403b) & 0x80).toBe(0);
    s.loadProgram(Zx81TestSession.readProgram("basic/BASE.p"), { autoRun: false });
    expect(s.screenText()[23]).toBe("0/0");
  });
});
