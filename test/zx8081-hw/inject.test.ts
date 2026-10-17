import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { playInjectionFlow } from "@common/headless/frameRunner";
import { createZx81Session, Zx81TestSession } from "../harness/zx81";

/**
 * Running built code on the ZX81 and ZX80 (`.plans/ZX8081_CODE_INJECTION_PLAN.md` D4): the machine's
 * own injection flow, played as the IDE plays it - boot to the editor's key wait, write the
 * `1 REM`/`2 RAND USR` program, type RUN - on the real cores.
 *
 * The code stores $5A in a byte of its own and returns:
 *   ld a,$5a / ld (marker),a / ret / marker: nop
 */
const zx81Code = (model = "zx81"): CodeToInject => ({
  model,
  segments: [{ startAddress: 0x4082, bankOffset: 0, emittedCode: [0x3e, 0x5a, 0x32, 0x88, 0x40, 0xc9, 0x00] }],
  options: {}
});
const ZX81_MARKER = 0x4088;
const zx80Code = (): CodeToInject => ({
  model: "zx80",
  segments: [{ startAddress: 0x402b, bankOffset: 0, emittedCode: [0x3e, 0x5a, 0x32, 0x31, 0x40, 0xc9, 0x00] }],
  options: {}
});
const ZX80_MARKER = 0x4031;

async function runInjected(s: Zx81TestSession, code: CodeToInject, marker: number): Promise<void> {
  const flow = await s.machine.getCodeInjectionFlow(code.model);
  playInjectionFlow(s.machine, flow, { code });
  s.runUntil(() => s.peek(marker) === 0x5a, { maxFrames: 300 }, "the code to run");
  s.runFrames(50);
}

describe("ZX81 code injection", () => {
  it.each(["zx81-16k", "zx81-1k"])("%s: RUN calls the code and it returns to BASIC", async (model) => {
    const s = await createZx81Session({ model });
    s.bootToBasic();
    await runInjected(s, zx81Code(), ZX81_MARKER);
    expect(s.screenText()[23]).toBe("0/2");
  });

  it("replaces a program that is already there", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    s.typeKeys('10P"HELLO"\n', { settle: 80 });
    expect(s.peekWord(0x400c)).toBeGreaterThan(0x407d);
    await runInjected(s, zx81Code(), ZX81_MARKER);
    s.typeKeys("\n", { settle: 100 });
    const screen = s.screenText();
    expect(screen[0]).toMatch(/^ {3}1 REM /);
    expect(screen.join("\n")).not.toContain("HELLO");
  });

  it("injects twice in a row", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    await runInjected(s, zx81Code(), ZX81_MARKER);
    s.poke(ZX81_MARKER, 0);
    await runInjected(s, zx81Code(), ZX81_MARKER);
    expect(s.screenText()[23]).toBe("0/2");
  });

  it("accepts code with no .model (the machine's id) and refuses other models", async () => {
    const s = await createZx81Session();
    await expect(s.machine.getCodeInjectionFlow("zx81")).resolves.toBeDefined();
    await expect(s.machine.getCodeInjectionFlow("zx80")).rejects.toThrow(/'zx80' cannot run/);
    await expect(s.machine.getCodeInjectionFlow("sp48")).rejects.toThrow(/'sp48' cannot run/);
  });

  it("reports code it cannot lay out", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const code = zx81Code();
    code.segments[0].startAddress = 0x4040;
    expect(() => s.machine.injectCodeToRun(code)).toThrow(/system variables/);
  });

  it("stops at a breakpoint in the injected code", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const code = zx81Code();
    playInjectionFlow(s.machine, await s.machine.getCodeInjectionFlow("zx81"), { code });
    s.attachDebugSupport();
    s.breakpoint(0x4084);
    expect(s.debug("continue", { maxFrames: 300 })).toBe(0x4084);
    expect(s.machine.a).toBe(0x5a);
    expect(s.debug("stepInto")).toBe(0x4087);
    expect(s.peek(ZX81_MARKER)).toBe(0x5a);
  });
});

describe("ZX80 code injection", () => {
  it.each(["zx80-16k", "zx80-1k"])("%s: RUN calls the code and it returns to BASIC", async (model) => {
    const s = await createZx81Session({ machineId: "zx80", model });
    s.bootToBasic();
    await runInjected(s, zx80Code(), ZX80_MARKER);
    expect(s.screenText().join("\n")).toContain("0/2");
  });

  it("replaces a program that is already there", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.bootToBasic();
    s.typeKeys('10O"HI"\n', { settle: 30 });
    await runInjected(s, zx80Code(), ZX80_MARKER);
    expect(s.screenText().join("\n")).toContain("0/2");
  });

  it("runs ZX81 code on a ZX80 with the 8K ROM", async () => {
    const s = await createZx81Session({ machineId: "zx80", model: "zx80-8krom-16k" });
    s.bootToBasic();
    // --- "zx80" stays accepted: it is also this machine's id, which code with no .model arrives as
    await expect(s.machine.getCodeInjectionFlow("sp48")).rejects.toThrow(/cannot run/);
    await runInjected(s, zx81Code(), ZX81_MARKER);
  });

  /*
   * The IDE plays its flows on a machine it has just reset, not on one that has sat at the prompt: the
   * 4K ROM takes a key only after it has seen 4 key-free frames, which a machine that has only just
   * reached its key wait has not. A first key pressed at once is lost (Load and Run used to stop at
   * the K cursor).
   */
  it("runs injected code on a ZX80 started from a reset, as the IDE starts it", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    await runInjected(s, zx80Code(), ZX80_MARKER);
    expect(s.screenText().join("\n")).toContain("0/2");
  });

  it("plays the tape-load flow on a ZX80 started from a reset: LOAD, then RUN", async () => {
    const s = await createZx81Session({ machineId: "zx80" });
    s.insertProgram(Zx81TestSession.readProgram(join(__dirname, "fixtures/hi.o")));
    playInjectionFlow(s.machine, s.machine.getTapeLoadFlow());
    // --- The ROM finished the load and the machine queued RUN; the program prints HI
    s.runUntil(() => s.machine.getKeyQueueLength() > 0, { maxFrames: 600 }, "the end of the load");
    s.runUntil(() => s.screenText()[0] === "HI", { maxFrames: 300 }, "the program to run");
  });

  it("plays the tape-load flow on a ZX80 with the 8K ROM (its prompt waits in FAST mode)", async () => {
    const s = await createZx81Session({ machineId: "zx80", model: "zx80-8krom-16k" });
    s.bootToBasic();
    s.insertProgram(Zx81TestSession.readProgram("basic/BASE.p"));
    playInjectionFlow(s.machine, s.machine.getTapeLoadFlow());
    s.runUntil(() => s.screenText()[23] === "0/0" || s.machine.getKeyQueueLength() > 0, { maxFrames: 600 }, "the load");
  });
});
