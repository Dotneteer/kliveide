import { describe, expect, it } from "vitest";

import { createSp48Session } from "..";

describe("ZX Spectrum 48K harness", () => {
  it("boots the real ROM to the BASIC main entry", async () => {
    const s = await createSp48Session();
    s.bootToBasic();

    expect(s.machine.pc).toBe(0x12ac);
    expect(s.machine.isOsInitialized).toBe(true);
    // --- RAMTOP (23730) points at the top of the 48K RAM after a normal boot
    expect(s.peekWord(23730)).toBe(0xff57);
    // --- The copyright message is on the bottom line... of the lower screen, which boot clears
    // --- when it reaches the main loop; the upper screen is blank.
    expect(s.screenLine(0)).toBe("");
  });

  it("loads code, calls it and returns to the caller", async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    await s.loadCode(`
          .org $8000
      Main:
          ld hl,$1234
          ld (Result),hl
          ret
      Result:
          .defw 0
    `);

    s.call("Main");

    expect(s.machine.pc).toBe(0x12ac);
    expect(s.peekWord(s.program!.symbol("Result"))).toBe(0x1234);
  });

  it("reads text printed through the ROM from the screen", async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    await s.loadCode(`
          .org $8000
      Main:
          ld a,2
          call $1601        ; open stream 2 (upper screen)
          ld de,Text
          ld bc,TextEnd-Text
          call $203c        ; PR-STRING
          ret
      Text:
          .defm "Hello, 48K"
      TextEnd:
    `);

    s.call("Main");

    expect(s.screenLine(0)).toBe("Hello, 48K");
  });

  it("stops at an address breakpoint and continues to the next one", async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    const program = await s.loadCode(`
          .org $8000
      Main:
          nop
      First:
          nop
      Second:
          nop
          ret
    `);
    const debugSupport = s.attachDebugSupport();
    debugSupport.addBreakpoint({ address: program.symbol("First"), exec: true });
    debugSupport.addBreakpoint({ address: program.symbol("Second"), exec: true });

    expect(s.callToBreakpoint("Main")).toBe(program.symbol("First"));
    expect(s.continueToBreakpoint()).toBe(program.symbol("Second"));
  });
});
