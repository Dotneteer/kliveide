import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { SpriteDevice } from "@emu/machines/zxNext/SpriteDevice";

/**
 * Unit tests for SpriteDevice anchor sprite tracking
 * 
 * Anchor sprites are non-relative sprites (colorMode !== 0x01) with 5 attribute bytes.
 * Their transformation state (position, rotation, mirroring) is stored for use by relative sprites.
 * 
 * Tests cover:
 * - Anchor sprite detection and tracking
 * - Anchor properties update on attr2 write
 * - Relative sprite behavior (colorMode = 0x01)
 * - Multiple anchor sprites in sequence
 * - Property isolation between sprites
 */

describe("SpriteDevice - Anchor Sprite Tracking", () => {
  let machine: IZxNextMachine;
  let spriteDevice: SpriteDevice;

  beforeEach(async () => {
    machine = await createTestNextMachine();
    spriteDevice = machine.spriteDevice;
  });

  it("should initialize anchor properties to 0/false", () => {
    expect(spriteDevice.getAnchorX()).toBe(0);
    expect(spriteDevice.getAnchorY()).toBe(0);
    expect(spriteDevice.isAnchorRotated()).toBe(false);
    expect(spriteDevice.isAnchorMirroredX()).toBe(false);
    expect(spriteDevice.isAnchorMirroredY()).toBe(false);
  });

  it("should update anchor X on anchor sprite attr2 write", () => {
    const spriteIdx = 0;
    const attrs = spriteDevice.attributes[spriteIdx];

    // --- Set up anchor sprite (colorMode = 0, 5 bytes)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x42);  // X LSB
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x50);  // Y LSB
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);  // has5AttributeBytes = 1, colorMode setup
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);  // colorMode = 0 (anchor), X MSB = 0

    // --- Act: Write attr2 (triggers anchor tracking)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf0);  // Palette, no transforms

    // --- Assert
    expect(spriteDevice.getAnchorX()).toBe(0x42);
  });

  it("should update anchor Y on anchor sprite attr2 write", () => {
    const spriteIdx = 1;
    const attrs = spriteDevice.attributes[spriteIdx];

    // --- Set up anchor sprite
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x80);  // X LSB
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x70);  // Y LSB = 0x70
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);  // has5AttributeBytes = 1
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);  // colorMode = 0 (anchor)

    // --- Act: Write attr2
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf0);

    // --- Assert
    expect(spriteDevice.getAnchorY()).toBe(0x70);
  });

  it("should track anchor rotation flag on attr2 write", () => {
    const spriteIdx = 2;

    // --- Set up anchor sprite without rotation
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x10);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x20);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);

    // --- Act: Write attr2 with rotation bit set (bit 1)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf2);  // Palette, rotate = 1

    // --- Assert
    expect(spriteDevice.isAnchorRotated()).toBe(true);
  });

  it("should track anchor mirrorX flag on attr2 write", () => {
    const spriteIdx = 3;

    // --- Set up anchor sprite without mirrorX
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x30);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);

    // --- Act: Write attr2 with mirrorX bit set (bit 3)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf8);  // Palette, mirrorX = 1

    // --- Assert
    expect(spriteDevice.isAnchorMirroredX()).toBe(true);
  });

  it("should track anchor mirrorY flag on attr2 write", () => {
    const spriteIdx = 4;

    // --- Set up anchor sprite without mirrorY
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x50);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x60);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);

    // --- Act: Write attr2 with mirrorY bit set (bit 2)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf4);  // Palette, mirrorY = 1

    // --- Assert
    expect(spriteDevice.isAnchorMirroredY()).toBe(true);
  });

  it("should update all anchor properties together on attr2 write", () => {
    const spriteIdx = 5;

    // --- Set up anchor sprite with specific position and transformations
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x99);  // X LSB
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0xaa);  // Y LSB
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);  // has5AttributeBytes = 1
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);  // colorMode = 0 (anchor)

    // --- Act: Write attr2 with all transformation flags set
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xfe);  // Palette, all flags set

    // --- Assert
    expect(spriteDevice.getAnchorX()).toBe(0x99);
    expect(spriteDevice.getAnchorY()).toBe(0xaa);
    expect(spriteDevice.isAnchorRotated()).toBe(true);
    expect(spriteDevice.isAnchorMirroredX()).toBe(true);
    expect(spriteDevice.isAnchorMirroredY()).toBe(true);
  });

  it("should NOT track relative sprites (colorMode = 0x01) as anchors", () => {
    const spriteIdx = 6;

    // --- Set up relative sprite (colorMode = 0x01)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x55);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x66);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);  // has5AttributeBytes = 1
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x45);  // colorMode = 0x01 (01 in bits 7:6) + other bits

    // --- Store previous anchor state
    const previousX = spriteDevice.getAnchorX();
    const previousY = spriteDevice.getAnchorY();

    // --- Act: Write attr2
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xfe);

    // --- Assert: Anchor should not change
    expect(spriteDevice.getAnchorX()).toBe(previousX);
    expect(spriteDevice.getAnchorY()).toBe(previousY);
  });

  it("should NOT track sprites without 5 attribute bytes as anchors", () => {
    const spriteIdx = 7;

    // --- Set up sprite without 5 attribute bytes (colorMode = 0, but has5AttributeBytes = 0)
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x77);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x88);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x00);  // has5AttributeBytes = 0, colorMode = 0
    // No attr4 write because has5AttributeBytes = 0

    // --- Store previous anchor state
    const previousX = spriteDevice.getAnchorX();

    // --- Act: Write attr2
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xfe);

    // --- Assert: Anchor should not change
    expect(spriteDevice.getAnchorX()).toBe(previousX);
  });

  it("should update anchor on multiple anchor sprite writes", () => {
    // --- First anchor sprite
    spriteDevice.writeIndexedSpriteAttribute(0, 0, 0x10);
    spriteDevice.writeIndexedSpriteAttribute(0, 1, 0x20);
    spriteDevice.writeIndexedSpriteAttribute(0, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(0, 4, 0x00);
    spriteDevice.writeIndexedSpriteAttribute(0, 2, 0xf0);

    expect(spriteDevice.getAnchorX()).toBe(0x10);
    expect(spriteDevice.getAnchorY()).toBe(0x20);

    // --- Second anchor sprite (should update anchor)
    spriteDevice.writeIndexedSpriteAttribute(1, 0, 0x30);
    spriteDevice.writeIndexedSpriteAttribute(1, 1, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(1, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(1, 4, 0x00);
    spriteDevice.writeIndexedSpriteAttribute(1, 2, 0xf8);  // mirrorX = 1

    expect(spriteDevice.getAnchorX()).toBe(0x30);
    expect(spriteDevice.getAnchorY()).toBe(0x40);
    expect(spriteDevice.isAnchorMirroredX()).toBe(true);
  });

  it("should handle 9-bit X coordinate for anchor sprites", () => {
    const spriteIdx = 10;

    // --- Set up anchor sprite with 9-bit X coordinate
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0xff);  // X LSB = 0xff
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x50);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x01);  // colorMode = 0, X MSB = 1

    // --- Act: Write attr2
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf0);

    // --- Assert: Anchor X should be 0x1ff
    expect(spriteDevice.getAnchorX()).toBe(0x1ff);
  });

  it("should preserve anchor properties when non-anchor sprite attr2 is written", () => {
    // --- First, set an anchor sprite
    spriteDevice.writeIndexedSpriteAttribute(0, 0, 0x12);
    spriteDevice.writeIndexedSpriteAttribute(0, 1, 0x34);
    spriteDevice.writeIndexedSpriteAttribute(0, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(0, 4, 0x00);
    spriteDevice.writeIndexedSpriteAttribute(0, 2, 0xf8);  // mirrorX = 1

    const expectedX = spriteDevice.getAnchorX();
    const expectedY = spriteDevice.getAnchorY();
    const expectedMirrorX = spriteDevice.isAnchorMirroredX();

    // --- Now write a non-anchor sprite's attr2
    spriteDevice.writeIndexedSpriteAttribute(5, 0, 0x99);
    spriteDevice.writeIndexedSpriteAttribute(5, 1, 0xaa);
    spriteDevice.writeIndexedSpriteAttribute(5, 3, 0x00);  // No 5 attribute bytes
    spriteDevice.writeIndexedSpriteAttribute(5, 2, 0xf0);

    // --- Assert: Anchor properties unchanged
    expect(spriteDevice.getAnchorX()).toBe(expectedX);
    expect(spriteDevice.getAnchorY()).toBe(expectedY);
    expect(spriteDevice.isAnchorMirroredX()).toBe(expectedMirrorX);
  });

  it("should track anchor sprite with only rotate flag", () => {
    const spriteIdx = 11;

    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x50);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);

    // --- Act: Write attr2 with only rotate flag
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf2);  // Palette, rotate = 1

    // --- Assert
    expect(spriteDevice.isAnchorRotated()).toBe(true);
    expect(spriteDevice.isAnchorMirroredX()).toBe(false);
    expect(spriteDevice.isAnchorMirroredY()).toBe(false);
  });

  it("should track anchor sprite with mirrorX and mirrorY but no rotate", () => {
    const spriteIdx = 12;

    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x60);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x70);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);

    // --- Act: Write attr2 with mirrorX and mirrorY but no rotate
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xfc);  // mirrorX=1, mirrorY=1, rotate=0

    // --- Assert
    expect(spriteDevice.isAnchorRotated()).toBe(false);
    expect(spriteDevice.isAnchorMirroredX()).toBe(true);
    expect(spriteDevice.isAnchorMirroredY()).toBe(true);
  });

  it("should update anchor when existing anchor sprite's position changes", () => {
    const spriteIdx = 0;

    // --- Initial anchor setup
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x10);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x20);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf0);

    expect(spriteDevice.getAnchorX()).toBe(0x10);
    expect(spriteDevice.getAnchorY()).toBe(0x20);

    // --- Update the same anchor sprite's position
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x50);
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x60);
    // Attr2 write triggers anchor tracking with new position
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf0);

    // --- Assert: Anchor position updated
    expect(spriteDevice.getAnchorX()).toBe(0x50);
    expect(spriteDevice.getAnchorY()).toBe(0x60);
  });

  it("should correctly identify colorMode values for anchor detection", () => {
    const anchorTests = [
      { colorMode: 0x00, shouldTrack: true },   // colorMode = 0 (bits 7:6 = 00)
      { colorMode: 0x80, shouldTrack: true },   // colorMode = 2 (bits 7:6 = 10)
      { colorMode: 0xc0, shouldTrack: true },   // colorMode = 3 (bits 7:6 = 11)
      { colorMode: 0x45, shouldTrack: false },  // colorMode = 1 (bits 7:6 = 01) - relative sprite
    ];

    for (let i = 0; i < anchorTests.length; i++) {
      const test = anchorTests[i];
      const spriteIdx = i + 20;

      // Store previous anchor state
      const prevX = spriteDevice.getAnchorX();

      spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x50 + i);
      spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x60 + i);
      spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);  // has5AttributeBytes = 1
      spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, test.colorMode);
      spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf0);  // Trigger anchor tracking

      if (test.shouldTrack) {
        expect(spriteDevice.getAnchorX()).toBe(0x50 + i);
      } else {
        expect(spriteDevice.getAnchorX()).toBe(prevX);
      }
    }
  });

  it("should work correctly with sequence of anchor and relative sprites", () => {
    // --- Sprite 0: Anchor sprite
    spriteDevice.writeIndexedSpriteAttribute(0, 0, 0x80);
    spriteDevice.writeIndexedSpriteAttribute(0, 1, 0x90);
    spriteDevice.writeIndexedSpriteAttribute(0, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(0, 4, 0x00);  // colorMode = 0 (anchor)
    spriteDevice.writeIndexedSpriteAttribute(0, 2, 0xf8);  // mirrorX = 1

    expect(spriteDevice.getAnchorX()).toBe(0x80);
    expect(spriteDevice.isAnchorMirroredX()).toBe(true);

    // --- Sprite 1: Relative sprite (shouldn't change anchor)
    const anchorXAfterRelative = spriteDevice.getAnchorX();
    spriteDevice.writeIndexedSpriteAttribute(1, 0, 0xa0);
    spriteDevice.writeIndexedSpriteAttribute(1, 1, 0xb0);
    spriteDevice.writeIndexedSpriteAttribute(1, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(1, 4, 0x45);  // colorMode = 1 (relative)
    spriteDevice.writeIndexedSpriteAttribute(1, 2, 0xff);

    expect(spriteDevice.getAnchorX()).toBe(anchorXAfterRelative);

    // --- Sprite 2: Different anchor sprite
    spriteDevice.writeIndexedSpriteAttribute(2, 0, 0x20);
    spriteDevice.writeIndexedSpriteAttribute(2, 1, 0x30);
    spriteDevice.writeIndexedSpriteAttribute(2, 3, 0x40);
    spriteDevice.writeIndexedSpriteAttribute(2, 4, 0x80);  // colorMode = 2 (anchor)
    spriteDevice.writeIndexedSpriteAttribute(2, 2, 0xf4);  // mirrorY = 1

    expect(spriteDevice.getAnchorX()).toBe(0x20);
    expect(spriteDevice.getAnchorY()).toBe(0x30);
    expect(spriteDevice.isAnchorMirroredX()).toBe(false);
    expect(spriteDevice.isAnchorMirroredY()).toBe(true);
  });

  it("should handle anchor tracking with port writes", () => {
    // --- Use direct writes to ensure proper order for anchor tracking
    // --- Need: has5AttributeBytes = 1 and colorMode != 0x01
    const spriteIdx = 5;
    
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 0, 0x44);  // X
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 1, 0x55);  // Y
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 3, 0x40);  // attr3: has5AttributeBytes = 1
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 4, 0x00);  // attr4: colorMode = 0
    spriteDevice.writeIndexedSpriteAttribute(spriteIdx, 2, 0xf8);  // attr2: mirrorX = 1 (triggers anchor tracking)

    // --- Verify anchor was tracked
    expect(spriteDevice.getAnchorX()).toBe(0x44);
    expect(spriteDevice.getAnchorY()).toBe(0x55);
    expect(spriteDevice.isAnchorMirroredX()).toBe(true);
  });
});
