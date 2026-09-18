import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * NMI sources and the stackless NMI (catalogue NMI-003 - NMI-007; NMI-001/002 are RST-005/004 in
 * `reset/reset-register.test.ts`).
 *
 * Hardware (`_input/next-fpga/src/zxnext.vhd`, `nextreg.txt`):
 * - ~2045-2047: an NMI cause is asserted only while its enable is set: the M1 button (F9, `hotkey_m1`)
 *   and `$02` bit 3 need `$06` bit 3, the DRIVE button (F10) and `$02` bit 2 need `$06` bit 4. Buttons
 *   (~6294, `hotkeys_0 and not hotkeys_1`) and `$02` writes (~3812) are one-cycle pulses: a cause that
 *   arrives while its enable is clear is gone, it does not wait for the enable.
 * - ~2051-2071: the arbiter latches one source while none is active (Multiface first); ~2076-2120: IDLE ->
 *   FETCH (NMI low) -> HOLD at the $0066 fetch, while the device holds (`divmmc_nmi_hold` = DivMMC
 *   automap or its button latch, divmmc.vhd ~187) -> END -> IDLE. `nmi_accept_cause` (IDLE/FETCH) gates
 *   the `$02` flags (~3820-3842): a request during HOLD neither sets its flag nor becomes an NMI.
 * - ~2008-2041 with t80n_mcode.vhd ~828-848 / ~2437-2450: the NMI acknowledge still decrements SP by 2
 *   (the CPU's push), but with `$C0` bit 3 the two write cycles (NMIACK_MSB, NMIACK_LSB) are kept off the
 *   memory bus (`cpu_mreq_n <= ... or z80_stackless_nmi`, ~1784). The written bytes land in `$C3`/`$C2`
 *   on *every* NMI acknowledge, stackless or not (nextreg.txt "always stored in these registers"). The
 *   first RETN after a stackless acknowledge (`z80_stackless_retn_en`, cleared when `$C0` bit 3 goes
 *   to 0) reads its return address from `$C2`/`$C3` instead of memory, and SP still goes up by 2.
 *   Soft reset clears `$C0` bit 3 and `$C2`/`$C3` (~2012-2015, ~5071).
 * - Nothing in that path looks at the NMI source: the Multiface NMI is stackless too.
 * - ~5468-5471: `$81` bits 6-4 are stored, bits 1-0 always 00; `$81` is not in the reset branch (only
 *   power-on initialises it). Bit 7 reads the bus ROMCS line.
 * - Z80: the NMI acknowledge copies IFF1 to IFF2 and clears IFF1; RETN copies IFF2 back (t80n.vhd
 *   `IntE_FF1 <= '0'` at the NMI cycle, `I_RETN`). An NMI is not masked by DI.
 */

/** RAM at $0000-$3FFF (MMU0/1 = pages 40/41) with DivMMC automap off, and `jp NmiEntry` at $0066. */
function ramNmiVector(s: NextTestSession): NextTestSession {
  s.setNextReg(0x0a, s.readNextReg(0x0a) & ~0x10).setNextReg(0x50, 40).setNextReg(0x51, 41);
  const entry = s.symbol("NmiEntry");
  return s.poke(0x0066, [0xc3, entry & 0xff, entry >> 8]);
}

/** Reads NextReg `reg` into A (the handler's view of $C2/$C3). */
const readReg = (reg: number, into: string) => `
        ld bc,$243b
        ld a,$${reg.toString(16)}
        out (c),a
        inc b
        in a,(c)
        ld (${into}),a`;

const STACK = 0xbff0;

/**
 * A program that raises a DivMMC NMI through `$02` bit 2 with SP = $BFF0, the two bytes below SP
 * pre-filled with the address of `StackPath` (so a pop from the stack is recognisable), and records in
 * the handler SP, $C2/$C3, and `A = I` (P/V = IFF2).
 */
async function nmiProgram(core: CoreName, opts: { c0: number; handlerTail?: string; mainTail?: string }): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld sp,$${STACK.toString(16)}
        ld hl,StackPath
        push hl                    ; the slot the NMI push would overwrite ...
        pop hl                     ; ... holds StackPath, SP back at $BFF0
        nextreg $c0,$${opts.c0.toString(16).padStart(2, "0")}
        nextreg $06,$10            ; DRIVE NMI enable
        nextreg $02,$04            ; DivMMC NMI
After:  nop
        nop
        nop
        ld a,1
        ld (Resumed),a
        ld (ResumedSp),sp
${opts.mainTail ?? ""}
        nextreg $7f,$a5
Park:   jr Park

StackPath:
        ld a,1
        ld (ViaStack),a
        nextreg $7f,$a5
        jr Park

NmiEntry:
        ld (NmiSp),sp
        ld a,i                     ; P/V = IFF2
        push af
        pop hl
        ld a,l
        ld (NmiFlags),a
${readReg(0xc2, "C2")}
${readReg(0xc3, "C3")}
${opts.handlerTail ?? ""}
        retn

Resumed:   .defb 0
ViaStack:  .defb 0
NmiFlags:  .defb 0
C2:        .defb 0
C3:        .defb 0
NmiSp:     .defw 0
ResumedSp: .defw 0
`,
    { entry: "Start" }
  );
  ramNmiVector(s);
  return s;
}

const byte = (s: NextTestSession, name: string) => s.peek(s.symbol(name));
const word = (s: NextTestSession, name: string) => s.peekWord(s.symbol(name));
const handlerSawReturn = (s: NextTestSession) => byte(s, "C2") | (byte(s, "C3") << 8);

describe.each(ALL_CORES)("NMI - %s core", (core) => {
  // -------------------------------------------------------------------------------------------------
  // NMI-003: the M1 / DRIVE buttons and their $06 enables
  // -------------------------------------------------------------------------------------------------

  it("NMI-003: F9 raises a Multiface NMI when $06 bit 3 is set; the $02 flags stay clear", async () => {
    const mfRom = readFileSync("src/public/roms/enNextMf.rom");
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n jr $");
    s.setNextReg(0x06, 0x08).runFrames(1);
    await s.pressHotkey("F9");
    s.runTo(0x0066, { maxFrames: 2 }).step(1);
    expect(Array.from(s.peekBytes(0x0000, 16)), "Multiface ROM paged in").toEqual(Array.from(mfRom.subarray(0, 16)));
    expect(s.readNextReg(0x02) & 0x1c, "$02 bits 4-2 record only NextReg / I/O trap NMIs").toBe(0x00);
  });

  it("NMI-003: F10 raises a DivMMC NMI when $06 bit 4 is set", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n jr $");
    s.setNextReg(0x06, 0x10).runFrames(1);
    await s.pressHotkey("F10");
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.peekWord(s.registers().sp)).toBe(0x8000);
    expect(s.readNextReg(0x02) & 0x1c).toBe(0x00);
  });

  it("NMI-003: F9 with $06 bit 3 clear does nothing - not even once the enable is set", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n jr $");
    s.setNextReg(0x06, 0x00).runFrames(1);
    await s.pressHotkey("F9");
    s.runFrames(2);
    expect(s.registers().pc, "no NMI while disabled").toBe(0x8000);
    // --- The press was a pulse (zxnext.vhd ~6294): enabling the button later raises nothing. (A
    // --- Multiface NMI would leave the CPU in the Multiface menu.)
    s.setNextReg(0x06, 0x08).runFrames(2);
    expect(s.registers().pc, "the lost press stays lost").toBe(0x8000);
  });

  /** A parked program with a RAM NMI handler that counts in `NmiCount`. */
  async function countingNmi(body = ""): Promise<NextTestSession> {
    const s = await createSession(core);
    await s.loadCode(
      `
        .org $8000
Start:  di
${body}
Loop:   jr Loop
NmiEntry:
        push af
        ld a,(NmiCount)
        inc a
        ld (NmiCount),a
        pop af
        retn
NmiCount: .defb 0
`,
      { entry: "Start" }
    );
    return ramNmiVector(s);
  }

  it("NMI-003: F10 with $06 bit 4 clear does nothing - not even once the enable is set", async () => {
    const s = await countingNmi();
    s.setNextReg(0x06, 0x10).runFrames(1);
    await s.pressHotkey("F10");
    s.runFrames(2);
    expect(byte(s, "NmiCount"), "the handler counts an enabled press").toBe(1);
    s.setNextReg(0x06, 0x00).runFrames(1);
    await s.pressHotkey("F10");
    s.runFrames(2);
    expect(byte(s, "NmiCount"), "no NMI while disabled").toBe(1);
    s.setNextReg(0x06, 0x10).runFrames(2);
    expect(byte(s, "NmiCount"), "the lost press stays lost").toBe(1);
  });

  it("NMI-003: a $02 NMI request with its $06 enable clear is lost too", async () => {
    const s = await countingNmi("        nextreg $06,$00\n        nextreg $02,$04\n        nextreg $06,$10");
    s.runFrames(2);
    expect(s.readNextReg(0x02) & 0x04, "the flag records the request").toBe(0x04);
    expect(byte(s, "NmiCount"), "but no NMI followed the later enable").toBe(0);
    s.setNextReg(0x02, 0x04).runFrames(1);
    expect(byte(s, "NmiCount"), "an enabled request does raise one").toBe(1);
  });

  // -------------------------------------------------------------------------------------------------
  // NMI-004 / NMI-005: stackless NMI and $C2/$C3
  // -------------------------------------------------------------------------------------------------

  it("NMI-004: stackless: SP goes down by 2, memory is untouched, $C2/$C3 hold the return address", async () => {
    const s = await nmiProgram(core, { c0: 0x08 });
    s.runUntilReady({ maxFrames: 4 });
    const ret = handlerSawReturn(s);
    const after = s.symbol("After");
    expect(ret, "an instruction boundary after the $02 write").toBeGreaterThanOrEqual(after);
    expect(ret).toBeLessThanOrEqual(after + 3);
    expect(word(s, "NmiSp"), "SP decremented by the acknowledge").toBe(STACK - 2);
    expect(s.peekWord(STACK - 2), "no push reached memory").toBe(s.symbol("StackPath"));
    expect(byte(s, "Resumed"), "RETN returned through $C2/$C3").toBe(1);
    expect(byte(s, "ViaStack"), "not through the stack").toBe(0);
    expect(word(s, "ResumedSp"), "RETN still incremented SP").toBe(STACK);
  });

  it("NMI-004: without $C0 bit 3 the NMI pushes as usual, and $C2/$C3 still record the return address", async () => {
    const s = await nmiProgram(core, { c0: 0x00 });
    s.runUntilReady({ maxFrames: 4 });
    const ret = handlerSawReturn(s);
    expect(ret, "nextreg.txt: the return address is always stored in $C2/$C3").toBeGreaterThanOrEqual(s.symbol("After"));
    expect(ret).toBeLessThanOrEqual(s.symbol("After") + 3);
    expect(word(s, "NmiSp")).toBe(STACK - 2);
    expect(s.peekWord(STACK - 2), "the push reached memory").toBe(ret);
    expect(byte(s, "Resumed")).toBe(1);
    expect(word(s, "ResumedSp")).toBe(STACK);
  });

  it("NMI-004: only the first RETN after the acknowledge uses $C2/$C3", async () => {
    const s = await nmiProgram(core, {
      c0: 0x08,
      mainTail: `
        call Sub                   ; a later RETN pops the stack normally
        ld a,1
        ld (SubReturned),a
        jr SubDone
Sub:    retn
SubReturned: .defb 0
SubDone:`
    });
    s.runUntilReady({ maxFrames: 4 });
    expect(byte(s, "Resumed")).toBe(1);
    expect(byte(s, "SubReturned")).toBe(1);
  });

  it("NMI-004: clearing $C0 bit 3 in the handler makes its RETN pop the stack", async () => {
    const s = await nmiProgram(core, { c0: 0x08, handlerTail: "        nextreg $c0,$00" });
    s.runUntilReady({ maxFrames: 4 });
    // --- z80_stackless_retn_en is cleared with nr_c0_stackless_nmi: RETN reads the (unwritten) stack
    expect(byte(s, "ViaStack"), "returned to the address left on the stack").toBe(1);
    expect(byte(s, "Resumed")).toBe(0);
  });

  it("NMI-004: the Multiface NMI is stackless too", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
        di
        ld sp,$${STACK.toString(16)}
        ld hl,$5a5a
        push hl
        pop hl
        nextreg $c0,$08
        nextreg $06,$08
        nextreg $02,$08
Loop:   jr Loop
    `);
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.registers().sp).toBe(STACK - 2);
    expect(s.peekWord(STACK - 2), "no push reached memory").toBe(0x5a5a);
    const ret = s.readNextReg(0xc2) | (s.readNextReg(0xc3) << 8);
    expect(ret).toBeGreaterThanOrEqual(0x8000);
  });

  it("NMI-005: the handler rewrites $C2/$C3 and RETN returns there", async () => {
    const s = await nmiProgram(core, {
      c0: 0x08,
      handlerTail: `
        ld hl,Redirect
        ld a,l
        nextreg $c2,a
        ld a,h
        nextreg $c3,a`,
      mainTail: `
        jr SkipRedirect
Redirect:
        ld a,1
        ld (Redirected),a
        nextreg $7f,$a5
        jr Park
Redirected: .defb 0
SkipRedirect:`
    });
    s.runUntilReady({ maxFrames: 4 });
    expect(byte(s, "Redirected")).toBe(1);
    expect(byte(s, "Resumed")).toBe(0);
    expect(byte(s, "ViaStack")).toBe(0);
  });

  it("NMI-005: $C2/$C3 read back what was written; a soft reset clears them and $C0 bit 3", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n jr $");
    s.setNextReg(0xc2, 0x34).setNextReg(0xc3, 0x12).setNextReg(0xc0, 0x08);
    expect([s.readNextReg(0xc2), s.readNextReg(0xc3), s.readNextReg(0xc0) & 0x08]).toEqual([0x34, 0x12, 0x08]);
    s.reset();
    expect([s.readNextReg(0xc2), s.readNextReg(0xc3), s.readNextReg(0xc0) & 0x08]).toEqual([0x00, 0x00, 0x00]);
  });

  // -------------------------------------------------------------------------------------------------
  // NMI-006: NMI and maskable interrupts, NMI nesting
  // -------------------------------------------------------------------------------------------------

  it("NMI-006: an NMI interrupts an IM 1 handler; IFF2 is clear inside it and RETN keeps interrupts off", async () => {
    const s = await createSession(core);
    await s.loadCode(
      `
        .org $8000
Start:  di
        im 1
        nextreg $06,$10
        ei
        nextreg $7f,$a5
Park:   jr Park

Im1Entry:
        ld a,1
        call LogA
        nextreg $02,$04            ; NMI inside the maskable handler
        nop
        nop
        ld a,i                     ; P/V = IFF2 after the RETN
        push af
        pop hl
        ld a,l
        ld (AfterNmiFlags),a
        ld a,3
        call LogA
        ld a,(Im1Count)
        inc a
        ld (Im1Count),a
        cp 1
        jr nz,Im1Out
        ei
Im1Out: ret

NmiEntry:
        ld a,i
        push af
        pop hl
        ld a,l
        ld (NmiFlags),a
        ld a,2
        call LogA
        retn

LogA:   push hl
        ld hl,(LogPtr)
        ld (hl),a
        inc hl
        ld (LogPtr),hl
        pop hl
        ret
LogPtr: .defw Log
Log:    .defs 16
Im1Count:      .defb 0
NmiFlags:      .defb 0
AfterNmiFlags: .defb 0
`,
      { entry: "Start" }
    );
    ramNmiVector(s);
    const im1 = s.symbol("Im1Entry");
    s.poke(0x0038, [0xc3, im1 & 0xff, im1 >> 8]);
    s.runUntilReady().runFrames(2);
    const log = Array.from(s.peekBytes(s.symbol("Log"), 3));
    expect(log, "handler start, NMI, handler end").toEqual([1, 2, 3]);
    expect(byte(s, "NmiFlags") & 0x04, "IFF2 = 0 inside the NMI (IFF1 was 0)").toBe(0);
    expect(byte(s, "AfterNmiFlags") & 0x04, "RETN restored IFF1 = IFF2 = 0").toBe(0);
  });

  it("NMI-006: an NMI in EI code preserves IFF2; no maskable interrupt runs inside the NMI handler", async () => {
    const s = await createSession(core);
    await s.loadCode(
      `
        .org $8000
Start:  di
        im 1
        nextreg $06,$10
        ei
        halt                       ; frame start
        nextreg $02,$04
        nop
        ld a,(Im1Count)
        ld (CountAfter),a
        nextreg $7f,$a5
Park:   jr Park

Im1Entry:
        push af
        ld a,(Im1Count)
        inc a
        ld (Im1Count),a
        pop af
        ei
        ret

NmiEntry:
        ld a,i
        push af
        pop hl
        ld a,l
        ld (NmiFlags),a
        ld a,(Im1Count)
        ld (CountIn),a
        ld bc,6000                 ; ~1.5 frames at 3.5 MHz
Wait:   dec bc
        ld a,b
        or c
        jr nz,Wait
        ld a,(Im1Count)
        ld (CountOut),a
        retn

Im1Count:   .defb 0
CountIn:    .defb 0
CountOut:   .defb 0
CountAfter: .defb 0
NmiFlags:   .defb 0
`,
      { entry: "Start" }
    );
    ramNmiVector(s);
    const im1 = s.symbol("Im1Entry");
    s.poke(0x0038, [0xc3, im1 & 0xff, im1 >> 8]);
    s.runUntilReady({ maxFrames: 6 }).runFrames(2);
    expect(byte(s, "NmiFlags") & 0x04, "IFF2 kept the EI state").toBe(0x04);
    expect(byte(s, "CountOut"), "IFF1 = 0: frame interrupts skipped inside the NMI").toBe(byte(s, "CountIn"));
    expect(byte(s, "Im1Count"), "RETN re-enabled them").toBeGreaterThan(byte(s, "CountOut"));
  });

  it("NMI-006: while DivMMC holds the NMI, another $02 request neither sets its flag nor nests", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n nextreg $06,$10\n nextreg $02,$04\nLoop: jr Loop");
    // --- DivMMC automap on: the NMI button latch holds the state machine in HOLD until RETN
    s.setNextReg(0x0a, s.readNextReg(0x0a) | 0x10);
    s.runTo(0x0066, { maxFrames: 2 }).step(1);
    const sp = s.registers().sp;
    s.setNextReg(0x02, 0x00);
    expect(s.readNextReg(0x02) & 0x04).toBe(0x00);
    s.setNextReg(0x02, 0x04);
    expect(s.readNextReg(0x02) & 0x04, "nmi_accept_cause = 0 in HOLD").toBe(0x00);
    // --- A nested NMI would push again (SP - 2) and restart at $0066
    s.step(3);
    expect(s.registers().sp).toBeGreaterThanOrEqual(sp - 1);
  });

  // -------------------------------------------------------------------------------------------------
  // NMI-007: expansion bus NMI debounce ($81 bit 5)
  // -------------------------------------------------------------------------------------------------

  it("NMI-007: $81 stores bits 6-4, reads bits 1-0 as 0, and keeps them over a soft reset", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n jr $");
    s.setNextReg(0x81, 0x73);
    expect(s.readNextReg(0x81) & 0x7f).toBe(0x70);
    s.setNextReg(0x81, 0x20);
    expect(s.readNextReg(0x81) & 0x7f, "bit 5: debounce disable").toBe(0x20);
    s.reset();
    expect(s.readNextReg(0x81) & 0x7f, "not in the reset branch").toBe(0x20);
    s.hardReset();
    expect(s.readNextReg(0x81) & 0x7f).toBe(0x00);
  });
});
