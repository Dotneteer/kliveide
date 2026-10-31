import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@common/abstractions/CodeToInject";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { EP_RUN_FILE_NAME } from "@common/enterprise/codePlacement";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { createEpSession, type EpTestSession } from "../harness/enterprise";

/*
 * Run on the Enterprise (`.plans/ENTERPRISE_PLAN.md` §12): the injection flow played as the command line
 * plays it, on the real ROMs of both models. Run stages the program as KLIVE.COM and types
 * `LOAD "FILE:KLIVE.COM"`: EXOS loads the `$$APP` at 0100h and starts it there.
 */

/**
 * Sets its own stack (EXOS starts a `$$APP` on the system stack, which the first interrupt would break),
 * counts its starts at Count, writes the border port, and waits at Done (`JR $`)
 */
const PROGRAM = `
  .model ENTERPRISE
Start:
  di
  ld sp,$4000
  ei
  ld hl,Count
  inc (hl)
  ld a,$1f
  out ($81),a
Done:
  jr Done
Count:
  .defb 0
`;

async function build(source: string): Promise<CodeToInject> {
  const out = await new Z80Assembler().compile(source, new AssemblerOptions());
  const errors = out.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  return {
    model: "ep",
    entryAddress: out.entryAddress,
    segments: out.segments.map((s) => ({ startAddress: s.startAddress, bankOffset: 0, emittedCode: s.emittedCode })),
    options: out.injectOptions
  };
}

/* di, ld sp,nn, ei (5), ld hl,Count (3), inc (hl) (1), ld a,n (2), out (n),a (2): Done at 010Dh, Count at 010Fh */
const DONE = 0x010d;
const COUNT = 0x010f;

async function run(s: EpTestSession, code: CodeToInject, done = DONE): Promise<void> {
  playInjectionFlow(s.machine as unknown as FrameMachine, await s.machine.getCodeInjectionFlow("ep"), { code, maxFrames: 2000 });
  // --- The flow kept IS-BASIC's PC: LOAD is still being typed; the FILE: device answers the loader
  for (let i = 0; i < 600 && s.peek(done + 2) !== 1; i++) await s.runFramesWithHost(1);
  // --- The program waits in its loop (between frames the CPU may be in EXOS's interrupt handler)
  s.runTo(done, { maxFrames: 5 });
}

describe("Enterprise code injection", () => {
  it.each(["ep128", "ep64"] as const)("%s: boots IS-BASIC, LOADs the program through FILE:, and EXOS starts it at 0100h", async (model) => {
    const s = await createEpSession({ model });
    await run(s, await build(PROGRAM));
    expect(s.machine.pc).toBe(DONE);
    expect(s.peek(COUNT)).toBe(1);
    // --- The program never reached the FILE: folder: Run serves it from memory
    expect([...s.files.files.keys()]).not.toContain(EP_RUN_FILE_NAME);
  });

  it("adds a JP at 0100h when the entry is elsewhere", async () => {
    const s = await createEpSession();
    await run(s, await build(PROGRAM.replace(".model ENTERPRISE", ".model ENTERPRISE\n .org $0110\n .ent Start")), DONE + 0x10);
    expect(s.peek(0x0100)).toBe(0xc3);
    expect(s.machine.pc).toBe(DONE + 0x10);
    expect(s.peek(COUNT + 0x10)).toBe(1);
  });

  it("refuses code below 0100h before anything runs", async () => {
    const s = await createEpSession();
    const code = await build(".model ENTERPRISE\n .org $0080\n ret");
    expect(() => s.machine.placeCode(code)).toThrow(/\$0080/);
  });
});
