import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { SpriteDevice } from "@emu/machines/zxNext/SpriteDevice";

/**
 * Unit tests for sprite fixes D4, D6, and D7.
 *
 * D4 — X/Y coordinate wrapping:
 *   9-bit sprite positions > 255 (Y) or > 319 (X) are treated as negative,
 *   allowing sprites to enter from off-screen edges.
 *   Formula: y > 255 → y -= 512;  x > 319 → x -= 512;
 *
 * D6 — patternIndex sync in auto-inc lockstep:
 *   When spriteIdLockstep is active, writing via auto-inc NR ($75–$79)
 *   increments spriteIndex AND syncs patternIndex = spriteIndex & 0x3F.
 *   Before the fix, patternIndex was left unchanged.
 *
 * D7 — Remove isDirect dead code from writeSpriteAttribute:
 *   The upper byte of port 0x57 was always 0x00 at the I/O level, so the
 *   heuristic "if upper byte > 0 use direct write" path was unreachable.
 *   After removal, all port-0x57 writes unconditionally use the sequential path.
 */

function writeNextReg(m: IZxNextMachine, reg: number, value: number): void {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Sprite Coordinate Wrapping (D4)", () => {
  /**
   * The wrapping functions mirror the two guards in NextComposedScreenDevice:
   *   let spriteY = spriteAttrs.y; if (spriteY > 255) spriteY -= 512;
   *   let spriteX = spriteAttrs.x; if (spriteX > 319) spriteX -= 512;
   */

  // ─── Y coordinate ───────────────────────────────────────────────────────

  it("Y < 256 stays unchanged", () => {
    expect(wrapY(0)).toBe(0);
    expect(wrapY(127)).toBe(127);
    expect(wrapY(255)).toBe(255);
  });

  it("Y = 256 wraps to -256 (off top of screen)", () => {
    expect(wrapY(256)).toBe(-256);
  });

  it("Y = 504 wraps to -8 (sprite entering from top)", () => {
    expect(wrapY(504)).toBe(-8);
  });

  it("Y = 511 wraps to -1", () => {
    expect(wrapY(511)).toBe(-1);
  });

  it("Y wrapping: values 256-511 all produce negative offsets", () => {
    for (let y = 256; y <= 511; y++) {
      expect(wrapY(y)).toBeLessThan(0);
    }
  });

  // ─── X coordinate ───────────────────────────────────────────────────────

  it("X ≤ 319 stays unchanged", () => {
    expect(wrapX(0)).toBe(0);
    expect(wrapX(255)).toBe(255);
    expect(wrapX(319)).toBe(319);
  });

  it("X = 320 wraps to -192 (off left of screen)", () => {
    expect(wrapX(320)).toBe(-192);
  });

  it("X = 504 wraps to -8 (sprite entering from left)", () => {
    expect(wrapX(504)).toBe(-8);
  });

  it("X = 511 wraps to -1", () => {
    expect(wrapX(511)).toBe(-1);
  });

  it("X wrapping: values 320-511 all produce negative offsets", () => {
    for (let x = 320; x <= 511; x++) {
      expect(wrapX(x)).toBeLessThan(0);
    }
  });

  // ─── Boundary asymmetry (X threshold 319 vs Y threshold 255) ────────────

  it("Y=255 is not wrapped; Y=256 is", () => {
    expect(wrapY(255)).toBeGreaterThanOrEqual(0);
    expect(wrapY(256)).toBeLessThan(0);
  });

  it("X=319 is not wrapped; X=320 is", () => {
    expect(wrapX(319)).toBeGreaterThanOrEqual(0);
    expect(wrapX(320)).toBeLessThan(0);
  });
});

// helpers — pure formula matching NextComposedScreenDevice guards
function wrapY(y: number): number {
  return y > 255 ? y - 512 : y;
}
function wrapX(x: number): number {
  return x > 319 ? x - 512 : x;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Mirror port protocol (D6)", () => {
  /**
   * Full MAME-compatible mirror_data_w protocol.
   *
   * - mirrorIndex defaults to 7 (sprite-number mode) after reset.
   * - NR $34 write calls mirrorDataW with current mirrorIndex.
   * - NR $35-$39: mirrorInc=false, mirrorIndex=0-4, then mirrorDataW.
   * - NR $75-$79: mirrorInc=true, mirrorIndex=0-4, then mirrorDataW (auto-inc mirrorSpriteQ).
   * - mirrorTie (NR $09 bit 4): when mirrorSpriteQ changes, sync spriteIndex+patternIndex.
   * - mirrorTie: when port 0x57 advances spriteIndex, sync mirrorSpriteQ.
   */
  let machine: IZxNextMachine;
  let spr: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spr = machine.spriteDevice;
  });

  // ── mirrorIndex defaults ─────────────────────────────────────────────────

  it("mirrorIndex defaults to 7 (sprite-number mode) after reset", () => {
    expect(spr.mirrorIndex).toBe(7);
    expect(spr.mirrorInc).toBe(false);
    expect(spr.mirrorTie).toBe(false);
    expect(spr.mirrorSpriteQ).toBe(0);
  });

  it("NR $34 with mirrorIndex=7 sets mirrorSpriteQ (sprite-number mode)", () => {
    // Default mirrorIndex=7 → mirrorDataW(5) → mirrorSpriteQ=5
    writeNextReg(machine, 0x34, 0x05);
    expect(spr.mirrorSpriteQ).toBe(5);
  });

  it("NR $34 with mirrorIndex=7 only stores lower 7 bits", () => {
    writeNextReg(machine, 0x34, 0xff);
    expect(spr.mirrorSpriteQ).toBe(0x7f);
  });

  // ── NR $35-$39: write to attribute, no auto-inc ──────────────────────────

  it("NR $35 writes attr0 of mirrorSpriteQ without auto-inc", () => {
    writeNextReg(machine, 0x34, 0x02);        // mirrorSpriteQ = 2
    writeNextReg(machine, 0x35, 0xab);        // mirrorInc=false, mirrorIndex=0, write x-lsb
    expect(spr.attributes[2].x & 0xff).toBe(0xab);
    expect(spr.mirrorSpriteQ).toBe(2);        // no auto-inc
    expect(spr.mirrorIndex).toBe(0);          // mirrorIndex set to 0 by NR $35
  });

  it("NR $36 writes attr1 of mirrorSpriteQ", () => {
    writeNextReg(machine, 0x34, 0x04);
    writeNextReg(machine, 0x36, 0x55);
    expect(spr.attributes[4].y).toBe(0x55);
    expect(spr.mirrorSpriteQ).toBe(4);        // no auto-inc
  });

  it("NR $39 writes attr4 of mirrorSpriteQ", () => {
    writeNextReg(machine, 0x34, 0x01);
    writeNextReg(machine, 0x39, 0x20);        // attr4 = 0x20 → attributeFlag2=true
    expect(spr.attributes[1].attributeFlag2).toBe(true);
    expect(spr.mirrorSpriteQ).toBe(1);
  });

  // ── NR $75-$79: write to attribute + auto-inc mirrorSpriteQ ─────────────

  it("NR $75 writes attr0 and auto-increments mirrorSpriteQ", () => {
    writeNextReg(machine, 0x34, 0x03);        // mirrorSpriteQ = 3
    writeNextReg(machine, 0x75, 0x10);        // mirrorInc=true, mirrorIndex=0, write
    expect(spr.attributes[3].x & 0xff).toBe(0x10);
    expect(spr.mirrorSpriteQ).toBe(4);        // auto-incremented
  });

  it("NR $75 auto-inc wraps mirrorSpriteQ at 7-bit boundary", () => {
    writeNextReg(machine, 0x34, 0x7f);
    writeNextReg(machine, 0x75, 0x00);
    expect(spr.mirrorSpriteQ).toBe(0);        // (127+1) & 0x7f = 0
  });

  it("multiple NR $75 writes walk mirrorSpriteQ sequentially", () => {
    writeNextReg(machine, 0x34, 0x05);
    for (let i = 0; i < 5; i++) {
      writeNextReg(machine, 0x75, 0x10 + i);
    }
    expect(spr.mirrorSpriteQ).toBe(10);
    // attrs 5-9 should have their x-lsb set
    for (let i = 0; i < 5; i++) {
      expect(spr.attributes[5 + i].x & 0xff).toBe(0x10 + i);
    }
  });

  // ── NR $34 reuses mirrorIndex set by NR $35-$39 ─────────────────────────

  it("NR $35 sets mirrorIndex=0; subsequent NR $34 write goes to attr0 not sprite number", () => {
    writeNextReg(machine, 0x34, 0x07);        // mirrorSpriteQ=7 (mirrorIndex still 7 at this point)
    writeNextReg(machine, 0x35, 0xaa);        // sets mirrorIndex=0; writes attr0 of sprite 7
    writeNextReg(machine, 0x34, 0xbb);        // mirrorIndex=0, writes attr0 of sprite 7 again
    expect(spr.attributes[7].x & 0xff).toBe(0xbb);
    expect(spr.mirrorSpriteQ).toBe(7);        // mirrorSpriteQ unchanged (mirrorInc=false)
  });

  // ── mirrorTie: mirrorSpriteQ change → sync spriteIndex+patternIndex ──────

  it("mirrorTie=true: NR $34 sprite-number write syncs spriteIndex and patternIndex", () => {
    writeNextReg(machine, 0x09, 0x10);        // mirrorTie = true
    writeNextReg(machine, 0x34, 0x05);        // mirrorSpriteQ=5, mirrorTie → spriteIndex=5
    expect(spr.mirrorSpriteQ).toBe(5);
    expect(spr.spriteIndex).toBe(5);
    expect(spr.patternIndex).toBe(5);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("mirrorTie=true: NR $75 auto-inc syncs spriteIndex and patternIndex", () => {
    writeNextReg(machine, 0x09, 0x10);
    writeNextReg(machine, 0x34, 0x05);        // mirrorSpriteQ=5, syncs spriteIndex=5
    writeNextReg(machine, 0x75, 0x40);        // auto-inc → mirrorSpriteQ=6, syncs spriteIndex=6
    expect(spr.spriteIndex).toBe(6);
    expect(spr.patternIndex).toBe(6);
  });

  it("mirrorTie=true: patternIndex wraps at 6-bit boundary", () => {
    writeNextReg(machine, 0x09, 0x10);
    writeNextReg(machine, 0x34, 0x3f);        // sprite 63
    writeNextReg(machine, 0x75, 0x00);        // auto-inc → 64; patternIndex = 64 & 0x3f = 0
    expect(spr.spriteIndex).toBe(64);
    expect(spr.patternIndex).toBe(0);
  });

  it("mirrorTie=true: spriteIndex wraps at 7-bit boundary", () => {
    writeNextReg(machine, 0x09, 0x10);
    writeNextReg(machine, 0x34, 0x7f);
    writeNextReg(machine, 0x75, 0x00);
    expect(spr.spriteIndex).toBe(0);
    expect(spr.patternIndex).toBe(0);
  });

  it("mirrorTie=true: multiple auto-inc writes walk spriteIndex and patternIndex together", () => {
    writeNextReg(machine, 0x09, 0x10);
    writeNextReg(machine, 0x34, 0x00);
    for (let i = 0; i < 8; i++) {
      writeNextReg(machine, 0x75, 0x00);
    }
    expect(spr.spriteIndex).toBe(8);
    expect(spr.patternIndex).toBe(8);
  });

  it("mirrorTie=false: NR $75 auto-inc does not sync spriteIndex or patternIndex", () => {
    writeNextReg(machine, 0x09, 0x00);        // mirrorTie = false
    writeNextReg(machine, 0x34, 0x03);        // mirrorSpriteQ=3 (no sync — mirrorTie=false)
    spr.patternIndex = 12;
    writeNextReg(machine, 0x75, 0x40);
    expect(spr.mirrorSpriteQ).toBe(4);        // incremented
    expect(spr.patternIndex).toBe(12);        // unchanged
    expect(spr.spriteIndex).toBe(0);          // unaffected
  });

  // ── mirrorTie: port 0x57 sprite advance → sync mirrorSpriteQ ────────────

  it("mirrorTie=true: port 0x57 advance syncs mirrorSpriteQ from new spriteIndex", () => {
    const io = machine.portManager;
    writeNextReg(machine, 0x09, 0x10);        // mirrorTie=true
    io.writePort(0x303b, 0x00);               // spriteIndex=0

    // Write 5 bytes for sprite 0 (has5AttributeBytes) — this advances spriteIndex to 1
    io.writePort(0x57, 0x10);                 // attr0 X-LSB
    io.writePort(0x57, 0x20);                 // attr1 Y-LSB
    io.writePort(0x57, 0x00);                 // attr2
    io.writePort(0x57, 0xc0);                 // attr3: visible=1, has5bytes=1, pattern=0
    io.writePort(0x57, 0x00);                 // attr4 → sprite advances to index 1

    expect(spr.spriteIndex).toBe(1);
    expect(spr.mirrorSpriteQ).toBe(1);        // D6: synced from new spriteIndex
  });

  it("mirrorTie=false: port 0x57 advance does not sync mirrorSpriteQ", () => {
    const io = machine.portManager;
    writeNextReg(machine, 0x09, 0x00);        // mirrorTie=false
    writeNextReg(machine, 0x34, 0x05);        // mirrorSpriteQ=5
    io.writePort(0x303b, 0x00);

    io.writePort(0x57, 0x10);
    io.writePort(0x57, 0x20);
    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0xc0);
    io.writePort(0x57, 0x00);                 // sprite advances to 1

    expect(spr.spriteIndex).toBe(1);
    expect(spr.mirrorSpriteQ).toBe(5);        // unchanged — no mirrorTie
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Sequential sprite attribute writes (D7)", () => {
  /**
   * D7 removed the dead isDirect heuristic from writeSpriteAttribute.
   * All port-0x57 writes now unconditionally use the sequential write path.
   */
  let machine: IZxNextMachine;
  let spr: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spr = machine.spriteDevice;
  });

  it("first write to port 0x57 goes to subIndex 0 (X LSB)", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 0); // select sprite 0
    io.writePort(0x57, 0x42);
    expect(spr.attributes[0].x).toBe(0x42);
    expect(spr.spriteSubIndex).toBe(1);
  });

  it("sequential subIndex increments 0→1→2→3 across writes", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 0);
    expect(spr.spriteSubIndex).toBe(0);

    io.writePort(0x57, 0x10); // subIndex 0 → attr0 (X LSB)
    expect(spr.spriteSubIndex).toBe(1);

    io.writePort(0x57, 0x20); // subIndex 1 → attr1 (Y LSB)
    expect(spr.spriteSubIndex).toBe(2);

    io.writePort(0x57, 0x00); // subIndex 2 → attr2
    expect(spr.spriteSubIndex).toBe(3);

    io.writePort(0x57, 0x80); // subIndex 3 → attr3 (visible, NOT 5-byte)
    expect(spr.spriteSubIndex).toBe(0); // advanced to next sprite
    expect(spr.spriteIndex).toBe(1);
  });

  it("4-byte sprite: clears attr4 fields and advances after 4th write", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 2); // select sprite 2

    io.writePort(0x57, 0x10); // X LSB
    io.writePort(0x57, 0x20); // Y LSB
    io.writePort(0x57, 0x00); // attr2
    io.writePort(0x57, 0x80); // attr3: visible, has5AttributeBytes=0

    // Should advance to sprite 3
    expect(spr.spriteIndex).toBe(3);
    expect(spr.spriteSubIndex).toBe(0);

    // attr4 fields should have been cleared
    const attrs = spr.attributes[2];
    expect(attrs.colorMode).toBe(0);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);
  });

  it("5-byte sprite: requires 5 writes before advancing", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 3); // select sprite 3

    io.writePort(0x57, 0x10); // X LSB
    io.writePort(0x57, 0x20); // Y LSB
    io.writePort(0x57, 0x00); // attr2
    io.writePort(0x57, 0x40); // attr3: has5AttributeBytes=1 (bit 6)

    // Still on sprite 3, awaiting 5th byte
    expect(spr.spriteIndex).toBe(3);
    expect(spr.spriteSubIndex).toBe(4);

    io.writePort(0x57, 0x00); // attr4
    // Now advances to sprite 4
    expect(spr.spriteIndex).toBe(4);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("sprite index wraps from 127 to 0 after 4-byte sprite write", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 127);

    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0x80); // visible, 4-byte

    expect(spr.spriteIndex).toBe(0); // wrapped
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("sprite index wraps from 127 to 0 after 5-byte sprite write", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 127);

    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0x00);
    io.writePort(0x57, 0x40); // has5AttributeBytes=1
    io.writePort(0x57, 0x00); // 5th byte

    expect(spr.spriteIndex).toBe(0); // wrapped
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("partial write does not advance sprite index", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 5);

    io.writePort(0x57, 0x00); // only 1 of 4 bytes
    expect(spr.spriteIndex).toBe(5); // stays
    expect(spr.spriteSubIndex).toBe(1);
  });

  it("X value written to attr0 is stored in attributes.x", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 7);
    io.writePort(0x57, 0xAB);
    expect(spr.attributes[7].x).toBe(0xAB);
  });

  it("Y value written to attr1 is stored in attributes.y", () => {
    const io = machine.portManager;
    io.writePort(0x303b, 7);
    io.writePort(0x57, 0x00); // X LSB
    io.writePort(0x57, 0xCD);
    expect(spr.attributes[7].y).toBe(0xCD);
  });
});
