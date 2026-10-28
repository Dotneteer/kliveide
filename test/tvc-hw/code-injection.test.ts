import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@common/abstractions/CodeToInject";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { placeTvcCode, tvcProgramPayload, type TvcPlacement } from "@common/tvc/codePlacement";
import { buildTvcCasFile, parseTvcCasFile } from "@emu/machines/tvc/TvcCasFile";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { createTvcSession, type TvcTestSession } from "../harness/tvc";

/*
 * Run, Inject and the .cas export on the TVC (`.plans/VIDEOTON_TVC_PLAN.md` Phase 7): the injection
 * flow played as the command line plays it, and an exported program loaded from tape, on the real
 * ROMs of both models.
 */

/** TEXT (1722h): where BASIC's program space starts, which `LOMEM` moves */
const TEXT = 0x1722;

/**
 * Counts its calls at Count and returns to BASIC (the border it sets BASIC repaints at once); it ends
 * at 6010h, so Run types `LOMEM 24592`
 */
const PROGRAM = `
  .model TVC
  .org $6000
Start:
  ld hl,Count
  inc (hl)
  ld a,$44
  out ($00),a
  ret
Count:
  .defb 0
  .defs 6
`;

async function build(source: string): Promise<CodeToInject> {
  const out = await new Z80Assembler().compile(source, new AssemblerOptions());
  const errors = out.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  return {
    model: "tvc",
    entryAddress: out.entryAddress,
    segments: out.segments.map((s) => ({ startAddress: s.startAddress, bankOffset: 0, emittedCode: s.emittedCode })),
    options: out.injectOptions
  };
}

const COUNT = 0x6009;

describe("TVC code injection", () => {
  it.each(["tvc64", "tvc64p"])("%s: boots BASIC, puts the code above LOMEM, calls it, and RET goes back", async (model) => {
    const s = await createTvcSession({ model });
    const code = await build(PROGRAM);
    // --- The 64K+'s RAM test takes longer than the runner's default limit for one step
    playInjectionFlow(s.machine as unknown as FrameMachine, await s.machine.getCodeInjectionFlow("tvc"), {
      code,
      maxFrames: 2000
    });
    // --- The flow kept BASIC's PC: the typed commands are still to come
    expect(s.peek(COUNT)).toBe(0);
    s.runUntil(() => s.peek(COUNT) === 1, { maxFrames: 400 }, "the code being called");
    s.runUntil(() => s.isWaitingForKey(), { maxFrames: 100 }, "BASIC's prompt");
    expect(s.peekWord(TEXT)).toBe(0x6010);
    // --- BASIC works above the code, and calls it again
    s.typeKeys("10 C=USR(24576)\nRUN\n", { settle: 30 });
    expect(s.peek(COUNT)).toBe(2);
    expect(s.peek(0x6000)).toBe(0x21);
  });

  it("refuses code in the system area before anything runs", async () => {
    const s = await createTvcSession();
    const code = await build(".model TVC\n .org $1000\n ret");
    expect(() =>
      playInjectionFlow(s.machine as unknown as FrameMachine, [{ type: "TypeText", text: (c) => String(s.machine.placeCode(c!)) }], { code })
    ).toThrow(/\$1000/);
  });

  it("Inject writes the code where it was assembled and leaves BASIC alone", async () => {
    const s = (await createTvcSession()).bootToBasic();
    const code = await build(PROGRAM);
    expect(s.machine.injectCodeToRun(code)).toBe(0x6000);
    expect(s.peek(0x6000)).toBe(0x21);
    expect(s.peekWord(TEXT)).toBe(0x19ef);
  });
});

describe("TVC program export", () => {
  it.each(["tvc64", "tvc64p"])("%s: LOAD runs the exported .cas, and the launcher calls the code", async (model) => {
    const code = await build(PROGRAM.replace("$6000", "$1A30"));
    const placement = placeTvcCode(code.segments, code.entryAddress) as TvcPlacement;
    const cas = buildTvcCasFile(tvcProgramPayload(placement), 0x01, true);
    const s = (await createTvcSession({ model })).bootToBasic();
    s.insertTape(parseTvcCasFile(cas, "klive.cas"));
    s.typeKeys("LOAD\n", { settle: 5 });
    s.runWhileMotor();
    // --- Autostart runs the launcher: C=USR(6704)
    s.runUntil(() => s.peek(0x1a39) === 1, { maxFrames: 600 }, "the loaded code being called");
    s.runUntil(() => s.isWaitingForKey(), { maxFrames: 200 }, "BASIC's prompt");
    // --- The program is BASIC's: listed as the launcher line
    expect(s.peek(0x19ef + 3)).toBe(0x43);
  });
});
