import { describe, expect, it } from "vitest";

import { createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * The sprite-attribute watch behind `sp:` breakpoints (G3.8, sprite half;
 * `.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`).
 *
 * Every path that stores an attribute byte reports through one latch, with the byte it replaces:
 * - port $57 (sprites.vhd ~641-664): the upload index advances through attr0-attr4, and a 4-byte
 *   sprite (attr3 bit 6 clear) skips attr4 without writing it - so a watch on attr4 must not fire;
 * - the NextReg mirrors $35-$39 / $75-$79 (sprites.vhd ~596-616) on the `$34` sprite, written by the
 *   CPU or by the Copper;
 * - the DMA writing port $57.
 * The latch keeps the first hit since it was last taken (as the NextReg and Copper latches do).
 */

async function parked(): Promise<NextTestSession> {
  const s = await createSession();
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  return s;
}

describe("sprite attribute watch", () => {
  it("catches a port $57 write to a watched sprite, with the old and new byte", async () => {
    const s = await parked();
    s.out(0x303b, 5).out(0x57, 0x11);
    s.watchSpriteAttributes([5]);
    s.out(0x303b, 5).out(0x57, 0x22);
    expect(s.takeSpriteHit()).toEqual({ sprite: 5, attribute: 0, oldValue: 0x11, newValue: 0x22, origin: "port" });
    // --- Taking clears it
    expect(s.takeSpriteHit()).toBeUndefined();
  });

  it("ignores sprites that are not watched", async () => {
    const s = await parked();
    s.watchSpriteAttributes([5]);
    s.out(0x303b, 4).out(0x57, 1).out(0x57, 2).out(0x57, 3).out(0x57, 0x80);
    expect(s.takeSpriteHit()).toBeUndefined();
  });

  it("watches only the selected attribute bytes", async () => {
    const s = await parked();
    s.watchSpriteAttributes([{ sprite: 7, attributes: [2] }]);
    s.out(0x303b, 7).out(0x57, 0x10).out(0x57, 0x20).out(0x57, 0x30).out(0x57, 0x80);
    expect(s.takeSpriteHit()).toMatchObject({ sprite: 7, attribute: 2, newValue: 0x30 });
  });

  it("does not fire on attr4 of a 4-byte sprite: the hardware skips it without writing", async () => {
    const s = await parked();
    s.watchSpriteAttributes([{ sprite: 3, attributes: [4] }]);
    // --- attr3 bit 6 clear: the fifth OUT already goes to sprite 4's attr0
    s.out(0x303b, 3).out(0x57, 1).out(0x57, 2).out(0x57, 3).out(0x57, 0x80).out(0x57, 0x99);
    expect(s.takeSpriteHit()).toBeUndefined();
    // --- attr3 bit 6 set: attr4 is written
    s.out(0x303b, 3).out(0x57, 1).out(0x57, 2).out(0x57, 3).out(0x57, 0xc0).out(0x57, 0x99);
    expect(s.takeSpriteHit()).toMatchObject({ sprite: 3, attribute: 4, newValue: 0x99, origin: "port" });
  });

  it("latches the first hit of a burst, not the last", async () => {
    const s = await parked();
    s.watchSpriteAttributes([9]);
    s.out(0x303b, 9).out(0x57, 0x01).out(0x57, 0x02).out(0x57, 0x03);
    expect(s.takeSpriteHit()).toMatchObject({ attribute: 0, newValue: 0x01 });
  });

  it("catches the NextReg mirrors $35-$39 and $75-$79 on the $34 sprite", async () => {
    const s = await parked();
    s.watchSpriteAttributes([12]);
    s.setNextReg(0x34, 12).setNextReg(0x37, 0x0e);
    expect(s.takeSpriteHit()).toEqual({ sprite: 12, attribute: 2, oldValue: 0, newValue: 0x0e, origin: "nextreg" });
    s.setNextReg(0x34, 11).setNextReg(0x75, 0x40); // --- sprite 11, then advances to 12
    expect(s.takeSpriteHit()).toBeUndefined();
    s.setNextReg(0x75, 0x41);
    expect(s.takeSpriteHit()).toMatchObject({ sprite: 12, attribute: 0, newValue: 0x41, origin: "nextreg" });
    // --- Selecting the sprite is not an attribute write
    s.setNextReg(0x34, 12);
    expect(s.takeSpriteHit()).toBeUndefined();
  });

  it("labels a mirror write the Copper performs", async () => {
    const s = await parked();
    s.setNextReg(0x34, 20);
    // --- MOVE $38,$C0 ; HALT - the Copper writes sprite 20's attr3 once per frame (mode 11)
    s.setNextReg(0x62, 0x00).setNextReg(0x61, 0x00);
    for (const b of [0x38, 0xc0, 0xff, 0xff]) s.setNextReg(0x60, b);
    s.watchSpriteAttributes([20]);
    s.setNextReg(0x62, 0xc0).runFrames(2);
    expect(s.takeSpriteHit()).toMatchObject({ sprite: 20, attribute: 3, newValue: 0xc0, origin: "copper" });
  });

  it("labels a port $57 write the DMA performs", async () => {
    const s = await parked();
    s.poke(0x9000, [0x30, 0x40, 0x00, 0x80]);
    s.watchSpriteAttributes([{ sprite: 30, attributes: [1] }]);
    s.out(0x303b, 30);
    // --- zxnDMA: port A $9000 memory incrementing -> port B $57 I/O fixed, 4 bytes, continuous
    const setup = [0x83, 0x7d, 0x00, 0x90, 0x04, 0x00, 0x14, 0x28, 0xad, 0x57, 0x00, 0x82, 0xcf, 0x87];
    for (const b of setup) s.out(0x6b, b);
    s.runFrames(1);
    expect(s.takeSpriteHit()).toEqual({ sprite: 30, attribute: 1, oldValue: 0, newValue: 0x40, origin: "dma" });
  });

  it("a disarmed watch latches nothing", async () => {
    const s = await parked();
    s.watchSpriteAttributes([0]).clearSpriteWatch();
    s.out(0x303b, 0).out(0x57, 0x55);
    expect(s.takeSpriteHit()).toBeUndefined();
  });
});
