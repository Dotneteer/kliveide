import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The Kempston mouse (catalogue MOU-001 - MOU-005).
 *
 * Hardware:
 * - zxnext.vhd ~2622-2626: $xADF buttons/wheel, $xBDF X, $xFDF Y - A11-8 and the low byte decode, A15-12
 *   do not; gated by internal port enable bit 13 ($83 bit 5). ~2630: with the mouse port off, $DF reads
 *   Kempston joystick 1 when the Specdrum port ($84 bit 7) is on. ~3557: $xADF = wheel (7-4) & '1' &
 *   not middle & not left & not right.
 * - input/ps2_mouse.v: each PS/2 packet latches the buttons and adds its X, Y and wheel deltas to 8-bit
 *   counters. xydelta by DPI ($0A bits 1-0, zxnext.vhd:1122 initial 01): 00 the data byte doubled, 01 as
 *   is, 10 / 11 the byte shifted right 1 / 2 with its bit 7 as the sign (the PS/2 delta's 9th bit is not
 *   used). $0A bit 3 swaps left and right as a packet arrives (mbutton), not what was latched before.
 *   The wheel adds the sign-extended 4-bit delta; the port shows the low nibble of the count.
 * - zxnext_top_issue4 ~1678-1701: the mouse's reset is m_reset, from the power-on reset only - a Next
 *   reset keeps the counters. $0A has no reset branch.
 */

const X = 0xfbdf;
const Y = 0xffdf;
const B = 0xfadf;

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\n jr $");
  return s.runFrames(1);
}

/** Sets $0A bit 3 (reverse) and bits 1-0 (DPI), keeping the other bits. */
function mouseControl(s: NextTestSession, reverse: boolean, dpi: number): NextTestSession {
  return s.setNextReg(0x0a, (s.readNextReg(0x0a) & ~0x0b) | (reverse ? 0x08 : 0) | (dpi & 0x03));
}

const counters = (s: NextTestSession) => [s.in(X), s.in(Y)];

describe("Kempston mouse", () => {
  // -------------------------------------------------------------------------------------------------
  // MOU-001 X / Y counters
  // -------------------------------------------------------------------------------------------------

  it("MOU-001: X and Y count the movement in 8 bits and wrap; reading does not change them", async () => {
    const s = await parked();
    expect(counters(s), "power-on").toEqual([0x00, 0x00]);
    s.mouse({ dx: 10, dy: 5 });
    expect(counters(s), "right 10, up 5").toEqual([10, 5]);
    expect(counters(s), "read again").toEqual([10, 5]);
    s.mouse({ dx: -20, dy: -10 });
    expect(counters(s), "left 20, down 10").toEqual([246, 251]);
    s.mouse({ dx: 14 }).mouse({ dx: 127 }).mouse({ dy: -128 });
    expect(counters(s), "wrap").toEqual([(246 + 14 + 127) & 0xff, (251 - 128) & 0xff]);
  });

  it("MOU-001: A15-12 do not take part in the decode", async () => {
    const s = await parked();
    s.mouse({ dx: 0x21, dy: 0x42, buttons: ["left"] });
    expect([s.in(0x0bdf), s.in(0x7bdf), s.in(0x0fdf), s.in(0x3fdf), s.in(0x0adf), s.in(0x5adf)]).toEqual([0x21, 0x21, 0x42, 0x42, 0x0d, 0x0d]);
  });

  it("MOU-001: a Next reset keeps the counters; only power-on clears them", async () => {
    const s = await parked();
    s.mouse({ dx: 33, dy: -7, wheel: 2, buttons: ["middle"] });
    s.reset();
    expect([...counters(s), s.in(B)], "soft reset").toEqual([33, 249, 0x2b]);
    s.hardReset();
    expect([...counters(s), s.in(B)], "power-on").toEqual([0, 0, 0x0f]);
  });

  // -------------------------------------------------------------------------------------------------
  // MOU-002 Buttons and wheel
  // -------------------------------------------------------------------------------------------------

  it("MOU-002: $FADF: a pressed button reads 0 (bit 0 right, 1 left, 2 middle), bit 3 is 1", async () => {
    const s = await parked();
    expect(s.in(B), "power-on").toBe(0x0f);
    expect(s.mouse({ buttons: ["left"] }).in(B), "left").toBe(0x0d);
    expect(s.mouse({ buttons: ["right"] }).in(B), "right").toBe(0x0e);
    expect(s.mouse({ buttons: ["middle"] }).in(B), "middle").toBe(0x0b);
    expect(s.mouse({ buttons: ["left", "right", "middle"] }).in(B), "all three").toBe(0x08);
    expect(s.mouse({ dx: 1 }).in(B), "held into the next packet").toBe(0x08);
    expect(s.mouse({ buttons: [] }).in(B), "released").toBe(0x0f);
  });

  it("MOU-002: the wheel adds its 4-bit delta; bits 7-4 wrap", async () => {
    const s = await parked();
    expect(s.mouse({ wheel: 3 }).in(B) >> 4, "+3").toBe(3);
    expect(s.mouse({ wheel: -5 }).in(B) >> 4, "-5").toBe(0x0e);
    expect(s.mouse({ wheel: 7 }).mouse({ wheel: 7 }).in(B) >> 4, "+14").toBe(0x0c);
  });

  // -------------------------------------------------------------------------------------------------
  // MOU-003 Button reverse
  // -------------------------------------------------------------------------------------------------

  it("MOU-003: $0A bit 3 swaps left and right as each packet arrives", async () => {
    const s = await parked();
    expect(mouseControl(s, true, 1).readNextReg(0x0a) & 0x0b, "read back").toBe(0x09);
    expect(s.mouse({ buttons: ["left"] }).in(B), "left reads as right").toBe(0x0e);
    expect(s.mouse({ buttons: ["right"] }).in(B), "right reads as left").toBe(0x0d);
    expect(s.mouse({ buttons: ["middle"] }).in(B), "middle stays").toBe(0x0b);
    // --- The latched buttons change only with the next packet
    mouseControl(s, false, 1).mouse({ buttons: ["left"] });
    expect(s.in(B)).toBe(0x0d);
    mouseControl(s, true, 1);
    expect(s.in(B), "no packet yet").toBe(0x0d);
    expect(s.mouse({ dx: 1 }).in(B), "the next packet").toBe(0x0e);
  });

  // -------------------------------------------------------------------------------------------------
  // MOU-004 DPI
  // -------------------------------------------------------------------------------------------------

  it("MOU-004: DPI 00 doubles, 01 keeps, 10 and 11 shift the packet's byte right 1 and 2", async () => {
    const s = await parked();
    expect(s.readNextReg(0x0a) & 0x0b, "power-on: DPI 01, no reverse").toBe(0x01);
    const move = (dpi: number, dx: number) => {
      const before = s.in(X);
      mouseControl(s, false, dpi).mouse({ dx });
      return (s.in(X) - before) & 0xff;
    };
    expect(move(0, 5), "00: +5").toBe(10);
    expect(move(0, -3), "00: -3").toBe(0xfa);
    expect(move(0, 100), "00: +100").toBe(200);
    expect(move(1, 5), "01: +5").toBe(5);
    expect(move(2, 5), "10: +5").toBe(2);
    expect(move(2, -5), "10: -5").toBe(0xfd);
    expect(move(3, 13), "11: +13").toBe(3);
    expect(move(3, -13), "11: -13").toBe(0xfc);
    // --- The byte's bit 7 is taken as the sign: +200 is $C8
    expect(move(2, 200), "10: +200").toBe(0xe4);
    // --- Y is scaled the same way; the count is not rescaled by a DPI change
    s.mouse({ dy: 0 });
    const y = s.in(Y);
    mouseControl(s, false, 0).mouse({ dy: 7 });
    expect((s.in(Y) - y) & 0xff, "Y at 00").toBe(14);
  });

  // -------------------------------------------------------------------------------------------------
  // MOU-005 Port enable
  // -------------------------------------------------------------------------------------------------

  it("MOU-005: $83 bit 5 clear: the ports read $FF (no $DF reader either), the mouse keeps counting", async () => {
    const s = await parked();
    s.setNextReg(0x83, s.readNextReg(0x83) & ~0x20).setNextReg(0x84, s.readNextReg(0x84) & ~0x80);
    s.mouse({ dx: 12, dy: 3, buttons: ["left"] });
    expect([s.in(X), s.in(Y), s.in(B)], "disabled").toEqual([0xff, 0xff, 0xff]);
    s.setNextReg(0x83, s.readNextReg(0x83) | 0x20);
    expect([s.in(X), s.in(Y), s.in(B)], "enabled again").toEqual([12, 3, 0x0d]);
  });

  it("MOU-005: with the mouse port off, $DF is Kempston joystick 1 (Specdrum port on)", async () => {
    const s = await parked();
    s.setNextReg(0x05, 0x40).joystick("left", "UP"); // --- joystick 1: Kempston 1
    expect(s.in(0x00df), "mouse on: A11-8 = 0 is no mouse port").toBe(0xff);
    s.setNextReg(0x83, s.readNextReg(0x83) & ~0x20).setNextReg(0x84, s.readNextReg(0x84) | 0x80);
    expect(s.in(0x00df), "the joystick").toBe(0x08);
    expect(s.in(0xfbdf), "even at a mouse address").toBe(0x08);
  });
});
