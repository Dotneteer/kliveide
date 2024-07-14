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
    expect(spr.enableSpriteClipping).toBe(false);
    expect(spr.enableSprites).toBe(false);
    expect(spr.enableSpritesOverBorder).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(true);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(true);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(true);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x123);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x123);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x123);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(true);
    expect(attrs.enableVisibility).toBe(false);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0]).toBe(0xff);
    expect(pat4[0]).toBe(0x0f);
    expect(pat4[1]).toBe(0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0x80]).toBe(0xff);
    expect(pat4[0x100]).toBe(0x0f);
    expect(pat4[0x101]).toBe(0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0x400]).toBe(0xff);
    expect(pat4[0x800]).toBe(0x0f);
    expect(pat4[0x801]).toBe(0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0x480]).toBe(0xff);
    expect(pat4[0x900]).toBe(0x0f);
    expect(pat4[0x901]).toBe(0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0]).toBe(0xff);
    expect(pat4[0]).toBe(0x0f);
    expect(pat4[1]).toBe(0x0f);
    expect(pat8[1]).toBe(0xa5);
    expect(pat4[2]).toBe(0x0a);
    expect(pat4[3]).toBe(0x05);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0x80]).toBe(0xff);
    expect(pat4[0x100]).toBe(0x0f);
    expect(pat4[0x101]).toBe(0x0f);
    expect(pat8[0x81]).toBe(0xa5);
    expect(pat4[0x102]).toBe(0x0a);
    expect(pat4[0x103]).toBe(0x05);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0x400]).toBe(0xff);
    expect(pat4[0x800]).toBe(0x0f);
    expect(pat4[0x801]).toBe(0x0f);
    expect(pat8[0x401]).toBe(0xa5);
    expect(pat4[0x802]).toBe(0x0a);
    expect(pat4[0x803]).toBe(0x05);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    expect(pat8[0x480]).toBe(0xff);
    expect(pat4[0x900]).toBe(0x0f);
    expect(pat4[0x901]).toBe(0x0f);
    expect(pat8[0x481]).toBe(0xa5);
    expect(pat4[0x902]).toBe(0x0a);
    expect(pat4[0x903]).toBe(0x05);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 100; i++) {
      expect(pat8[i]).toBe(i);
      expect(pat4[2 * i]).toBe(i >> 4);
      expect(pat4[2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 100; i++) {
      expect(pat8[0x80 + i]).toBe(i);
      expect(pat4[0x100 + 2 * i]).toBe(i >> 4);
      expect(pat4[0x100 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 100; i++) {
      expect(pat8[0x400 + i]).toBe(i);
      expect(pat4[0x800 + 2 * i]).toBe(i >> 4);
      expect(pat4[0x800 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 100; i++) {
      expect(pat8[0x480 + i]).toBe(i);
      expect(pat4[0x900 + 2 * i]).toBe(i >> 4);
      expect(pat4[0x900 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x100; i++) {
      expect(pat8[i]).toBe(i);
      expect(pat4[2 * i]).toBe(i >> 4);
      expect(pat4[2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x100; i++) {
      expect(pat8[0x80 + i]).toBe(i);
      expect(pat4[0x100 + 2 * i]).toBe(i >> 4);
      expect(pat4[0x100 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x100; i++) {
      expect(pat8[0x400 + i]).toBe(i);
      expect(pat4[0x800 + 2 * i]).toBe(i >> 4);
      expect(pat4[0x800 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x100; i++) {
      expect(pat8[0x480 + i]).toBe(i);
      expect(pat4[0x900 + 2 * i]).toBe(i >> 4);
      expect(pat4[0x900 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x102; i++) {
      expect(pat8[i]).toBe(i & 0xff);
      expect(pat4[2 * i]).toBe((i >> 4) & 0x0f);
      expect(pat4[2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x102; i++) {
      expect(pat8[0x80 + i]).toBe(i & 0xff);
      expect(pat4[0x100 + 2 * i]).toBe((i >> 4) & 0x0f);
      expect(pat4[0x100 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x102; i++) {
      expect(pat8[0x400 + i]).toBe(i & 0xff);
      expect(pat4[0x800 + 2 * i]).toBe((i >> 4) & 0x0f);
      expect(pat4[0x800 + 2 * i + 1]).toBe(i & 0x0f);
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

    // --- Assert
    const pat8 = spr.patternMemory8Bit;
    const pat4 = spr.pattermMemory4Bit;
    for (let i = 0; i < 0x102; i++) {
      expect(pat8[0x480 + i]).toBe(i & 0xff);
      expect(pat4[0x900 + 2 * i]).toBe((i >> 4) & 0x0f);
      expect(pat4[0x900 + 2 * i + 1]).toBe(i & 0x0f);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[0];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x23);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x45);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x0a);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(true);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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
    const attrs = spr.spriteMemory[4];
    expect(attrs.x).toBe(0x00);
    expect(attrs.y).toBe(0x00);
    expect(attrs.paletteOffset).toBe(0x00);
    expect(attrs.mirrorX).toBe(false);
    expect(attrs.mirrorY).toBe(false);
    expect(attrs.rotate).toBe(false);
    expect(attrs.attributeFlag1).toBe(false);
    expect(attrs.enableVisibility).toBe(false);
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

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(m: IZxNextMachine, reg: number): number {
  m.nextRegDevice.setNextRegisterIndex(reg);
  return m.nextRegDevice.getNextRegisterValue();
}
