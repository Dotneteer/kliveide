import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@common/abstractions/CodeToInject";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { createHtSession, Ht1080zTestSession } from "../harness/ht1080z";

/*
 * Run, Debug and Inject on the HT-1080Z (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` Phase 2): the
 * injection flow, played as the command line plays it, on the real ROMs.
 */

/** Prints its message through the ROM's display routine (0033h) and returns to BASIC */
const HELLO = `
  .model HT1080Z
  .org $7000
Start:
  ld hl,Message
Next:
  ld a,(hl)
  or a
  ret z
  call $0033
  inc hl
  jr Next
Message:
  .defm "HELLO FROM KLIVE"
  .defb 13, 0
`;

async function build(source: string): Promise<CodeToInject> {
  const out = await new Z80Assembler().compile(source, new AssemblerOptions());
  const errors = out.errors.filter((e) => !e.isWarning);
  if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  return {
    model: "ht1080z",
    entryAddress: out.entryAddress,
    segments: out.segments.map((s) => ({ startAddress: s.startAddress, bankOffset: 0, emittedCode: s.emittedCode })),
    options: out.injectOptions
  };
}

async function run(model: string, source: string): Promise<Ht1080zTestSession> {
  const s = await createHtSession({ model });
  const code = await build(source);
  playInjectionFlow(s.machine as unknown as FrameMachine, await s.machine.getCodeInjectionFlow("ht1080z"), { code });
  return s;
}

describe("HT-1080Z code injection", () => {
  it.each(["ht1080z-s1", "ht1080z-s2", "ht1080z-64", "ht1080z-s2-48k"])(
    "%s: answers the power-on question, starts the code, and RET goes back to BASIC",
    async (model) => {
      const s = await run(model, HELLO);
      // --- The flow left PC at the entry, with BASIC's memory top below the code
      expect(s.machine.pc).toBe(0x7000);
      expect(s.peekWord(0x40b1)).toBeLessThan(0x7000);
      s.runFrames(50);
      const text = s.screenText().filter((l) => l);
      // --- The ROM prints at the cursor, after the > prompt the flow typed at
      expect(text.some((l) => l.endsWith("HELLO FROM KLIVE"))).toBe(true);
      expect(text[text.length - 1]).toBe(">_");
      // --- BASIC works, and does not reach the code
      s.typeKeys("PRINT 6*7\n", { settle: 20 });
      expect(s.screenText().join("\n")).toContain(" 42");
      expect(s.peek(0x7000)).toBe(0x21);
    }
  );

  it("refuses code in ROM, beyond a 16K machine's RAM, or too low for BASIC", async () => {
    const s = await createHtSession();
    const flow = await s.machine.getCodeInjectionFlow("ht1080z");
    for (const [org, message] of [
      ["$3000", /ROM or keyboard area/],
      ["$8000", /beyond the RAM of this 16K/],
      ["$4400", /less than 1K/]
    ] as const) {
      const code = await build(`.model HT1080Z\n .org ${org}\n nop`);
      expect(() => playInjectionFlow(s.machine as unknown as FrameMachine, flow, { code })).toThrow(message);
    }
  });

  it("refuses code built for another machine", async () => {
    const s = await createHtSession();
    await expect(s.machine.getCodeInjectionFlow("sp48")).rejects.toThrow(/cannot run on this virtual machine/);
  });

  it("Inject writes the code and points USR at it: X=USR(0) runs it", async () => {
    const s = (await createHtSession()).bootToPrompt();
    const code = await build(HELLO);
    expect(s.machine.injectCodeToRun(code)).toBe(0x7000);
    expect(s.peekWord(0x408e)).toBe(0x7000);
    s.typeKeys("X=USR(0)\n", { settle: 40 });
    expect(s.screenText().some((l) => l.includes("HELLO FROM KLIVE"))).toBe(true);
  });

  it("starts at .ent, and leaves code in video RAM unprotected but written", async () => {
    const s = await run(
      "ht1080z-s2",
      `.model HT1080Z
  .org $3C00
  .defm "XY"
  .org $7100
Loop: jr Loop
  .org $7000
Main: jp Loop
  .ent Main`
    );
    expect(s.machine.pc).toBe(0x7000);
    s.runFrames(2);
    expect(s.machine.pc).toBe(0x7100);
    // --- The answer was the lowest segment in RAM, not the video RAM's
    expect(s.peekWord(0x40b1)).toBe(0x7000 - 2);
  });
});

describe("HT-1080Z export round trip", () => {
  it.each(["cmd", "cas"] as const)("an exported .%s loads with SYSTEM and starts the code", async (format) => {
    const { ht1080zExportFile } = await import("@renderer/appIde/utils/ht1080z-code");
    // --- SYSTEM pushes no return address: a program started by it goes back to BASIC with JP 06CCh
    const code = await build(HELLO.replace("ret z", "jp z,$06CC"));
    const file = ht1080zExportFile(format, code, "ht1080z", {}, "HELLO");
    if (!("data" in file)) throw new Error(file.error);
    const s = await createHtSession();
    s.loadTape(Ht1080zTestSession.tape(Array.from(file.data), `hello.${format}`), { maxFrames: 6000 });
    s.runFrames(50);
    const text = s.screenText().filter((l) => l);
    expect(text.some((l) => l.includes("HELLO FROM KLIVE"))).toBe(true);
    expect(text[text.length - 1]).toBe(">_");
  });
});
