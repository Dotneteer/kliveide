import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * PAR-006: checkpoint restore - a checkpoint captured mid-frame continues exactly as the uninterrupted
 * machine does: frames, tacts, registers, RAM, the displayed pictures and the audio.
 *
 * `captureCheckpoint` copies the core's linear memory. The run after the capture is recorded, the
 * checkpoint restored and the run recorded again; a second session runs the same script without any
 * checkpoint, as the reference both must match (so capturing has no side effect either).
 *
 * The program keeps state everywhere a checkpoint can lose it: IM2 with the ULA and a line interrupt,
 * CPU speed changes, a running copper, the AY, the beeper and the screen.
 */

const PROGRAM = `
        .org $8000
        di
        ld hl,$fe00
        ld de,$fe01
        ld bc,256
        ld (hl),$fd
        ldir
        ld a,$c3
        ld ($fdfd),a
        ld hl,Handler
        ld ($fdfe),hl
        ld a,$fe
        ld i,a
        im 2
        nextreg $23,80
        nextreg $22,%00000010
        ; --- copper: the fallback colour changes at line 60, back at line 120, every frame
        nextreg $61,0
        nextreg $62,0
        ld hl,CopperList
        ld b,CopperEnd-CopperList
CopperLoad:
        ld a,(hl)
        nextreg $60,a
        inc hl
        djnz CopperLoad
        nextreg $62,$c0
        ; --- the AY: tone A
        ld bc,$fffd
        xor a
        out (c),a
        ld b,$bf
        ld a,$60
        out (c),a
        ld b,$ff
        ld a,7
        out (c),a
        ld b,$bf
        ld a,$3e
        out (c),a
        ld b,$ff
        ld a,8
        out (c),a
        ld b,$bf
        ld a,$0f
        out (c),a
        ei
Main:
        ld hl,$4000
        ld de,(Counter)
        ld b,32
Fill:
        ld (hl),e
        inc hl
        inc e
        djnz Fill
        ld a,e
        and $10
        out ($fe),a              ; the beeper
        jr Main

Handler:
        push af
        push hl
        ld hl,(Counter)
        inc hl
        ld (Counter),hl
        ld a,l
        rrca
        rrca
        rrca
        and 3
        nextreg $07,a
        pop hl
        pop af
        ei
        reti

CopperList:
        .defb $80, 60, $4a, $e0
        .defb $80, 120, $4a, $1c
        .defb $ff, $ff
CopperEnd .equ $

Counter .defw 0
`;

const FRAMES = 12;

function checksum(bytes: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum = (Math.imul(sum, 31) + bytes[i]) | 0;
  return sum >>> 0;
}

/** Runs FRAMES frames from where the session stands and records what the machine did. */
function record(s: NextTestSession) {
  s.startAudio();
  const frames: object[] = [];
  for (let f = 0; f < FRAMES; f++) {
    s.runFrames(1);
    frames.push({
      frames: s.frames,
      tacts: s.tacts,
      regs: s.registers(),
      ram: checksum(s.peekBytes(0x4000, 0xc000)),
      screen: checksum(s.screen().rgba),
      copper: s.readNextReg(0x61) | (s.readNextReg(0x62) << 8)
    });
  }
  return { frames, audio: checksum(s.audio().map((x) => Math.round(x.left * 32768) & 0xffff)) };
}

/** Loads the program and stops mid-frame, at the first `Fill` of the frame after the fourth. */
async function toMidFrame(s: NextTestSession) {
  await s.loadCode(PROGRAM);
  s.runFrames(4).runTo("Fill");
}

describe("PAR-006: checkpoint restore", () => {
  it(`a mid-frame checkpoint continues as the uninterrupted machine for ${FRAMES} frames`, { timeout: 120_000 }, async () => {
    const wasm = await createSession({ audioSampleRate: 43_750 });
    await toMidFrame(wasm);
    wasm.captureCheckpoint("mid");
    const first = record(wasm);
    wasm.restoreCheckpoint("mid");
    const restored = record(wasm);

    const plain = await createSession({ audioSampleRate: 43_750 });
    await toMidFrame(plain);
    const reference = record(plain);

    expect(restored, "the restored run repeats the first").toEqual(first);
    expect(first, "and matches a run that took no checkpoint").toEqual(reference);
  });
});
