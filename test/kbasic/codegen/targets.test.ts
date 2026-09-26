import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SP128_MAIN_WAITING_LOOP } from "@emu/machines/ZxSpectrumBase";

import { Sp48TestSession } from "../../harness/sp48";
import { createTestSp128WasmMachine } from "../../wasm/zxSpectrum/wasm-test-helpers";
import { compileBasic } from "./run-kit";

/**
 * The 128K target on a real 128K (both ROMs), booted to its menu: ROM 0 (the 128 editor) is paged
 * in, as a program that pages memory might leave it. The runtime must page the 48K BASIC ROM in for
 * the calculator and put ROM 0 back afterwards. The test gives the program what it has when BASIC
 * runs it and the menu does not: a stack high in RAM (the menu's sits below the calculator's
 * workspace) and the calculator's memory pointer MEM at MEMBOT.
 */
const rom = (name: string) => new Uint8Array(readFileSync(join(__dirname, "../../../src/public/roms", name)));

describe("the 128K target", () => {
  it("pages the 48K BASIC ROM in for Float and back out afterwards", async () => {
    const machine = await createTestSp128WasmMachine(rom("sp128-0.rom"), rom("sp128-1.rom"));
    machine.hardReset();
    const session = new Sp48TestSession(machine as never);
    session.runTo(SP128_MAIN_WAITING_LOOP, { maxFrames: 600 });
    const bankm = session.peek(0x5b5c);
    expect(bankm & 0x10, "ROM 0 is paged at the menu").toBe(0);

    const { generated } = await compileBasic("DIM f AS Float = 2\nPRINT AT 0, 0; SQR(f) * 1000; \" \"; STR$(PI)\n", { target: "zx128k" });
    expect(generated.emitted.text).toContain(".model Spectrum128");
    session.loadOutput(generated.output, { entry: generated.entryAddress });
    const entry = generated.entryAddress;
    const stub = 0xbf00;
    session.poke(stub, [0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
    machine.pc = stub;
    machine.sp = 0xbef0;
    session.pokeWord(0x5c68, 0x5c92);
    session.runTo(stub + 3, { maxFrames: 200 });

    // --- The rest of the row is the menu's own graphics
    expect(session.screenLine(0).slice(0, 19)).toBe("1414.2136 3.1415927");
    expect(session.peek(0x5b5c), "BANKM is as the program found it").toBe(bankm);
  });
});
