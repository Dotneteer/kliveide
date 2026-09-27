import { describe, expect, it } from "vitest";

import { runBasicNext } from "./next-kit";

/**
 * The ZX Spectrum Next target (plan Phase 6): programs built for `next` run on the Next harness —
 * the same runtime as the 48K, with the Next's own ROM paging for the Float calculator and error
 * reports (MMU slots 0-1 and NextReg $8E).
 */
describe("the Next target", () => {
  it("runs integers, Strings, PRINT and routines", async () => {
    const r = await runBasicNext(
      [
        "DIM total AS UInteger",
        "SUB Add(n AS UByte)",
        "  total = total + n",
        "END SUB",
        "FOR i = 1 TO 10 : Add(i) : NEXT i",
        'DIM s$ AS String = "Next"',
        'PRINT s$; " "; total',
        ""
      ].join("\n")
    );
    expect(r.word("total")).toBe(55);
    expect(r.screen()[0]).toBe("Next 55");
  });

  it("uses the 48K ROM's calculator for Float, and gives the program's paging back", async () => {
    const r = await runBasicNext(["DIM x AS Float = 2", "x = SQR(x) * 3", "PRINT x", ""].join("\n"));
    expect(r.screen()[0]).toBe("4.2426407");
    // --- RomOut restored the NEX layout's slots 0-1 and the ROM selection it found
    expect(r.session.mmuPage(0)).toBe(0xff);
    expect(r.session.nextRegValue(0x8e) & 0x03).toBe(0x03);
  });
});

describe("the NEX a Next build exports", () => {
  it("loads with the NEX loader and runs from its entry, printing and ending in the stub's wait", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { KBasicCompiler } = await import("@main/kbasic/KBasicCompiler");
    const { NexFileWriter } = await import("@main/z80-compiler/nex-file-writer");
    const { createSession } = await import("../../harness/zxnext");
    const dir = mkdtempSync(join(tmpdir(), "kbnex-"));
    try {
      writeFileSync(join(dir, "main.bas"), 'DIM n AS UInteger = 6 * 7\nPRINT "NEX "; n\n');
      const compiler = new KBasicCompiler();
      compiler.setAppState({ emulatorState: { machineId: "zxnext" }, projectSettings: {} } as any);
      const output = (await compiler.compileFile(join(dir, "main.bas"))) as any;
      expect(output.errors.filter((e: any) => !e.isWarning)).toEqual([]);
      const nex = await NexFileWriter.fromAssemblerOutput(output, dir);
      writeFileSync(join(dir, "main.nex"), nex);
      const session = await createSession();
      await session.prepareBasic();
      await session.loadProgramFile(join(dir, "main.nex"));
      session.runFrames(20);
      expect(session.screenLine(0)).toBe("NEX 42");
      // --- The program ended: the stub waits in its loop
      const pc = session.machine.pc;
      session.runFrames(2);
      expect(session.machine.pc).toBe(pc);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
