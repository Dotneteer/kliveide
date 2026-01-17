import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

describe("Next - SpriteDevice", async function () {
  it("After cold start", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;

    // --- Assert
    expect(spr.spriteIdLockstep).toBe(false);
    expect(spr.sprite0OnTop).toBe(false);
    expect(spr.spriteClippingEnabled).toBe(false);
    expect(spr.spritesEnabled).toBe(false);
    expect(spr.spritesOverBorderEnabled).toBe(false);
    expect(spr.clipIndex).toBe(0);
    expect(spr.clipWindowX1).toBe(0);
    expect(spr.clipWindowX2).toBe(255);
    expect(spr.clipWindowY1).toBe(0);
    expect(spr.clipWindowY2).toBe(191);
    expect(spr.transparencyIndex).toBe(0xe3);
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(0);
    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.lastVisibileSpriteIndex).toBe(-1);
  });

  it("Reg $19 (Sprite clip window) first write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x1c, 0x02);

    // --- Act
    writeNextReg(m, 0x19, 0x23);

    // --- Assert
    expect(spriteDevice.clipIndex).toBe(0x01);
    expect(spriteDevice.clipWindowX1).toBe(0x23);
    expect(spriteDevice.clipWindowX2).toBe(0xff);
    expect(spriteDevice.clipWindowY1).toBe(0x00);
    expect(spriteDevice.clipWindowY2).toBe(0xbf);
  });

  it("Reg $19 (Sprite clip window) second write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x1c, 0x02);

    // --- Act
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);

    // --- Assert
    expect(spriteDevice.clipIndex).toBe(0x02);
    expect(spriteDevice.clipWindowX1).toBe(0x23);
    expect(spriteDevice.clipWindowX2).toBe(0x34);
    expect(spriteDevice.clipWindowY1).toBe(0x00);
    expect(spriteDevice.clipWindowY2).toBe(0xbf);
  });

  it("Reg $19 (Sprite clip window) third write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x1c, 0x02);

    // --- Act
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);
    writeNextReg(m, 0x19, 0x45);

    // --- Assert
    expect(spriteDevice.clipIndex).toBe(0x03);
    expect(spriteDevice.clipWindowX1).toBe(0x23);
    expect(spriteDevice.clipWindowX2).toBe(0x34);
    expect(spriteDevice.clipWindowY1).toBe(0x45);
    expect(spriteDevice.clipWindowY2).toBe(0xbf);
  });

  it("Reg $19 (Sprite clip window) fourth write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x1c, 0x02);

    // --- Act
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);
    writeNextReg(m, 0x19, 0x45);
    writeNextReg(m, 0x19, 0x56);

    // --- Assert
    expect(spriteDevice.clipIndex).toBe(0x00);
    expect(spriteDevice.clipWindowX1).toBe(0x23);
    expect(spriteDevice.clipWindowX2).toBe(0x34);
    expect(spriteDevice.clipWindowY1).toBe(0x45);
    expect(spriteDevice.clipWindowY2).toBe(0x56);
  });

  it("0x303b (Sprites Status/Slot Select) write works #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;

    // --- Act
    io.writePort(0x303b, 0x80);

    // --- Assert
    expect(spriteDevice.patternIndex).toBe(0x00);
    expect(spriteDevice.patternSubIndex).toBe(0x80);
    expect(spriteDevice.spriteIndex).toBe(0x00);
    expect(spriteDevice.spriteSubIndex).toBe(0x00);
  });

  it("0x303b (Sprites Status/Slot Select) write works #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;

    // --- Act
    io.writePort(0x303b, 0x4a);

    // --- Assert
    expect(spriteDevice.patternIndex).toBe(0x0a);
    expect(spriteDevice.patternSubIndex).toBe(0x00);
    expect(spriteDevice.spriteIndex).toBe(0x4a);
    expect(spriteDevice.spriteSubIndex).toBe(0x00);
  });

  it("0x303b (Sprites Status/Slot Select) write works #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;

    // --- Act
    io.writePort(0x303b, 0xca);

    // --- Assert
    expect(spriteDevice.patternIndex).toBe(0x0a);
    expect(spriteDevice.patternSubIndex).toBe(0x80);
    expect(spriteDevice.spriteIndex).toBe(0x4a);
    expect(spriteDevice.spriteSubIndex).toBe(0x00);
  });

  it("0x303b (Sprites Status/Slot Select) read works #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;
    spriteDevice.tooManySpritesPerLine = false;
    spriteDevice.collisionDetected = false;

    // --- Act
    const value = io.readPort(0x303b);

    // --- Assert
    expect(!!(value & 0x02)).toBe(false);
    expect(!!(value & 0x01)).toBe(false);
    expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    expect(spriteDevice.collisionDetected).toBe(false);
  });

  it("0x303b (Sprites Status/Slot Select) read works #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;
    spriteDevice.tooManySpritesPerLine = true;
    spriteDevice.collisionDetected = false;

    // --- Act
    const value = io.readPort(0x303b);

    // --- Assert
    expect(!!(value & 0x02)).toBe(true);
    expect(!!(value & 0x01)).toBe(false);
    expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    expect(spriteDevice.collisionDetected).toBe(false);
  });

  it("0x303b (Sprites Status/Slot Select) read works #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;
    spriteDevice.tooManySpritesPerLine = false;
    spriteDevice.collisionDetected = true;

    // --- Act
    const value = io.readPort(0x303b);

    // --- Assert
    expect(!!(value & 0x02)).toBe(false);
    expect(!!(value & 0x01)).toBe(true);
    expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    expect(spriteDevice.collisionDetected).toBe(false);
  });

  it("0x303b (Sprites Status/Slot Select) read works #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spriteDevice = machine.spriteDevice;
    spriteDevice.tooManySpritesPerLine = true;
    spriteDevice.collisionDetected = true;

    // --- Act
    const value = io.readPort(0x303b);

    // --- Assert
    expect(!!(value & 0x02)).toBe(true);
    expect(!!(value & 0x01)).toBe(true);
    expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    expect(spriteDevice.collisionDetected).toBe(false);
  });

  it("0xxx57 (Sprites Attribute) write first byte", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);

    // --- Act
    io.writePort(0x3157, 0x23);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(1);
  });

  it("0xxx57 (Sprites Attribute) write second byte", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);

    // --- Act
    io.writePort(0x3257, 0x45);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(2);
  });

  it("0xxx57 (Sprites Attribute) write third byte #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);

    // --- Act
    io.writePort(0x3357, 0xa0);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(3);
  });

  it("0xxx57 (Sprites Attribute) write third byte #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);

    // --- Act
    io.writePort(0x3357, 0xa8);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(true);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(3);
  });

  it("0xxx57 (Sprites Attribute) write third byte #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);

    // --- Act
    io.writePort(0x3357, 0xa4);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(true);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(3);
  });

  it("0xxx57 (Sprites Attribute) write third byte #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);

    // --- Act
    io.writePort(0x3357, 0xa2);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(true);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(3);
  });

  it("0xxx57 (Sprites Attribute) write third byte #5", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);

    // --- Act
    io.writePort(0x3357, 0xa1);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(3);
  });

  it("0xxx57 (Sprites Attribute) fourth byte #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);

    // --- Act
    io.writePort(0x3457, 0x00);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fourth byte #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);

    // --- Act
    io.writePort(0x3457, 0x80);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fourth byte #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);

    // --- Act
    io.writePort(0x3457, 0x32);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x32);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fourth byte #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);

    // --- Act
    io.writePort(0x3457, 0x40);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(4);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0x40);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x01);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0xa0);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x02);
    expect(attrs.attributeFlag2).toBe(true);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0xb8);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x02);
    expect(attrs.attributeFlag2).toBe(true);
    expect(attrs.scaleX).toBe(3);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0xa6);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x02);
    expect(attrs.attributeFlag2).toBe(true);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(3);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #5", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0x01);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x123);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #6", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0x41);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x01);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #7", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0x81);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x123);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x02);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx57 (Sprites Attribute) fifth byte #8", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x3157, 0x23);
    io.writePort(0x3257, 0x45);
    io.writePort(0x3357, 0xa1);
    io.writePort(0x3457, 0x40);

    // --- Act
    io.writePort(0x3557, 0xc1);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x123);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(true);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x03);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(1);
    expect(spr.spriteSubIndex).toBe(0);
  });

  it("0xxx5b (Sprites Pattern) first write #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);

    // --- Act
    io.writePort(0x305b, 0xff);

    // --- Assert (check variant 0 = base pattern)
    const variant0 = spr.patternMemory8bit[0];
    expect(variant0[0]).toBe(0xff);
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(1);
  });

  it("0xxx5b (Sprites Pattern) first write #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x80);

    // --- Act
    io.writePort(0x305b, 0xff);

    // --- Assert (check variant 0 = base pattern)
    const variant0 = spr.patternMemory8bit[0];
    expect(variant0[0x80]).toBe(0xff);
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(0x81);
  });

  it("0xxx5b (Sprites Pattern) first write #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x04);

    // --- Act
    io.writePort(0x305b, 0xff);

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    expect(variant0[0]).toBe(0xff);
    expect(spr.patternIndex).toBe(4);
    expect(spr.patternSubIndex).toBe(0x01);
  });

  it("0xxx5b (Sprites Pattern) first write #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x84);

    // --- Act
    io.writePort(0x305b, 0xff);

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    expect(variant0[0x80]).toBe(0xff);
    expect(spr.patternIndex).toBe(4);
    expect(spr.patternSubIndex).toBe(0x81);
  });

  it("0xxx5b (Sprites Pattern) second write #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);
    io.writePort(0x305b, 0xff);

    // --- Act
    io.writePort(0x315b, 0xa5);

    // --- Assert (check variant 0)
    const variant0 = spr.patternMemory8bit[0];
    expect(variant0[0]).toBe(0xff);
    expect(variant0[1]).toBe(0xa5);
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(2);
  });

  it("0xxx5b (Sprites Pattern) second write #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x80);
    io.writePort(0x305b, 0xff);

    // --- Act
    io.writePort(0x315b, 0xa5);

    // --- Assert (check variant 0)
    const variant0 = spr.patternMemory8bit[0];
    expect(variant0[0x80]).toBe(0xff);
    expect(variant0[0x81]).toBe(0xa5);
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(0x82);
  });

  it("0xxx5b (Sprites Pattern) second write #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x04);
    io.writePort(0x305b, 0xff);

    // --- Act
    io.writePort(0x315b, 0xa5);

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    expect(variant0[0]).toBe(0xff);
    expect(variant0[1]).toBe(0xa5);
    expect(spr.patternIndex).toBe(4);
    expect(spr.patternSubIndex).toBe(0x02);
  });

  it("0xxx5b (Sprites Pattern) second write #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x84);
    io.writePort(0x305b, 0xff);

    // --- Act
    io.writePort(0x315b, 0xa5);

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    expect(variant0[0x80]).toBe(0xff);
    expect(variant0[0x81]).toBe(0xa5);
    expect(spr.patternIndex).toBe(4);
    expect(spr.patternSubIndex).toBe(0x82);
  });

  it("0xxx5b (Sprites Pattern) 100 writes #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);

    // --- Act
    for (let i = 0; i < 100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (check variant 0)
    const variant0 = spr.patternMemory8bit[0];
    for (let i = 0; i < 100; i++) {
      expect(variant0[i]).toBe(i);
    }
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(100);
  });

  it("0xxx5b (Sprites Pattern) 100 writes #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x80);

    // --- Act
    for (let i = 0; i < 100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (check variant 0)
    const variant0 = spr.patternMemory8bit[0];
    for (let i = 0; i < 100; i++) {
      expect(variant0[0x80 + i]).toBe(i);
    }
    expect(spr.patternIndex).toBe(0);
    expect(spr.patternSubIndex).toBe(0x80 + 100);
  });

  it("0xxx5b (Sprites Pattern) 100 writes #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x04);

    // --- Act
    for (let i = 0; i < 100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    for (let i = 0; i < 100; i++) {
      expect(variant0[i]).toBe(i);
    }
    expect(spr.patternIndex).toBe(0x04);
    expect(spr.patternSubIndex).toBe(100);
  });

  it("0xxx5b (Sprites Pattern) 100 writes #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x84);

    // --- Act
    for (let i = 0; i < 100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    for (let i = 0; i < 100; i++) {
      expect(variant0[0x80 + i]).toBe(i);
    }
    expect(spr.patternIndex).toBe(0x04);
    expect(spr.patternSubIndex).toBe(0x80 + 100);
  });

  it("0xxx5b (Sprites Pattern) 256 writes #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);

    // --- Act
    for (let i = 0; i < 0x100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (check variant 0)
    const variant0 = spr.patternMemory8bit[0];
    for (let i = 0; i < 0x100; i++) {
      expect(variant0[i]).toBe(i);
    }
    expect(spr.patternIndex).toBe(1);
    expect(spr.patternSubIndex).toBe(0x00);
  });

  it("0xxx5b (Sprites Pattern) 256 writes #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x80);

    // --- Act
    for (let i = 0; i < 0x100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (check variant 0, wraps from pattern 0 to pattern 1)
    const variant0_p0 = spr.patternMemory8bit[0];
    const variant0_p1 = spr.patternMemory8bit[1 << 3];
    for (let i = 0; i < 0x100; i++) {
      const addr = 0x80 + i;
      if (addr < 0x100) {
        expect(variant0_p0[addr]).toBe(i);
      } else {
        expect(variant0_p1[addr & 0xff]).toBe(i);
      }
    }
    expect(spr.patternIndex).toBe(1);
    expect(spr.patternSubIndex).toBe(0x80);
  });

  it("0xxx5b (Sprites Pattern) 256 writes #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x04);

    // --- Act
    for (let i = 0; i < 0x100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (pattern 4, variant 0)
    const variant0 = spr.patternMemory8bit[4 << 3];
    for (let i = 0; i < 0x100; i++) {
      expect(variant0[i]).toBe(i);
    }
    expect(spr.patternIndex).toBe(0x05);
    expect(spr.patternSubIndex).toBe(0x00);
  });

  it("0xxx5b (Sprites Pattern) 256 writes #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x84);

    // --- Act
    for (let i = 0; i < 0x100; i++) {
      io.writePort((i << 8) | 0x5b, i);
    }

    // --- Assert (patterns 4 and 5, variant 0)
    const variant0_p4 = spr.patternMemory8bit[4 << 3];
    const variant0_p5 = spr.patternMemory8bit[5 << 3];
    for (let i = 0; i < 0x100; i++) {
      const addr = 0x80 + i;
      if (addr < 0x100) {
        expect(variant0_p4[addr]).toBe(i);
      } else {
        expect(variant0_p5[addr & 0xff]).toBe(i);
      }
    }
    expect(spr.patternIndex).toBe(0x05);
    expect(spr.patternSubIndex).toBe(0x80);
  });

  it("0xxx5b (Sprites Pattern) 258 writes #1", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x00);

    // --- Act
    for (let i = 0; i < 0x102; i++) {
      io.writePort(((i << 8) & 0xff) | 0x5b, i & 0xff);
    }

    // --- Assert (check variant 0 across patterns 0 and 1)
    const variant0_p0 = spr.patternMemory8bit[0];
    const variant0_p1 = spr.patternMemory8bit[1 << 3];
    for (let i = 0; i < 0x102; i++) {
      const variant = i < 0x100 ? variant0_p0 : variant0_p1;
      const addr = i & 0xff;
      expect(variant[addr]).toBe(i & 0xff);
    }
    expect(spr.patternIndex).toBe(1);
    expect(spr.patternSubIndex).toBe(0x02);
  });

  it("0xxx5b (Sprites Pattern) 258 writes #2", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x80);

    // --- Act
    for (let i = 0; i < 0x102; i++) {
      io.writePort(((i << 8) & 0xff) | 0x5b, i & 0xff);
    }

    // --- Assert (check variant 0 across patterns 0 and 1)
    const variant0_p0 = spr.patternMemory8bit[0];
    const variant0_p1 = spr.patternMemory8bit[1 << 3];
    for (let i = 0; i < 0x102; i++) {
      const addr = 0x80 + i;
      const variant = addr < 0x100 ? variant0_p0 : variant0_p1;
      expect(variant[addr & 0xff]).toBe(i & 0xff);
    }
    expect(spr.patternIndex).toBe(1);
    expect(spr.patternSubIndex).toBe(0x82);
  });

  it("0xxx5b (Sprites Pattern) 258 writes #3", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x04);

    // --- Act
    for (let i = 0; i < 0x102; i++) {
      io.writePort(((i << 8) & 0xff) | 0x5b, i & 0xff);
    }

    // --- Assert (check variant 0 across patterns 4 and 5)
    const variant0_p4 = spr.patternMemory8bit[4 << 3];
    const variant0_p5 = spr.patternMemory8bit[5 << 3];
    for (let i = 0; i < 0x102; i++) {
      const variant = i < 0x100 ? variant0_p4 : variant0_p5;
      const addr = i & 0xff;
      expect(variant[addr]).toBe(i & 0xff);
    }
    expect(spr.patternIndex).toBe(0x05);
    expect(spr.patternSubIndex).toBe(0x02);
  });

  it("0xxx5b (Sprites Pattern) 258 writes #4", async () => {
    const machine = await createTestNextMachine();
    const io = machine.portManager;
    const spr = machine.spriteDevice;
    io.writePort(0x303b, 0x84);

    // --- Act
    for (let i = 0; i < 0x102; i++) {
      io.writePort(((i << 8) & 0xff) | 0x5b, i & 0xff);
    }

    // --- Assert (check variant 0 across patterns 4 and 5)
    const variant0_p4 = spr.patternMemory8bit[4 << 3];
    const variant0_p5 = spr.patternMemory8bit[5 << 3];
    for (let i = 0; i < 0x102; i++) {
      const addr = 0x80 + i;
      const variant = addr < 0x100 ? variant0_p4 : variant0_p5;
      expect(variant[addr & 0xff]).toBe(i & 0xff);
    }
    expect(spr.patternIndex).toBe(0x05);
    expect(spr.patternSubIndex).toBe(0x82);
  });

  it("Reg $34 with lockStep #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);

    // --- Act
    writeNextReg(m, 0x34, 0x80);

    // --- Assert
    expect(spriteDevice.patternIndex).toBe(0x00);
    expect(spriteDevice.patternSubIndex).toBe(0x80);
    expect(spriteDevice.spriteIndex).toBe(0x00);
    expect(spriteDevice.spriteSubIndex).toBe(0x00);
    expect(spriteDevice.spriteMirrorIndex).toBe(0x00);
    expect(readNextReg(m, 0x34)).toBe(spriteDevice.spriteMirrorIndex);
  });

  it("Reg $34 with lockStep #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);

    // --- Act
    writeNextReg(m, 0x34, 0xc4);

    // --- Assert
    expect(spriteDevice.patternIndex).toBe(0x04);
    expect(spriteDevice.patternSubIndex).toBe(0x80);
    expect(spriteDevice.spriteIndex).toBe(0x44);
    expect(spriteDevice.spriteSubIndex).toBe(0x00);
    expect(spriteDevice.spriteMirrorIndex).toBe(0x00);
    expect(readNextReg(m, 0x34)).toBe(spriteDevice.spriteMirrorIndex);
  });

  it("Reg $34 with no lockStep #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);

    // --- Act
    writeNextReg(m, 0x34, 0x80);

    // --- Assert
    expect(spriteDevice.spriteMirrorIndex).toBe(0x00);
    expect(readNextReg(m, 0x34)).toBe(spriteDevice.spriteMirrorIndex);
  });

  it("Reg $34 with no lockStep #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);

    // --- Act
    writeNextReg(m, 0x34, 0xc3);

    // --- Assert
    expect(spriteDevice.spriteMirrorIndex).toBe(0x43);
    expect(readNextReg(m, 0x34)).toBe(spriteDevice.spriteMirrorIndex);
  });

  it("Reg $34 with no lockStep #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spriteDevice = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);

    // --- Act
    writeNextReg(m, 0x34, 0x43);

    // --- Assert
    expect(spriteDevice.spriteMirrorIndex).toBe(0x43);
    expect(readNextReg(m, 0x34)).toBe(spriteDevice.spriteMirrorIndex);
  });

  it("Reg $35 with lockStep #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x00);

    // --- Act
    writeNextReg(m, 0x35, 0x23);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $35 with lockStep #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x35, 0x23);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(4);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $35 with lockStep #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x84);

    // --- Act
    writeNextReg(m, 0x35, 0x23);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(4);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $35 with no lockStep #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x00);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x35, 0x23);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $35 with no lockStep #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x35, 0x23);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $35 with no lockStep #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x84);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x35, 0x23);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $36 with lockStep #1", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x00);

    // --- Act
    writeNextReg(m, 0x36, 0x45);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $36 with lockStep #2", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x36, 0x45);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $36 with lockStep #3", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x84);

    // --- Act
    writeNextReg(m, 0x36, 0x45);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $36 with no lockStep #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x00);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x36, 0x45);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $36 with no lockStep #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x36, 0x45);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $36 with no lockStep #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x84);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x36, 0x45);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $37 with lockStep #1", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x00);

    // --- Act
    writeNextReg(m, 0x37, 0xa0);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $37 with lockStep #1", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x00);

    // --- Act
    writeNextReg(m, 0x37, 0xa0);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $37 with lockStep #2", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x37, 0xa0);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $37 with lockStep #3", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x84);

    // --- Act
    writeNextReg(m, 0x37, 0xa0);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $37 with no lockStep #1", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x00);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x37, 0xa0);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $37 with no lockStep #2", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x37, 0xa0);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $38 with lockStep #1", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x00);

    // --- Act
    writeNextReg(m, 0x38, 0x80);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $38 with lockStep #2", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x38, 0x80);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $38 with lockStep #3", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x84);

    // --- Act
    writeNextReg(m, 0x38, 0x80);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $38 with no lockStep #1", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x00);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x38, 0x80);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $38 with no lockStep #2", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x38, 0x80);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $39 with lockStep #1", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x00);

    // --- Act
    writeNextReg(m, 0x39, 0x18);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $39 with lockStep #2", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x39, 0x18);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $39 with lockStep #3", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x84);

    // --- Act
    writeNextReg(m, 0x39, 0x18);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x04);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $39 with no lockStep #1", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x00);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x39, 0x18);

    // --- Assert
    const attrs = spr.attributes[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $39 with no lockStep #2", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x39, 0x18);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x04);
  });

  it("Reg $75 with lockStep", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x75, 0x23);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(5);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $75 with no lockStep", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x75, 0x23);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x05);
  });

  it("Reg $76 with lockStep", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x76, 0x45);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x05);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $76 with no lockStep", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x76, 0x45);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x05);
  });

  it("Reg $77 with lockStep", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x77, 0xa0);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x05);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $77 with no lockStep", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x77, 0xa0);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x05);
  });

  it("Reg $78 with lockStep", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x78, 0x80);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x05);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $78 with no lockStep", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x78, 0x80);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x05);
  });

  it("Reg $79 with lockStep", async () => {
    const m = await createTestNextMachine();
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x10);
    writeNextReg(m, 0x34, 0x04);

    // --- Act
    writeNextReg(m, 0x79, 0x18);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x05);
    expect(spr.spriteSubIndex).toBe(0x00);
    expect(spr.spriteMirrorIndex).toBe(0);
  });

  it("Reg $79 with no lockStep", async () => {
    const m = await createTestNextMachine();
    const io = m.portManager;
    const spr = m.spriteDevice;
    writeNextReg(m, 0x09, 0x00);
    writeNextReg(m, 0x34, 0x04);
    io.writePort(0x303b, 0x43);

    // --- Act
    writeNextReg(m, 0x79, 0x18);

    // --- Assert
    const attrs = spr.attributes[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(false);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x00);
    expect(attrs.colorMode).toBe(0x00);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0);

    expect(spr.spriteIndex).toBe(0x43);
    expect(spr.spriteSubIndex).toBe(0);
    expect(spr.spriteMirrorIndex).toBe(0x05);
  });

});

// ================================================================================================
// 9-bit Coordinate Validation Tests
// ================================================================================================

describe("9-bit Coordinate Validation", async function () {
  it("X coordinate: single write (0x23)", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    machine.portManager.writePort(0x303b, 0x00);  // Sprite 0

    // --- Act: Write X coordinate
    machine.portManager.writePort(0x3157, 0x23);

    // --- Assert: X stored as 9-bit (lower 8 bits, MSB from attr4)
    expect(spr.attributes[0].x).toBe(0x23);
  });

  it("X coordinate: masked to 9-bit range", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 0, 0xff);  // X LSB = 0xFF
    spr.writeIndexedSpriteAttribute(0, 4, 0x01);  // X MSB = 1, colorMode = 0

    // --- Assert: X = 0x1FF (9-bit max)
    expect(attrs.x).toBe(0x1ff);
  });

  it("X coordinate: 0x100 via MSB only", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 0, 0x00);  // X LSB = 0
    spr.writeIndexedSpriteAttribute(0, 4, 0x01);  // X MSB = 1, colorMode = 0

    // --- Assert: X = 0x100
    expect(attrs.x).toBe(0x100);
  });

  it("X coordinate: update LSB after MSB", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 4, 0x01);  // X MSB = 1 → x = 0x100
    spr.writeIndexedSpriteAttribute(0, 0, 0x42);  // X LSB = 0x42 → x = 0x142

    // --- Assert: X = 0x142
    expect(attrs.x).toBe(0x142);
  });

  it("X coordinate: wraps at 512", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 0, 0xff);  // X LSB = 0xFF
    spr.writeIndexedSpriteAttribute(0, 4, 0x03);  // X MSB = 1, colorMode = 0 → x = 0x1FF

    // Now try to set X beyond 9-bit
    spr.writeIndexedSpriteAttribute(0, 0, 0x00);  // X LSB = 0
    spr.writeIndexedSpriteAttribute(0, 4, 0x03);  // X MSB = 1 (unchanged) → x = 0x100

    // --- Assert: Values masked to 9-bit
    expect(attrs.x & 0x1ff).toBe(attrs.x);  // Verify it's within 9-bit range
    expect(attrs.x).toBe(0x100);
  });

  it("Y coordinate: single write (0x45)", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    machine.portManager.writePort(0x303b, 0x00);  // Sprite 0

    // --- Act: Write X coordinate first, then Y coordinate
    machine.portManager.writePort(0x3157, 0x00);  // X = 0
    machine.portManager.writePort(0x3257, 0x45);  // Y = 0x45

    // --- Assert: Y stored as 9-bit (lower 8 bits)
    expect(spr.attributes[0].y).toBe(0x45);
  });

  it("Y coordinate: masked to 9-bit range", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 1, 0xff);  // Y LSB = 0xFF

    // --- Assert: Y = 0xFF (Y MSB not yet set)
    expect(attrs.y).toBe(0xff);
  });

  it("Y coordinate: update order independence", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 1, 0x50);  // Y LSB = 0x50
    spr.writeIndexedSpriteAttribute(0, 0, 0x12);  // X LSB = 0x12 (no Y change)

    // --- Assert: Y unchanged
    expect(attrs.y).toBe(0x50);
  });

  it("X coordinate: relative sprite ignores MSB", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 0, 0x80);  // X LSB = 0x80
    spr.writeIndexedSpriteAttribute(0, 1, 0x60);  // Y LSB = 0x60
    spr.writeIndexedSpriteAttribute(0, 3, 0x40);  // has5AttributeBytes = 1, enableVisibility = 0
    spr.writeIndexedSpriteAttribute(0, 4, 0xc1);  // colorMode = 3 (11), attr2 = 0, X MSB = 1

    // --- Assert: X MSB applied because colorMode != 1 (not relative sprite mode)
    expect(attrs.x).toBe(0x180);  // X = 0x80 | 0x100
  });

  it("X coordinate: anchor sprite applies MSB", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 0, 0x80);  // X LSB = 0x80
    spr.writeIndexedSpriteAttribute(0, 1, 0x60);  // Y LSB = 0x60
    spr.writeIndexedSpriteAttribute(0, 3, 0x40);  // has5AttributeBytes = 1, enableVisibility = 0
    spr.writeIndexedSpriteAttribute(0, 4, 0x01);  // colorMode = 0 (anchor), X MSB = 1

    // --- Assert: X MSB applied because colorMode = 0 (anchor)
    expect(attrs.x).toBe(0x180);  // 0x80 | 0x100
  });

  it("Both X and Y coordinates: various values", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const testCases = [
      { xLsb: 0x00, yLsb: 0x00, xMsb: 0, expected: { x: 0x000, y: 0x000 } },
      { xLsb: 0xff, yLsb: 0xff, xMsb: 0, expected: { x: 0x0ff, y: 0x0ff } },
      { xLsb: 0x00, yLsb: 0x00, xMsb: 1, expected: { x: 0x100, y: 0x000 } },
      { xLsb: 0xff, yLsb: 0xff, xMsb: 1, expected: { x: 0x1ff, y: 0x0ff } },
      { xLsb: 0x42, yLsb: 0x84, xMsb: 0, expected: { x: 0x042, y: 0x084 } },
      { xLsb: 0x42, yLsb: 0x84, xMsb: 1, expected: { x: 0x142, y: 0x084 } },
    ];

    for (const tc of testCases) {
      const sprite = 0;
      const attrs = spr.attributes[sprite];
      spr.writeIndexedSpriteAttribute(sprite, 0, tc.xLsb);
      spr.writeIndexedSpriteAttribute(sprite, 1, tc.yLsb);
      spr.writeIndexedSpriteAttribute(sprite, 4, tc.xMsb ? 0x01 : 0x00);  // colorMode = 0

      expect(attrs.x).toBe(tc.expected.x);
      expect(attrs.y).toBe(tc.expected.y);
    }
  });

  it("Coordinate overflow doesn't affect other fields", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 0, 0xff);   // X LSB
    spr.writeIndexedSpriteAttribute(0, 1, 0xff);   // Y LSB
    spr.writeIndexedSpriteAttribute(0, 2, 0x5a);   // Palette, mirrors, rotate
    spr.writeIndexedSpriteAttribute(0, 3, 0xbf);   // Visibility, 5-byte, pattern
    spr.writeIndexedSpriteAttribute(0, 4, 0xd9);   // colorMode, scales, X MSB

    // --- Assert: All fields correct
    expect(attrs.x).toBe(0x1ff);
    expect(attrs.y).toBe(0xff);
    expect(attrs.paletteOffset).toBe(0x05);
    expect(attrs.mirrorX).toBe(true);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(true);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.has5AttributeBytes).toBe(false);
    expect(attrs.patternIndex).toBe(0x3f);
    expect(attrs.colorMode).toBe(0x03);
    expect(attrs.attributeFlag2).toBe(false);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0x00);
  });
});

// ================================================================================================
// Computed Fields Tests (pattern7Bit and is4BitPattern)
// ================================================================================================

describe("Computed Fields (pattern7Bit and is4BitPattern)", async function () {
  it("pattern7Bit: initial value is 0", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];

    // --- Assert: Both computed fields start at 0/false
    expect(attrs.pattern7Bit).toBe(0);
    expect(attrs.is4BitPattern).toBe(false);
  });

  it("pattern7Bit: set via attr3 (patternIndex 0-63)", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];

    for (let patternIdx = 0; patternIdx <= 63; patternIdx++) {
      spr.writeIndexedSpriteAttribute(0, 3, patternIdx);
      // --- Assert: pattern7Bit = patternIdx (no MSB yet)
      expect(attrs.patternIndex).toBe(patternIdx);
      expect(attrs.pattern7Bit).toBe(patternIdx);
    }
  });

  it("pattern7Bit: MSB set via attr4[6]", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 3, 0x1f);  // patternIndex = 31
    spr.writeIndexedSpriteAttribute(0, 4, 0x20);  // attributeFlag2 = 1 (bit 6)

    // --- Assert: pattern7Bit = 31 | 64 = 95
    expect(attrs.patternIndex).toBe(0x1f);
    expect(attrs.attributeFlag2).toBe(true);
    expect(attrs.pattern7Bit).toBe(95);  // 31 + 64
  });

  it("pattern7Bit: range 0-127 via both components", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const testCases = [
      { patternIdx: 0x00, msb: false, expected: 0x00 },
      { patternIdx: 0x3f, msb: false, expected: 0x3f },  // 63
      { patternIdx: 0x00, msb: true, expected: 0x40 },   // 64
      { patternIdx: 0x3f, msb: true, expected: 0x7f },   // 127
      { patternIdx: 0x20, msb: false, expected: 0x20 },  // 32
      { patternIdx: 0x20, msb: true, expected: 0x60 },   // 96
    ];

    for (const tc of testCases) {
      const attrs = spr.attributes[0];
      spr.writeIndexedSpriteAttribute(0, 3, tc.patternIdx);
      spr.writeIndexedSpriteAttribute(0, 4, tc.msb ? 0x20 : 0x00);
      expect(attrs.pattern7Bit).toBe(tc.expected);
    }
  });

  it("pattern7Bit: updates when patternIndex changes", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 4, 0x20);  // Set MSB = 1

    // --- Change patternIndex
    spr.writeIndexedSpriteAttribute(0, 3, 0x0f);
    expect(attrs.pattern7Bit).toBe(0x4f);  // 15 + 64

    spr.writeIndexedSpriteAttribute(0, 3, 0x2a);
    expect(attrs.pattern7Bit).toBe(0x6a);  // 42 + 64
  });

  it("pattern7Bit: updates when MSB changes", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];
    spr.writeIndexedSpriteAttribute(0, 3, 0x1f);  // patternIndex = 31

    // --- Start without MSB
    expect(attrs.pattern7Bit).toBe(0x1f);

    // --- Set MSB
    spr.writeIndexedSpriteAttribute(0, 4, 0x20);
    expect(attrs.pattern7Bit).toBe(0x5f);  // 31 + 64

    // --- Clear MSB
    spr.writeIndexedSpriteAttribute(0, 4, 0x00);
    expect(attrs.pattern7Bit).toBe(0x1f);  // 31 (MSB cleared)
  });

  it("is4BitPattern: initial value is false", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;

    // --- Assert
    expect(spr.attributes[0].is4BitPattern).toBe(false);
  });

  it("is4BitPattern: set via attr4[7]", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];

    // --- Write attr4 with bit 7 = 0
    spr.writeIndexedSpriteAttribute(0, 4, 0x00);
    expect(attrs.is4BitPattern).toBe(false);

    // --- Write attr4 with bit 7 = 1
    spr.writeIndexedSpriteAttribute(0, 4, 0x80);
    expect(attrs.is4BitPattern).toBe(true);

    // --- Write attr4 with bit 7 = 0 again
    spr.writeIndexedSpriteAttribute(0, 4, 0x00);
    expect(attrs.is4BitPattern).toBe(false);
  });

  it("is4BitPattern: combined with other attr4 bits", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];

    // --- Write attr4 with multiple bits set
    // Bits: 10101010 = 0xAA
    // Bit 7 (is4BitPattern) = 1
    // Bit 6 (attributeFlag2 = MSB for pattern) = 0
    // Bit 5 = 1
    // Bit 4 = 0 (scale X bit 1)
    // Bit 3 = 1 (scale X bit 0)
    // Bit 2 = 0 (scale Y bit 1)
    // Bit 1 = 1 (scale Y bit 0)
    // Bit 0 = 0 (X MSB)
    spr.writeIndexedSpriteAttribute(0, 4, 0xaa);

    expect(attrs.is4BitPattern).toBe(true);
    expect(attrs.attributeFlag2).toBe(true);   // Bit 5 = 1 in 0xAA
    expect(attrs.scaleX).toBe(0x01);           // Bits 4:3 = 01
    expect(attrs.scaleY).toBe(0x01);           // Bits 2:1 = 01
  });

  it("pattern7Bit and is4BitPattern: both fields independent", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];

    // --- Set pattern index to 42, MSB off, 8-bit mode
    spr.writeIndexedSpriteAttribute(0, 3, 42);
    spr.writeIndexedSpriteAttribute(0, 4, 0x00);

    expect(attrs.pattern7Bit).toBe(42);
    expect(attrs.is4BitPattern).toBe(false);

    // --- Change to 4-bit mode (doesn't affect pattern7Bit)
    spr.writeIndexedSpriteAttribute(0, 4, 0x80);

    expect(attrs.pattern7Bit).toBe(42);  // Unchanged
    expect(attrs.is4BitPattern).toBe(true);

    // --- Set MSB for pattern (doesn't affect 4-bit flag)
    spr.writeIndexedSpriteAttribute(0, 4, 0xa0);  // 0x80 | 0x20

    expect(attrs.pattern7Bit).toBe(42 + 64);  // 106
    expect(attrs.is4BitPattern).toBe(true);    // Still true
  });

  it("Computed fields don't affect other attributes", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;
    const attrs = spr.attributes[0];

    // --- Set all attributes
    spr.writeIndexedSpriteAttribute(0, 0, 0x55);  // X LSB
    spr.writeIndexedSpriteAttribute(0, 1, 0xaa);  // Y LSB
    spr.writeIndexedSpriteAttribute(0, 2, 0x4c);  // Palette, mirrors, rotate
    spr.writeIndexedSpriteAttribute(0, 3, 0xbf);  // Visibility, pattern
    spr.writeIndexedSpriteAttribute(0, 4, 0xf9);  // colorMode, scales, pattern MSB, 4-bit, X MSB

    // --- Verify computed fields
    expect(attrs.pattern7Bit).toBe(63 + 64);  // 0x3f | 0x40
    expect(attrs.is4BitPattern).toBe(true);

    // --- Verify all other attributes unchanged
    expect(attrs.x).toBe(0x155);               // 0x55 | 0x100
    expect(attrs.y).toBe(0xaa);
    expect(attrs.paletteOffset).toBe(0x04);
    expect(attrs.mirrorX).toBe(true);
    expect(attrs.mirrorY).toBe(true);
    expect(attrs.rotate).toBe(false);
    expect(attrs.visible).toBe(true);
    expect(attrs.colorMode).toBe(0x03);
    expect(attrs.scaleX).toBe(0x03);
    expect(attrs.scaleY).toBe(0x00);
  });

  it("Multiple sprites have independent computed fields", async () => {
    const machine = await createTestNextMachine();
    const spr = machine.spriteDevice;

    // --- Set sprite 0
    spr.writeIndexedSpriteAttribute(0, 3, 10);
    spr.writeIndexedSpriteAttribute(0, 4, 0x00);

    // --- Set sprite 1
    spr.writeIndexedSpriteAttribute(1, 3, 20);
    spr.writeIndexedSpriteAttribute(1, 4, 0x20);

    // --- Set sprite 2
    spr.writeIndexedSpriteAttribute(2, 3, 30);
    spr.writeIndexedSpriteAttribute(2, 4, 0x80);

    // --- Verify each sprite has correct computed fields
    expect(spr.attributes[0].pattern7Bit).toBe(10);
    expect(spr.attributes[0].is4BitPattern).toBe(false);

    expect(spr.attributes[1].pattern7Bit).toBe(20 + 64);
    expect(spr.attributes[1].is4BitPattern).toBe(false);

    expect(spr.attributes[2].pattern7Bit).toBe(30);
    expect(spr.attributes[2].is4BitPattern).toBe(true);
  });

  describe("Pattern Index Bounds - 6-bit + 7-bit (attr3[5:0] + attr4[6])", () => {
    it("Should compute correct pattern index from attr3[5:0] only (6-bit)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      
      // --- Act: Write pattern index to attr3 (bits 5:0), attributeFlag2 not set
      spr.writeIndexedSpriteAttribute(0, 3, 0x3f); // Max 6-bit value
      
      // --- Assert
      expect(spr.attributes[0].patternIndex).toBe(0x3f);
      expect(spr.attributes[0].attributeFlag2).toBe(false);
      expect(spr.attributes[0].pattern7Bit).toBe(0x3f); // Should be 0x3f (63)
      expect(spr.getFullPatternIndex(spr.attributes[0])).toBe(0x3f);
    });

    it("Should compute correct pattern index using attr4[6] extension bit (7-bit)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      const sprite = spr.attributes[0];
      
      // --- Act: Write pattern index to attr3 (0x3f), then set attr4[6] (attributeFlag2)
      spr.writeIndexedSpriteAttribute(0, 3, 0x3f); // patternIndex = 0x3f
      spr.writeIndexedSpriteAttribute(0, 4, 0x20); // attr4[6] set (attributeFlag2 = true)
      
      // --- Assert
      expect(sprite.patternIndex).toBe(0x3f);
      expect(sprite.attributeFlag2).toBe(true);
      expect(sprite.pattern7Bit).toBe(0x7f); // Should be 0x3f | 0x40 = 0x7f (127)
      expect(spr.getFullPatternIndex(sprite)).toBe(0x7f);
    });

    it("Should allow all 128 pattern indices (0-127)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      
      // --- Act & Assert: Test all 128 pattern indices
      for (let patIdx = 0; patIdx < 128; patIdx++) {
        const attr3Val = patIdx & 0x3f;      // Lower 6 bits
        const attr4Val = (patIdx & 0x40) ? 0x20 : 0x00; // Bit 6 → attr4[6]
        
        // Only write without enableVisibility bit for these tests
        spr.writeIndexedSpriteAttribute(0, 3, attr3Val);
        spr.writeIndexedSpriteAttribute(0, 4, attr4Val);
        
        const sprite = spr.attributes[0];
        expect(spr.getFullPatternIndex(sprite)).toBe(patIdx);
        expect(sprite.pattern7Bit).toBe(patIdx);
      }
    });

    it("Should correctly mask pattern index in attr3 to 6 bits", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      
      // --- Act: Write value with bits set above bit 5
      spr.writeIndexedSpriteAttribute(0, 3, 0xff); // All bits set
      
      // --- Assert
      expect(spr.attributes[0].patternIndex).toBe(0x3f); // Only bits 5:0 should be stored
      expect(spr.attributes[0].pattern7Bit).toBe(0x3f);
    });

    it("Should handle attributeFlag2 bit (attr4[6]) correctly", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      const sprite = spr.attributes[0];
      
      // --- Act: Set pattern to 0, then enable attr4[6]
      spr.writeIndexedSpriteAttribute(0, 3, 0x00);
      expect(spr.getFullPatternIndex(sprite)).toBe(0x00);
      
      spr.writeIndexedSpriteAttribute(0, 4, 0x20); // attr4[6] = 1
      expect(spr.getFullPatternIndex(sprite)).toBe(0x40); // Should be 0 | 0x40 = 0x40
      
      spr.writeIndexedSpriteAttribute(0, 4, 0x00); // attr4[6] = 0
      expect(spr.getFullPatternIndex(sprite)).toBe(0x00); // Should be 0 | 0 = 0
    });

    it("Should compute pattern7Bit when writing attr3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      const sprite = spr.attributes[1];
      
      // --- Act: Set attributeFlag2 first, then write attr3
      spr.writeIndexedSpriteAttribute(1, 4, 0x20); // attributeFlag2 = true
      spr.writeIndexedSpriteAttribute(1, 3, 0x25); // patternIndex = 0x25
      
      // --- Assert
      expect(sprite.patternIndex).toBe(0x25);
      expect(sprite.attributeFlag2).toBe(true);
      expect(sprite.pattern7Bit).toBe(0x65); // Should be 0x25 | 0x40 = 0x65
      expect(spr.getFullPatternIndex(sprite)).toBe(0x65);
    });

    it("Should compute pattern7Bit when writing attr4[6]", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      const sprite = spr.attributes[2];
      
      // --- Act: Set patternIndex first, then toggle attr4[6]
      spr.writeIndexedSpriteAttribute(2, 3, 0x22); // patternIndex = 0x22
      expect(sprite.pattern7Bit).toBe(0x22); // No attr4[6] bit set
      
      spr.writeIndexedSpriteAttribute(2, 4, 0x20); // Set attr4[6]
      // --- Assert
      expect(sprite.pattern7Bit).toBe(0x62); // Should be 0x22 | 0x40 = 0x62
      expect(spr.getFullPatternIndex(sprite)).toBe(0x62);
    });

    it("Should handle multiple sprites with different pattern indices", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      
      // --- Act: Set different pattern indices for multiple sprites
      const testCases = [
        { sprite: 0, attr3: 0x00, attr4: 0x00, expected: 0x00 },
        { sprite: 1, attr3: 0x3f, attr4: 0x00, expected: 0x3f },
        { sprite: 2, attr3: 0x00, attr4: 0x20, expected: 0x40 },
        { sprite: 3, attr3: 0x3f, attr4: 0x20, expected: 0x7f },
        { sprite: 4, attr3: 0x15, attr4: 0x00, expected: 0x15 },
        { sprite: 5, attr3: 0x2a, attr4: 0x20, expected: 0x6a },
      ];
      
      for (const tc of testCases) {
        spr.writeIndexedSpriteAttribute(tc.sprite, 3, tc.attr3 | 0x80);
        spr.writeIndexedSpriteAttribute(tc.sprite, 4, tc.attr4);
      }
      
      // --- Assert
      for (const tc of testCases) {
        const sprite = spr.attributes[tc.sprite];
        expect(spr.getFullPatternIndex(sprite)).toBe(tc.expected);
      }
    });

    it("Pattern index should stay within 7-bit range even with invalid attr4 bits", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      const sprite = spr.attributes[0];
      
      // --- Act: Write max values with other attr4 bits set
      spr.writeIndexedSpriteAttribute(0, 3, 0x3f | 0x80); // enableVisibility + max patternIndex
      spr.writeIndexedSpriteAttribute(0, 4, 0xff); // All bits set
      
      // --- Assert: Only bit 6 should affect pattern index
      const result = spr.getFullPatternIndex(sprite);
      expect(result).toBeLessThanOrEqual(0x7f);
      expect(result).toBeGreaterThanOrEqual(0x00);
    });

    it("getFullPatternIndex() should always return value in 0-127 range", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      
      // --- Act & Assert: Test edge cases
      const edgeCases = [
        { patternIndex: 0x00, attributeFlag2: false, expected: 0x00 },
        { patternIndex: 0x3f, attributeFlag2: false, expected: 0x3f },
        { patternIndex: 0x00, attributeFlag2: true,  expected: 0x40 },
        { patternIndex: 0x3f, attributeFlag2: true,  expected: 0x7f },
        { patternIndex: 0x20, attributeFlag2: false, expected: 0x20 },
        { patternIndex: 0x20, attributeFlag2: true,  expected: 0x60 },
      ];
      
      for (const tc of edgeCases) {
        const sprite = spr.attributes[0];
        sprite.patternIndex = tc.patternIndex;
        sprite.attributeFlag2 = tc.attributeFlag2;
        
        const result = spr.getFullPatternIndex(sprite);
        expect(result).toBe(tc.expected);
        expect(result).toBeLessThanOrEqual(0x7f);
        expect(result).toBeGreaterThanOrEqual(0x00);
      }
    });

    it("Should maintain pattern index consistency across multiple writes", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const spr = m.spriteDevice;
      const sprite = spr.attributes[0];
      
      // --- Act: Perform sequence of writes
      spr.writeIndexedSpriteAttribute(0, 3, 0x15);
      expect(spr.getFullPatternIndex(sprite)).toBe(0x15);
      
      spr.writeIndexedSpriteAttribute(0, 4, 0x20);
      expect(spr.getFullPatternIndex(sprite)).toBe(0x55); // 0x15 | 0x40
      
      spr.writeIndexedSpriteAttribute(0, 3, 0x2a);
      expect(spr.getFullPatternIndex(sprite)).toBe(0x6a); // 0x2a | 0x40
      
      spr.writeIndexedSpriteAttribute(0, 4, 0x00);
      expect(spr.getFullPatternIndex(sprite)).toBe(0x2a); // 0x2a | 0
      
      // --- Assert: All intermediate values should be correct
      expect(sprite.patternIndex).toBe(0x2a);
      expect(sprite.attributeFlag2).toBe(false);
    });
  });
});

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(m: IZxNextMachine, reg: number): number {
  m.nextRegDevice.setNextRegisterIndex(reg);
  return m.nextRegDevice.getNextRegisterValue();
}
