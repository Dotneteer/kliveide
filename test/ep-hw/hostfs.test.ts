import { describe, expect, it } from "vitest";

import { createEpSession } from "../harness/enterprise";

/*
 * Klive's FILE: device (`.plans/ENTERPRISE_PLAN.md` §9.2): its ROM in segment 10h, the host's files
 * through IS-BASIC's own SAVE and LOAD, an EXOS application module started with LOAD, and the errors.
 * The files are the harness's in-memory folder (`session.files`).
 */

/** An EXOS $$APP module (type 5): the 16-byte header, then code loaded and started at 0100h */
function appModule(code: number[]): Uint8Array {
  const header = [0x00, 0x05, code.length & 0xff, code.length >> 8, ...Array(12).fill(0)];
  return Uint8Array.from([...header, ...code]);
}

describe("Klive's FILE: device", () => {
  it("is fitted at segment 10h and EXOS still boots IS-BASIC", async () => {
    const s = await createEpSession();
    expect(String.fromCharCode(...Array.from({ length: 8 }, (_, i) => s.physical(0x10 * 0x4000 + i)))).toBe("EXOS_ROM");
    s.bootToBasic();
    expect(s.screenText()).toContain("IS-BASIC");
  });

  it("saves a BASIC program to a host file and loads it back", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    await s.typeWithHost('10 PRINT "FROM THE HOST"\nSAVE "FILE:HELLO.BAS"\n');
    const saved = [...s.files.files.entries()].find(([name]) => name.toUpperCase() === "HELLO.BAS");
    expect(saved, [...s.files.files.keys()].join(",")).toBeDefined();
    // --- An IS-BASIC program file: an EXOS module header of type 4
    expect([saved![1][0], saved![1][1]]).toEqual([0x00, 0x04]);
    // --- After NEW, RUN prints nothing; after LOAD it prints the line again
    const printed = () => (s.screenText().match(/^FROM THE HOST\s*$/gm) ?? []).length;
    await s.typeWithHost("NEW\nRUN\n");
    expect(printed()).toBe(0);
    await s.typeWithHost('LOAD "FILE:HELLO.BAS"\nRUN\n');
    expect(printed()).toBe(1);
  });

  it("loads and starts an application module (.com) with LOAD", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    // --- A new application sets up its own stack first, then enables interrupts (the EXOS kernel
    // --- spec §9.3): DI / LD SP,0400h / EI / LD A,A5h / LD (0200h),A / JR $
    const code = [0xf3, 0x31, 0x00, 0x04, 0xfb, 0x3e, 0xa5, 0x32, 0x00, 0x02, 0x18, 0xfe];
    s.files.files.set("TEST.COM", appModule(code));
    await s.typeWithHost('LOAD "FILE:TEST.COM"\n', { settle: 100 });
    // --- It ran, and keeps running in its loop between EXOS's interrupts (a frame ends inside the
    // --- video interrupt's handler, so the loop is sampled instruction by instruction)
    await s.runFramesWithHost(20);
    expect(s.peek(0x0200)).toBe(0xa5);
    let inLoop = 0;
    for (let i = 0; i < 5000; i++) {
      s.step(1);
      if (s.machine.pc === 0x010a && s.wasm.epGetPageRegister(0) === 0xf8) inLoop++;
    }
    expect(inLoop).toBeGreaterThan(1000);
    expect(s.peek(0x0200)).toBe(0xa5);
  });

  it("reports a file that is not there", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    await s.typeWithHost('LOAD "FILE:NOTHERE.BAS"\n');
    expect(s.screenText()).toMatch(/\*\*\*/);
    expect(s.machine.hostFs.openFiles).toEqual([]);
  });
});
