import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The listings of the input chapter (docs/content/en/under-the-hood/emulator-internals/next-input.mdx),
 * run as they are printed there: the key joystick programmed as Q A O P and SPACE, the extra keys read
 * from NextReg $B0 with their matrix entries cancelled by NextReg $68 bit 4, and the mouse's X movement
 * as a signed difference of two counter reads. The hardware facts behind them are in keyboard.test.ts,
 * joystick.test.ts and mouse.test.ts (KEY-004, KEY-005, KEY-007, MOU-001).
 */

const LISTINGS = `
        .org $8000
Start:  di
        nextreg $7f,$a5
        jr $

; Left joystick as Q A O P and SPACE (mode 111)
SetQaop:
        nextreg $28,$80        ; the key joystick's map
        nextreg $29,$00        ; left connector, button 0
        ld hl,Qaop
        ld b,12
QNext:  ld a,(hl)
        nextreg $2b,a          ; store, step to next button
        inc hl
        djnz QNext
        ld bc,$243b            ; read NextReg $05
        ld a,$05
        out (c),a
        inc b                  ; $253B
        in a,(c)
        or %11001000           ; joystick 1: mode 111
        nextreg $05,a
        ret
Qaop:   .defb $28,$29,$08,$10  ; R=P L=O D=A U=Q
        .defb $38,$07,$07,$07  ; B=SPACE; C A START: none
        .defb $07,$07,$07,$07  ; Y Z X MODE: none

; The arrows from NextReg $B0, without CAPS SHIFT
Arrows:
        ld bc,$243b
        ld a,$68               ; ULA Control
        out (c),a
        inc b
        in a,(c)
        or %00010000           ; bit 4: no matrix entries
        out (c),a
        dec b
        ld a,$b0               ; Extended Keys 0
        out (c),a
        inc b
        in a,(c)
        and %00001111          ; UP DOWN LEFT RIGHT
        ret

; A = the mouse's X movement since the last call
MouseDx:
        ld bc,$fbdf            ; the X counter
        in a,(c)
        ld hl,LastX
        ld c,(hl)              ; the count read last time
        ld (hl),a              ; keep this one for next time
        sub c                  ; the difference, wrapped
        ret
LastX:  .defb 0
`;

async function chapter(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(LISTINGS, { entry: "Start" });
  return s.runUntilReady();
}

const ROW = { qwert: 0xfbfe, asdfg: 0xfdfe, poiuy: 0xdffe, space: 0x7ffe, caps: 0xfefe, n12345: 0xf7fe, n09876: 0xeffe };
const cols = (s: NextTestSession, port: number) => s.in(port) & 0x1f;

describe("the input chapter's listings", () => {
  it("SetQaop: the left joystick presses Q A O P and SPACE; joystick 2's mode is kept", async () => {
    const s = await chapter();
    const before = s.readNextReg(0x05);
    s.call("SetQaop");
    const after = s.readNextReg(0x05);
    expect(after & 0xc8, "joystick 1 = 111").toBe(0xc8);
    expect(after & 0x32, "joystick 2 untouched").toBe(before & 0x32);
    const cases: Array<[string, number, number]> = [
      ["UP", ROW.qwert, 0x1e], // --- Q, bit 0
      ["DOWN", ROW.asdfg, 0x1e], // --- A, bit 0
      ["LEFT", ROW.poiuy, 0x1d], // --- O, bit 1
      ["RIGHT", ROW.poiuy, 0x1e], // --- P, bit 0
      ["B", ROW.space, 0x1e] // --- SPACE, bit 0
    ];
    for (const [button, port, value] of cases) {
      s.joystick("left", button as "UP").runFrames(1);
      expect(cols(s, port), button).toBe(value);
      s.joystick("left").runFrames(1);
      expect(cols(s, port), `${button} released`).toBe(0x1f);
    }
    // --- An unprogrammed button presses nothing
    s.joystick("left", "C").runFrames(1);
    expect(Object.values(ROW).map((p) => cols(s, p)), "C: no key").toEqual(Object.values(ROW).map(() => 0x1f));
  });

  it("Arrows: UP and LEFT read from $B0 while the matrix shows no CAPS SHIFT", async () => {
    const s = await chapter();
    s.keyDown("UP", "LEFT").runFrames(1);
    expect(cols(s, ROW.caps), "CAPS SHIFT before the listing").toBe(0x1e);
    expect([cols(s, ROW.n12345), cols(s, ROW.n09876)], "5 and 7 before the listing").toEqual([0x0f, 0x17]);
    s.call("Arrows");
    expect(s.registers().a, "UP bit 3, LEFT bit 1").toBe(0x0a);
    expect(cols(s, ROW.caps), "no CAPS SHIFT").toBe(0x1f);
    expect([cols(s, ROW.n12345), cols(s, ROW.n09876)], "no 5 or 7").toEqual([0x1f, 0x1f]);
  });

  it("MouseDx: the signed X movement between two calls, across the counter's wrap", async () => {
    const s = await chapter();
    s.call("MouseDx");
    s.mouse({ dx: 5 });
    s.call("MouseDx");
    expect(s.registers().a, "5 right").toBe(5);
    s.mouse({ dx: -3 });
    s.call("MouseDx");
    expect(s.registers().a, "3 left").toBe(0xfd);
    // --- From 2 to 250: the counter wraps below 0, the difference is still -8
    s.mouse({ dx: -8 });
    expect(s.in(0xfbdf), "the counter wrapped").toBe(0xfa);
    s.call("MouseDx");
    expect(s.registers().a, "8 left").toBe(0xf8);
  });
});
