import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { SP48_MAIN_ENTRY } from "@emu/machines/ZxSpectrumBase";
import { createTimexSession, hasTc2048Rom, type TimexTestSession } from "../harness/timex";

/*
 * The IDE's flows on the TC2048 (`.plans/TIMEX_SCORPION_PLAN.md` G9.4a, P6). Without a TC2048 ROM the
 * machine boots the Sinclair 48K ROM, so every flow runs in CI; the ROM-gated cases repeat them on
 * the TC2048 ROM named in `KLIVE_TC2048_ROM`. The flows wait at the 48K ROM's addresses, which the
 * TC2048 ROM keeps: it differs from the 48K ROM only in the CALL at $1299 that prints the copyright
 * message on the start-up and NEW path (after XOR A), redirected to a routine at $386E (in the 48K
 * ROM's unused $FF bytes) that writes A - zero - to port $FF before the original call.
 */

const FLOAT_SPY = new Uint8Array(readFileSync(join(__dirname, "../testfiles/floatspy.tap")));

function tapBlocks(bytes: Uint8Array) {
  const reader = new TapReader(new BinaryReader(bytes));
  expect(reader.readContent()).toBeNull();
  return reader.dataBlocks;
}

async function loadsTape(s: TimexTestSession): Promise<void> {
  const blocks = tapBlocks(FLOAT_SPY);
  const program = blocks[1].data.subarray(1, blocks[1].data.length - 1);
  s.bootToBasic();
  s.insertTape(blocks);
  s.typeFlowKeys(s.timex.getTapeLoadFlow(), { gap: 8 });
  const prog = s.peekWord(0x5c53);
  let loaded = false;
  for (let frame = 0; frame < 3000 && !loaded; frame += 10) {
    s.runFrames(10);
    loaded = Array.from(program.subarray(0, 64)).every((b, i) => s.peek(prog + i) === b);
  }
  expect(loaded).toBe(true);
  // --- The program autostarts, loads its code block from the same tape, and runs it
  s.runFrames(300);
  expect(s.screenLine(8)).toContain("FLOATING BUS test program");
}

describe("TC2048 flows", () => {
  it("injects code at the 48K main loop, for code built for the 48K or the TC2048", async () => {
    const s = await createTimexSession();
    for (const model of ["sp48", "timex", "tc2048"]) {
      const flow = await s.timex.getCodeInjectionFlow(model);
      expect(flow[0]).toMatchObject({ type: "ReachExecPoint", rom: 0, execPoint: SP48_MAIN_ENTRY });
      expect(flow[flow.length - 1]).toMatchObject({ type: "SetReturn", returnPoint: SP48_MAIN_ENTRY });
    }
    await expect(s.timex.getCodeInjectionFlow("sp128")).rejects.toThrow();

    // --- The flow's stop point is reached on boot; injected code runs and returns there
    s.bootToBasic();
    await s.loadCode(`
          .org $8000
      Main:
          ld a,$02
          out ($ff),a
          ld hl,$1234
          ld (Result),hl
          ret
      Result:
          .defw 0
    `);
    s.call("Main");
    expect(s.machine.pc).toBe(SP48_MAIN_ENTRY);
    expect(s.peekWord(s.program!.symbol("Result"))).toBe(0x1234);
    expect(s.portFf).toBe(0x02);
  });

  it('types LOAD "" and the 48K ROM loads and runs a tape', async () => {
    await loadsTape(await createTimexSession());
  }, 60_000);

  it.skipIf(!hasTc2048Rom())("boots the TC2048 ROM to the 48K main loop", async () => {
    const s = await createTimexSession({ rom: "tc2048" });
    s.bootToBasic();
    expect(s.timex.romInUse).toBe("tc2048");
    expect(s.machine.pc).toBe(SP48_MAIN_ENTRY);
    expect(s.machine.isOsInitialized).toBe(true);
  });

  it.skipIf(!hasTc2048Rom())('types LOAD "" and the TC2048 ROM loads and runs a tape', async () => {
    await loadsTape(await createTimexSession({ rom: "tc2048" }));
  }, 60_000);

  it.skipIf(!hasTc2048Rom())("the TC2048 ROM clears port $FF on its start-up path", async () => {
    const s = await createTimexSession({ rom: "tc2048" });
    s.bootToBasic();
    s.out(0x00ff, 0x06);
    // --- $1295: XOR A, the copyright message's address, the patched CALL; on to the main loop
    s.machine.pc = 0x1295;
    s.runTo(SP48_MAIN_ENTRY);
    expect(s.portFf).toBe(0x00);
  });

  it("the 48K ROM leaves port $FF alone on the same path", async () => {
    const s = await createTimexSession();
    s.bootToBasic();
    s.out(0x00ff, 0x06);
    s.machine.pc = 0x1295;
    s.runTo(SP48_MAIN_ENTRY);
    expect(s.portFf).toBe(0x06);
  });
});
