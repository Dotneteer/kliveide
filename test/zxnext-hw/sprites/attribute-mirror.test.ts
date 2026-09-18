import { describe, it } from "vitest";

import { ALL_CORES, createSession, type NextTestSession } from "../../harness/zxnext";

/*
 * SPR-006 - sprite attributes written through the NextReg mirrors.
 *
 * Hardware (zxnext.vhd ~4833-4860, sprites.vhd ~596-616, ~706-716): $34 selects the sprite
 * (`mirror_sprite_q`), $35-$39 write its attributes 0-4 directly, $75-$79 do the same and then
 * select the next sprite. The port $303B/$57 upload index is a separate counter.
 *
 * Pattern 0 is solid sprite palette index $10 (red). Sprite (0,0) is 32 pixels left of and above the
 * paper origin, so X = Y = 48 puts a 16x16 sprite at paper (16,16): buffer x 128-159, rows 64-79.
 */
async function withPattern(core: "ts" | "wasm"): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(` .org $8000\n jr $`);
  s.setNextReg(0x43, 0x20).setNextReg(0x40, 0x10).setNextReg(0x41, 0xe0); // --- sprite palette: $10 red
  s.setNextReg(0x43, 0x00).setNextReg(0x40, 0x10).setNextReg(0x41, 0x00); // --- ULA paper 0 (empty screen): black
  s.out(0x303b, 0x00);
  for (let i = 0; i < 256; i++) s.out(0x5b, 0x10);
  s.out(0x303b, 0x40); // --- upload index at sprite 64: the mirrors must not use it
  return s;
}
const sprite = { kind: "rect" as const, x: [130, 157] as [number, number], y: [66, 77] as [number, number], rgb: "next8:0xE0" };
const empty = { kind: "rect" as const, x: [130, 157] as [number, number], y: [66, 77] as [number, number], rgb: "next8:0x00" };

describe.each(ALL_CORES)("sprite attribute mirrors - %s core", (core) => {
  it("$34 selects the sprite, $35-$38 write its attributes 0-3", async () => {
    const s = await withPattern(core);
    s.setNextReg(0x34, 0x05);
    s.setNextReg(0x35, 48).setNextReg(0x36, 48).setNextReg(0x37, 0x00).setNextReg(0x38, 0x80); // --- visible, pattern 0
    s.setNextReg(0x15, 0x01).runFrames(2).expectProbe({ ...sprite, name: "sprite 5" });
  });

  it("$39 writes attribute 4 (a 5-byte sprite)", async () => {
    const s = await withPattern(core);
    s.setNextReg(0x34, 0x06);
    s.setNextReg(0x35, 48).setNextReg(0x36, 48).setNextReg(0x37, 0x00).setNextReg(0x38, 0xc0).setNextReg(0x39, 0x00);
    s.setNextReg(0x15, 0x01).runFrames(2).expectProbe({ ...sprite, name: "5-byte sprite 6" });
    s.setNextReg(0x34, 0x06).setNextReg(0x38, 0x40); // --- invisible now
    s.runFrames(2).expectProbe({ ...empty, name: "sprite 6 hidden" });
  });

  it("$75-$79 write and then advance to the next sprite", async () => {
    const s = await withPattern(core);
    s.setNextReg(0x34, 0x07);
    s.setNextReg(0x75, 0).setNextReg(0x75, 48); // --- sprite 7 attr 0; then sprite 8 attr 0
    s.setNextReg(0x34, 0x08).setNextReg(0x36, 48).setNextReg(0x37, 0x00).setNextReg(0x38, 0x80);
    s.setNextReg(0x15, 0x01).runFrames(2).expectProbe({ ...sprite, name: "sprite 8, X written through $75" });
  });
});
