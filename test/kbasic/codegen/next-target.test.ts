import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SourceDebugIndex } from "@emu/machines/SourceStepDecision";

import { runBasicNext, startBasicNext } from "./next-kit";

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

describe("source stepping on the Next (§10.2)", () => {
  // --- Regression: the Next's debug loop keeps only PC in step per instruction, so the step decision
  // --- must read SP and the result registers from the core, or Step Over and Step Out stop in callees
  const SOURCE = ["FUNCTION f(n AS UByte) AS UByte", "  RETURN n + 1", "END FUNCTION", "SUB s()", "  PRINT 1", "END SUB", "DIM x AS UByte", "s", "x = f(41)", "PRINT x", ""].join("\n");

  it("steps over calls, and steps out to the return point with the returned value", async () => {
    const { session, generated, done } = await startBasicNext(SOURCE);
    const info = generated.debug.sourceLevel;
    const index = new SourceDebugIndex(info);
    session.attachDebugSupport();
    const line = (st: ReturnType<typeof session.sourceStep>) => (st ? info.statements[st.stopStatement!].startLine : -1);
    expect(line(session.sourceStep(index, "into", { returnTo: done }))).toBe(8);
    expect(line(session.sourceStep(index, "over", { returnTo: done }))).toBe(9);
    expect(line(session.sourceStep(index, "into", { returnTo: done }))).toBe(2);
    const out = session.sourceStep(index, "out", { returnTo: done })!;
    expect([out.stoppedAt, line(out)]).toEqual(["returnPoint", 9]);
    expect(out.returned.map((r) => r.registers.af >> 8)).toEqual([42]);
    expect(line(session.sourceStep(index, "over", { returnTo: done }))).toBe(10);
  });
});

describe("the ZX Spectrum Next project template", () => {
  it("runs, calling its CODEBANK routine", async () => {
    const source = readFileSync(join(__dirname, "../../../src/public/project-templates/zxnext/zx-basic/code/program.zxbas"), "utf8");
    const r = await runBasicNext(source);
    expect(r.screen()[10]).toBe("     Welcome to Klive IDE");
    expect(r.screen()[11]).toBe("        (Klive BASIC)");
    expect(r.generated.debug.sourceLevel.extensions?.codebank?.banks).toEqual([{ bank: 1, pages: [30] }]);
  });
});

describe("the Next runtime's Z80N multiplies (plan §6.2)", () => {
  it("multiply 8- and 16-bit values as the Z80 routines do, signed and unsigned, wrapping", async () => {
    const bytes = [0, 1, 2, 3, 7, 15, 16, 100, 127, 128, 200, 255];
    const words = [0, 1, 2, 255, 256, 1000, 12345, 32767, 32768, 40000, 65535];
    const source = [
      `DIM a8(${bytes.length - 1}) AS UByte => {${bytes.join(", ")}}`,
      `DIM a16(${words.length - 1}) AS UInteger => {${words.join(", ")}}`,
      `DIM r8(${bytes.length * bytes.length - 1}) AS UByte`,
      `DIM r16(${words.length * words.length - 1}) AS UInteger`,
      `DIM s16(${words.length * words.length - 1}) AS Integer`,
      "DIM i, j AS UByte",
      "DIM x, y AS UByte",
      "DIM p, q AS UInteger",
      `FOR i = 0 TO ${bytes.length - 1} : FOR j = 0 TO ${bytes.length - 1}`,
      `  x = a8(i) : y = a8(j) : r8(i * ${bytes.length} + j) = x * y`,
      "NEXT j : NEXT i",
      `FOR i = 0 TO ${words.length - 1} : FOR j = 0 TO ${words.length - 1}`,
      `  p = a16(i) : q = a16(j) : r16(i * ${words.length} + j) = p * q`,
      `  s16(i * ${words.length} + j) = CAST(Integer, p) * CAST(Integer, q)`,
      "NEXT j : NEXT i",
      ""
    ].join("\n");
    for (const optimize of [0, 1]) {
      const r = await runBasicNext(source, { optimize, frames: 3000 });
      const s = r.session;
      const r8 = r.program.symbol("_r8.data");
      const r16 = r.program.symbol("_r16.data");
      const s16 = r.program.symbol("_s16.data");
      bytes.forEach((x, i) => bytes.forEach((y, j) => expect(s.peek(r8 + i * bytes.length + j), `${x}*${y}`).toBe((x * y) & 0xff)));
      words.forEach((x, i) =>
        words.forEach((y, j) => {
          const k = i * words.length + j;
          expect(s.peekWord(r16 + 2 * k), `${x}*${y}`).toBe(Number((BigInt(x) * BigInt(y)) & 0xffffn));
          const sx = x >= 32768 ? x - 65536 : x;
          const sy = y >= 32768 ? y - 65536 : y;
          expect(s.peekWord(s16 + 2 * k), `${sx}*${sy}`).toBe(Number(BigInt.asUintN(16, BigInt(sx) * BigInt(sy))));
        })
      );
      expect(r.generated.emitted.text).toMatch(/call core\.Mul16/);
      // --- The Next's own routine is the one linked: push de / ld d,a / ld e,h / mul d,e
      const mul8 = r.program.symbol("core.Mul8");
      expect([0, 1, 2, 3, 4].map((k) => s.peek(mul8 + k))).toEqual([0xd5, 0x57, 0x5c, 0xed, 0x30]);
    }
  });
});
