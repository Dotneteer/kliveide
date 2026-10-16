import { describe, expect, it } from "vitest";

import { buildZx8081ProgramImage } from "@common/zx8081/programImage";
import { parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import { createZx81Session, type Zx81TestSession } from "../harness/zx81";

/**
 * Program images from the builder (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D3) run on the real
 * machines: loaded by the ROM's own LOAD, RUN, the code called through `USR` and returning to BASIC.
 *
 * The code stores $5A in a byte of its own and returns:
 *   ld a,$5a / ld (marker),a / ret / marker: nop
 */
const ZX81_CODE = [0x3e, 0x5a, 0x32, 0x88, 0x40, 0xc9, 0x00];
const ZX81_MARKER = 0x4088;
const ZX80_CODE = [0x3e, 0x5a, 0x32, 0x31, 0x40, 0xc9, 0x00];
const ZX80_MARKER = 0x4031;

function zx81File(ramKb: number, autoRun = false) {
  const image = buildZx8081ProgramImage([{ startAddress: 0x4082, emittedCode: ZX81_CODE }], undefined, true, {
    ramKb,
    autoRun
  });
  return parseZxProgramFile(image.data, "code.p")!;
}

function zx80File(ramKb: number) {
  const image = buildZx8081ProgramImage([{ startAddress: 0x402b, emittedCode: ZX80_CODE }], undefined, false, {
    ramKb
  });
  return parseZxProgramFile(image.data, "code.o")!;
}

/**
 * Loads a program as the tape-load flow does - LOAD typed, auto-RUN armed - and runs until the code
 * has stored its marker. (A small program finishes loading while the harness is still typing, which
 * `loadProgram` cannot wait for.)
 */
function loadAndRun(s: Zx81TestSession, file: ReturnType<typeof zx81File>, marker: number): void {
  s.wasm.zx8081ArmAutoRun(1);
  s.insertProgram(file);
  s.typeKeys(file.isZx81 ? 'J""\n' : "W\n", { settle: 0 });
  s.runUntil(() => s.peek(marker) === 0x5a, { maxFrames: 600 }, "the code to run");
  s.runFrames(50);
}

describe("ZX81 program images on the machine", () => {
  it.each([
    ["zx81-16k", 16],
    ["zx81-1k", 1]
  ])("%s: loads, RUN calls the code, and it returns to BASIC", async (model, ramKb) => {
    const s = await createZx81Session({ model });
    s.bootToBasic();
    loadAndRun(s, zx81File(ramKb), ZX81_MARKER);
    // --- RET goes back to the RAND statement, which ends the program: report 0 at line 2
    expect(s.screenText().join("\n")).toContain("0/2");
  });

  it("lists the two lines", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.loadProgram(zx81File(16), { autoRun: false });
    // --- After LOAD the screen holds only the report; NEWLINE lists the program
    s.typeKeys("\n", { settle: 100 });
    const screen = s.screenText();
    expect(screen[0]).toMatch(/^ {3}1 REM /);
    // --- Line 2 is the current line: the listing marks it with the [>] cursor
    expect(screen[1]).toBe("   2[>]RAND USR 16514");
  });

  it("runs itself after LOAD when NXTLIN points at line 2", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.insertProgram(zx81File(16, true));
    s.typeKeys('J""\n', { settle: 0 });
    s.runUntil(() => s.peek(ZX81_MARKER) === 0x5a, { maxFrames: 600 }, "the program to run");
  });

  it("does not run itself without auto-run", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.insertProgram(zx81File(16, false));
    s.typeKeys('J""\n', { settle: 0 });
    s.runFrames(400);
    expect(s.peek(ZX81_MARKER)).toBe(0x00);
    expect(s.peekWord(0x4014)).toBeGreaterThan(0x4082);
  });
});

describe("ZX80 program images on the machine", () => {
  it.each([
    ["zx80-16k", 16],
    ["zx80-1k", 1]
  ])("%s: loads, RUN calls the code, and it returns to BASIC", async (model, ramKb) => {
    const s = await createZx81Session({ machineId: "zx80", model });
    s.bootToBasic();
    loadAndRun(s, zx80File(ramKb), ZX80_MARKER);
    expect(s.screenText().join("\n")).toContain("0/2");
  });
});
