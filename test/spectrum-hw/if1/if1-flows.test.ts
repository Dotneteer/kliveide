import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { SP128_RETURN_TO_EDITOR, SP48_MAIN_ENTRY } from "@emu/machines/ZxSpectrumBase";
import { createFormattedMdr } from "@emu/machines/microdrive/mdrImage";
import { createSp128Session } from "../../harness/sp128";
import { runBasic, screenLines, sp48WithInterface1 } from "./if1TestSupport";

/*
 * The IDE's flows with the Interface 1 connected (`.plans/MICRODRIVE_PLAN.md` Phase 4.4-4.5): code
 * injection, which waits for the ROMs' main loops and returns to them, and tape loading, whose
 * traps are the 48K ROM's - the IF1 inserts its system variables (PROG moves) and pages its ROM over
 * the 48K's after every direct command.
 */

const FLOAT_SPY = join(__dirname, "../../testfiles/floatspy.tap");

/** LD A,$42 / LD ($9000),A / RET at $8000, called as a subroutine */
function program(model: "sp48" | "sp128"): CodeToInject {
  return {
    model,
    subroutine: true,
    entryAddress: 0x8000,
    segments: [{ startAddress: 0x8000, bankOffset: 0, emittedCode: [0x3e, 0x42, 0x32, 0x00, 0x90, 0xc9] }],
    options: { noCls: true }
  };
}

describe("the IDE's flows with the Interface 1", () => {
  it("48K: injected code runs and returns to a BASIC that still drives the Microdrives", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, createFormattedMdr("TEST"));
    // --- What the 48K's injection flow does once it reaches the main loop
    runBasic(s, `10 CLOSE #0`, 50);
    expect(s.peekWord(23635)).toBe(23813);
    s.machine.injectCodeToRun(program("sp48"));
    s.call(0x8000, { returnTo: SP48_MAIN_ENTRY });
    expect(s.peek(0x9000)).toBe(0x42);
    runBasic(s, `10 CAT 1`, 700);
    expect(screenLines(s)).toEqual(["TEST", "127", "0 OK, 10:1"]);
  }, 120_000);

  it.each(["sp48", "sp128"] as const)("128K: the %s injection flow reaches its main loop and returns", async (model) => {
    const s = await createSp128Session("sp128");
    s.connectInterface1().insertCartridge(0, createFormattedMdr("TEST"));
    s.runFlow(await s.machine.getCodeInjectionFlow(model), { code: program(model) });
    expect(s.cpu().pc).toBe(0x8000);
    s.runTo(model === "sp48" ? SP48_MAIN_ENTRY : SP128_RETURN_TO_EDITOR, { rom: model === "sp48" ? 1 : 0, maxFrames: 5 });
    expect(s.peek(0x9000)).toBe(0x42);
    expect(s.interface1().paged).toBe(false);
  }, 120_000);

  it.each([true, false])("48K: LOAD \"\" loads a tape with the IF1 connected (fast load %s)", async (fastLoad) => {
    const s = await sp48WithInterface1();
    // --- The IF1's system variables exist first, as after any command
    runBasic(s, `10 CLOSE #0`, 50);
    s.loadTap(FLOAT_SPY, { fastLoad });
    for (let frame = 0; frame < 4000 && !screenLines(s).some((l) => l.includes("FLOATING BUS")); frame += 50) {
      s.runFrames(50);
    }
    expect(screenLines(s).some((l) => l.includes("FLOATING BUS"))).toBe(true);
  }, 180_000);

  it("the tape trap does not fire inside the paged IF1 ROM", async () => {
    // --- A stand-in IF1 ROM that jumps to $056C (LD-BYTES in the 48K ROM) while paged
    const rom = new Uint8Array(0x2000).fill(0x00);
    rom.set([0xc3, 0x6c, 0x05], 0x0008);
    rom[0x0700] = 0xc9;
    const loadStarts = (session: Awaited<ReturnType<typeof sp48WithInterface1>>) =>
      (session.machine.wasmV2Runtime!.exports as unknown as { sp48TapeGetLoadStartCount(): number }).sp48TapeGetLoadStartCount();
    const tape = [{ data: new Uint8Array([0x00, 1, 2, 3]) } as never];

    const paged = await sp48WithInterface1(rom);
    paged.insertTape(tape, { fastLoad: true });
    paged.machine.pc = 0x0008;
    paged.step(3);
    expect(paged.interface1().paged).toBe(true);
    expect(loadStarts(paged)).toBe(0);

    // --- The control: the same jump with the interface disconnected reaches the 48K ROM's LD-BYTES
    const plain = await sp48WithInterface1(rom);
    plain.interface1Bridge.setPresent(false);
    plain.insertTape(tape, { fastLoad: true });
    plain.machine.pc = 0x056c;
    plain.step(1);
    expect(loadStarts(plain)).toBe(1);
  }, 60_000);
});
