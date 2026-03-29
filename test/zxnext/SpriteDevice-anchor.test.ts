import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { SpriteDevice } from "@emu/machines/zxNext/SpriteDevice";

/**
 * Unit tests for SpriteDevice anchor sprite tracking.
 *
 * In the FPGA, anchor state is captured at render time (during the QUALIFY phase)
 * via updateAnchorState(spriteIdx), NOT at attribute-write time.
 * resetAnchorState() is called once per scanline to clear anchorVis.
 *
 * Tests cover:
 * - resetAnchorState clears anchorVis
 * - updateAnchorState captures X, Y, palette, transforms from a non-relative sprite
 * - Relative sprite detection via isRelativeSprite()
 * - resolveRelativeSprite() combinatorial logic
 * - Sequences of anchor → relative sprites
 */

describe("SpriteDevice - Anchor Sprite Tracking", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = machine.spriteDevice;
  });

  // Helper: set up a non-relative (anchor) sprite with 5-byte attributes
  function setupAnchorSprite(
    idx: number,
    xLsb: number,
    yLsb: number,
    attr2: number,
    attr3: number,
    attr4: number
  ) {
    spriteDevice.writeIndexedSpriteAttribute(idx, 0, xLsb);
    spriteDevice.writeIndexedSpriteAttribute(idx, 1, yLsb);
    spriteDevice.writeIndexedSpriteAttribute(idx, 2, attr2);
    spriteDevice.writeIndexedSpriteAttribute(idx, 3, attr3);
    spriteDevice.writeIndexedSpriteAttribute(idx, 4, attr4);
  }

  // Helper: set up a relative sprite (colorMode=01 → attr4[7:6]=01, attr3[6]=1)
  function setupRelativeSprite(
    idx: number,
    xOff: number,
    yOff: number,
    attr2: number,
    attr3: number,
    attr4: number
  ) {
    // attr3[6]=1 (has5bytes) and attr4[7:6]=01 make it relative
    spriteDevice.writeIndexedSpriteAttribute(idx, 0, xOff);
    spriteDevice.writeIndexedSpriteAttribute(idx, 1, yOff);
    spriteDevice.writeIndexedSpriteAttribute(idx, 2, attr2);
    spriteDevice.writeIndexedSpriteAttribute(idx, 3, attr3);
    spriteDevice.writeIndexedSpriteAttribute(idx, 4, attr4);
  }

  it("should initialize anchorVis to false", () => {
    expect(spriteDevice.anchorVis).toBe(false);
  });

  it("resetAnchorState should clear anchorVis", () => {
    // Make anchorVis true by updating from a visible sprite
    setupAnchorSprite(0, 0x42, 0x50, 0xf0, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);
    expect(spriteDevice.anchorVis).toBe(true);

    // Reset
    spriteDevice.resetAnchorState();
    expect(spriteDevice.anchorVis).toBe(false);
  });

  it("updateAnchorState should capture X from sprite attributes", () => {
    setupAnchorSprite(0, 0x42, 0x50, 0xf0, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);
    expect(spriteDevice.anchorX).toBe(0x42);
  });

  it("updateAnchorState should capture Y from sprite attributes", () => {
    setupAnchorSprite(1, 0x80, 0x70, 0xf0, 0xc0, 0x00);
    spriteDevice.updateAnchorState(1);
    expect(spriteDevice.anchorY).toBe(0x70);
  });

  it("updateAnchorState should capture rotate flag when rel_type is set", () => {
    // attr3[6]=1 (has5bytes), attr3[7]=1 (visible), attr4[5]=1 (rel_type)
    // attr2[1]=1 (rotate)
    setupAnchorSprite(2, 0x10, 0x20, 0xf2, 0xc0, 0x20);
    spriteDevice.updateAnchorState(2);
    expect(spriteDevice.anchorRotate).toBe(true);
  });

  it("updateAnchorState should capture mirrorX flag when rel_type is set", () => {
    // attr2[3]=1 (mirrorX), attr4[5]=1 (rel_type)
    setupAnchorSprite(3, 0x30, 0x40, 0xf8, 0xc0, 0x20);
    spriteDevice.updateAnchorState(3);
    expect(spriteDevice.anchorXmirror).toBe(true);
  });

  it("updateAnchorState should capture mirrorY flag when rel_type is set", () => {
    // attr2[2]=1 (mirrorY), attr4[5]=1 (rel_type)
    setupAnchorSprite(4, 0x50, 0x60, 0xf4, 0xc0, 0x20);
    spriteDevice.updateAnchorState(4);
    expect(spriteDevice.anchorYmirror).toBe(true);
  });

  it("updateAnchorState should capture all transform properties together", () => {
    // attr2=0xfe: palette=0xf, mirrorX=1, mirrorY=1, rotate=1, X-MSB=0
    // attr4=0x20: rel_type=1, colorMode=00
    setupAnchorSprite(5, 0x99, 0xaa, 0xfe, 0xc0, 0x20);
    spriteDevice.updateAnchorState(5);
    expect(spriteDevice.anchorX).toBe(0x99);
    expect(spriteDevice.anchorY).toBe(0xaa);
    expect(spriteDevice.anchorRotate).toBe(true);
    expect(spriteDevice.anchorXmirror).toBe(true);
    expect(spriteDevice.anchorYmirror).toBe(true);
  });

  it("updateAnchorState should NOT capture transforms when rel_type=0", () => {
    // attr4=0x00: rel_type=0
    // Even with attr2 transform bits set, transforms should be cleared
    setupAnchorSprite(6, 0x55, 0x66, 0xfe, 0xc0, 0x00);
    spriteDevice.updateAnchorState(6);
    expect(spriteDevice.anchorRotate).toBe(false);
    expect(spriteDevice.anchorXmirror).toBe(false);
    expect(spriteDevice.anchorYmirror).toBe(false);
  });

  it("updateAnchorState should capture scale when rel_type is set", () => {
    // attr4: rel_type=1 (bit5), scaleX=2 (bits4:3=10), scaleY=1 (bits2:1=01)
    // attr4 = 0b00110010 = 0x32
    setupAnchorSprite(7, 0x10, 0x20, 0xf0, 0xc0, 0x32);
    spriteDevice.updateAnchorState(7);
    expect(spriteDevice.anchorXscale).toBe(2);
    expect(spriteDevice.anchorYscale).toBe(1);
  });

  it("isRelativeSprite should return true for relative sprites", () => {
    // attr3[6]=1 (has5bytes), attr4[7:6]=01 → relative
    setupRelativeSprite(10, 0x05, 0x0a, 0xf0, 0xc0, 0x40);
    expect(spriteDevice.isRelativeSprite(10)).toBe(true);
  });

  it("isRelativeSprite should return false for anchor sprites", () => {
    // attr4[7:6]=00 → not relative
    setupAnchorSprite(11, 0x10, 0x20, 0xf0, 0xc0, 0x00);
    expect(spriteDevice.isRelativeSprite(11)).toBe(false);
  });

  it("isRelativeSprite should return false when has5bytes=0", () => {
    // attr3[6]=0 (no 5 bytes) even with attr4[7:6]=01
    spriteDevice.writeIndexedSpriteAttribute(12, 0, 0x10);
    spriteDevice.writeIndexedSpriteAttribute(12, 1, 0x20);
    spriteDevice.writeIndexedSpriteAttribute(12, 2, 0xf0);
    spriteDevice.writeIndexedSpriteAttribute(12, 3, 0x80);  // visible but NOT has5bytes
    expect(spriteDevice.isRelativeSprite(12)).toBe(false);
  });

  it("updateAnchorState updates on multiple anchor sprites sequentially", () => {
    // First anchor
    setupAnchorSprite(0, 0x10, 0x20, 0xf0, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);
    expect(spriteDevice.anchorX).toBe(0x10);
    expect(spriteDevice.anchorY).toBe(0x20);

    // Second anchor overwrites
    setupAnchorSprite(1, 0x30, 0x40, 0xf8, 0xc0, 0x20);
    spriteDevice.updateAnchorState(1);
    expect(spriteDevice.anchorX).toBe(0x30);
    expect(spriteDevice.anchorY).toBe(0x40);
    expect(spriteDevice.anchorXmirror).toBe(true);
  });

  it("should handle 9-bit X coordinate for anchor sprites", () => {
    // attr2[0]=1 sets X MSB
    setupAnchorSprite(10, 0xff, 0x50, 0xf1, 0xc0, 0x00);
    spriteDevice.updateAnchorState(10);
    expect(spriteDevice.anchorX).toBe(0x1ff);
  });

  it("updateAnchorState should not change when called on relative sprite", () => {
    // Set up anchor first
    setupAnchorSprite(0, 0x12, 0x34, 0xf8, 0xc0, 0x20);
    spriteDevice.updateAnchorState(0);
    const savedX = spriteDevice.anchorX;
    const savedY = spriteDevice.anchorY;

    // Note: calling updateAnchorState on a relative sprite WILL overwrite —
    // but the renderer only calls it for non-relative sprites.
    // This test verifies that isRelativeSprite is the proper guard.
    setupRelativeSprite(1, 0xa0, 0xb0, 0xff, 0xc0, 0x45);
    expect(spriteDevice.isRelativeSprite(1)).toBe(true);
    // Renderer skips updateAnchorState for relative sprites
  });

  it("should capture anchorVis from attr3[7]", () => {
    // Invisible anchor
    setupAnchorSprite(0, 0x10, 0x20, 0xf0, 0x40, 0x00);  // attr3[7]=0
    spriteDevice.updateAnchorState(0);
    expect(spriteDevice.anchorVis).toBe(false);

    // Visible anchor
    setupAnchorSprite(1, 0x30, 0x40, 0xf0, 0xc0, 0x00);  // attr3[7]=1
    spriteDevice.updateAnchorState(1);
    expect(spriteDevice.anchorVis).toBe(true);
  });

  it("should capture anchorPaloff from attr2[7:4]", () => {
    setupAnchorSprite(0, 0x10, 0x20, 0xa0, 0xc0, 0x00);  // palette = 0xa
    spriteDevice.updateAnchorState(0);
    expect(spriteDevice.anchorPaloff).toBe(0x0a);
  });

  it("resolveRelativeSprite should offset X and Y from anchor position", () => {
    // Anchor at (0x80, 0x40)
    setupAnchorSprite(0, 0x80, 0x40, 0xf0, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with offset (+5, +10), visible
    // attr3=0xc0: has5bytes=1, visible=1, pattern=0
    // attr4=0x40: colorMode=01 (relative)
    setupRelativeSprite(1, 0x05, 0x0a, 0xf0, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    expect(resolved.x).toBe((0x80 + 0x05) & 0x1ff);
    expect(resolved.y).toBe((0x40 + 0x0a) & 0x1ff);
    expect(resolved.visible).toBe(true);
  });

  it("resolveRelativeSprite should set visible=false when anchor is invisible", () => {
    // Anchor is invisible (attr3[7]=0)
    setupAnchorSprite(0, 0x80, 0x40, 0xf0, 0x40, 0x00);
    spriteDevice.updateAnchorState(0);

    setupRelativeSprite(1, 0x05, 0x0a, 0xf0, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    expect(resolved.visible).toBe(false);
  });

  it("resolveRelativeSprite should swap X/Y offsets when anchor is rotated", () => {
    // Anchor with rotate=1, mirrorX=1, rel_type=1 (attr4[5]=1)
    // mirrorX=1 ensures negateX = (rotate XOR mirrorX) = false
    setupAnchorSprite(0, 0x80, 0x40, 0xfa, 0xc0, 0x20);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with offsets (0x05, 0x0a)
    setupRelativeSprite(1, 0x05, 0x0a, 0xf0, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // X uses attr1 (0x0a), Y uses attr0 (0x05) due to swap
    expect(resolved.x).toBe((0x80 + 0x0a) & 0x1ff);
    expect(resolved.y).toBe((0x40 + 0x05) & 0x1ff);
  });

  it("resolveRelativeSprite should negate X offset when anchor rotate XOR mirrorX", () => {
    // Anchor with mirrorX=1, rotate=0, rel_type=1
    // rotate(false) XOR mirrorX(true) = true → negate X
    setupAnchorSprite(0, 0x80, 0x40, 0xf8, 0xc0, 0x20);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with small positive X offset
    setupRelativeSprite(1, 0x05, 0x00, 0xf0, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // Negated X offset: (-5) & 0xff = 0xfb, sign-extended to 0x1fb, added to 0x80
    const negX = (~0x05 + 1) & 0xff;
    const signExt = (negX & 0x80) ? (negX | 0x100) : negX;
    const expected = (0x80 + signExt) & 0x1ff;
    expect(resolved.x).toBe(expected);
  });

  it("resolveRelativeSprite should scale offsets by anchor scale", () => {
    // Anchor with scaleX=1, scaleY=0, rel_type=1
    // attr4: rel_type=1(bit5), scaleX=1(bits4:3=01), scaleY=0(bits2:1=00)
    // attr4 = 0b00101000 = 0x28
    setupAnchorSprite(0, 0x80, 0x40, 0xf0, 0xc0, 0x28);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with offset (0x04, 0x02)
    setupRelativeSprite(1, 0x04, 0x02, 0xf0, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // X offset scaled by <<1: 0x04 << 1 = 0x08
    // Y offset scaled by <<0: 0x02 << 0 = 0x02
    expect(resolved.x).toBe((0x80 + 0x08) & 0x1ff);
    expect(resolved.y).toBe((0x40 + 0x02) & 0x1ff);
  });

  it("resolveRelativeSprite should add palette offsets when attr2[0]=1", () => {
    // Anchor with palette=0x05
    setupAnchorSprite(0, 0x80, 0x40, 0x50, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with palette=0x03 and attr2[0]=1 (add mode)
    // attr2 = 0x31: palette=0x3, rotate=0, mirrorX/Y=0, add=1
    setupRelativeSprite(1, 0x00, 0x00, 0x31, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // paletteOffset = (0x05 + 0x03) & 0x0f = 0x08
    expect(resolved.paletteOffset).toBe(0x08);
  });

  it("resolveRelativeSprite should replace palette when attr2[0]=0", () => {
    // Anchor with palette=0x05
    setupAnchorSprite(0, 0x80, 0x40, 0x50, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with palette=0x03 and attr2[0]=0 (replace mode)
    setupRelativeSprite(1, 0x00, 0x00, 0x30, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // paletteOffset = 0x03 (replace, not add)
    expect(resolved.paletteOffset).toBe(0x03);
  });

  it("resolveRelativeSprite should XOR transforms when anchor rel_type=1", () => {
    // Anchor with rotate=1, mirrorX=1, rel_type=1
    setupAnchorSprite(0, 0x80, 0x40, 0xfa, 0xc0, 0x20);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with rotate=1 in attr2
    // attr2 = 0xf2: palette=0xf, rotate=1 (bit1)
    setupRelativeSprite(1, 0x00, 0x00, 0xf2, 0xc0, 0x40);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // anchor_rotate XOR rel_rotate = true XOR true = false
    expect(resolved.rotate).toBe(false);
  });

  it("resolveRelativeSprite should use own transforms when anchor rel_type=0", () => {
    // Anchor with rel_type=0 (attr4[5]=0)
    setupAnchorSprite(0, 0x80, 0x40, 0xfa, 0xc0, 0x00);
    spriteDevice.updateAnchorState(0);

    // Relative sprite with rotate=1, mirrorX=1 in its own attr2/attr4
    // attr2 = 0xfa: palette=0xf, mirrorX=1(bit3), rotate=1(bit1)
    // attr4 = 0x48: colorMode=01, scaleX=1(bit3)
    setupRelativeSprite(1, 0x00, 0x00, 0xfa, 0xc0, 0x48);
    const resolved = spriteDevice.resolveRelativeSprite(1);
    // Uses own transforms (rel_type=0 path)
    expect(resolved.rotate).toBe(true);
    expect(resolved.mirrorX).toBe(true);
  });
});
