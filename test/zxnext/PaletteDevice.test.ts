import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

describe("Next - PaletteDevice", async function () {
  it("After cold start", async () => {
    // --- Act
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Assert
    expect(pal.paletteIndex).toBe(0);
    expect(pal.secondWrite).toBe(false);
  });

  it("Palette index is set", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1b);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1b);
  });

  it("Setting palette index resets second byte flag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x40, 0x1b);
    nrDevice.directSetRegValue(0x41, 0x30);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1c);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("8-bit palette fill with ULA first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.ulaFirst[0x1f]).toBe(0x1ff); // Unchanged
    expect(pal.ulaFirst[0x20]).toBe(0x40);
    expect(pal.ulaFirst[0x21]).toBe(0x43);
    expect(pal.ulaFirst[0x22]).toBe(0x45);
    expect(pal.ulaFirst[0x23]).toBe(0x47);
    expect(pal.ulaFirst[0x24]).toBe(0x28); // Unchanged
  });

  it("8-bit palette fill with ULA second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x40);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.ulaSecond[0x1f]).toBe(0x1ff); // Unchanged
    expect(pal.ulaSecond[0x20]).toBe(0x40);
    expect(pal.ulaSecond[0x21]).toBe(0x43);
    expect(pal.ulaSecond[0x22]).toBe(0x45);
    expect(pal.ulaSecond[0x23]).toBe(0x47);
    expect(pal.ulaSecond[0x24]).toBe(0x28); // Unchanged
  });

  it("8-bit palette fill with Layer 2 first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.layer2First[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.layer2First[0x20]).toBe(0x40);
    expect(pal.layer2First[0x21]).toBe(0x43);
    expect(pal.layer2First[0x22]).toBe(0x45);
    expect(pal.layer2First[0x23]).toBe(0x47);
    expect(pal.layer2First[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with Layer 2 second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x50);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.layer2Second[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.layer2Second[0x20]).toBe(0x40);
    expect(pal.layer2Second[0x21]).toBe(0x43);
    expect(pal.layer2Second[0x22]).toBe(0x45);
    expect(pal.layer2Second[0x23]).toBe(0x47);
    expect(pal.layer2Second[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with sprite first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.spriteFirst[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.spriteFirst[0x20]).toBe(0x40);
    expect(pal.spriteFirst[0x21]).toBe(0x43);
    expect(pal.spriteFirst[0x22]).toBe(0x45);
    expect(pal.spriteFirst[0x23]).toBe(0x47);
    expect(pal.spriteFirst[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with sprite second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x60);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.spriteSecond[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.spriteSecond[0x20]).toBe(0x40);
    expect(pal.spriteSecond[0x21]).toBe(0x43);
    expect(pal.spriteSecond[0x22]).toBe(0x45);
    expect(pal.spriteSecond[0x23]).toBe(0x47);
    expect(pal.spriteSecond[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with tilemap first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x30);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.tilemapFirst[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.tilemapFirst[0x20]).toBe(0x40);
    expect(pal.tilemapFirst[0x21]).toBe(0x43);
    expect(pal.tilemapFirst[0x22]).toBe(0x45);
    expect(pal.tilemapFirst[0x23]).toBe(0x47);
    expect(pal.tilemapFirst[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with tilemap second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x70);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x41, 0x20);
    nrDevice.directSetRegValue(0x41, 0x21);
    nrDevice.directSetRegValue(0x41, 0x22);
    nrDevice.directSetRegValue(0x41, 0x23);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.tilemapSecond[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.tilemapSecond[0x20]).toBe(0x40);
    expect(pal.tilemapSecond[0x21]).toBe(0x43);
    expect(pal.tilemapSecond[0x22]).toBe(0x45);
    expect(pal.tilemapSecond[0x23]).toBe(0x47);
    expect(pal.tilemapSecond[0x24]).toBe(0x48); // Unchanged
  });

  it("Setting LSB of 9-bit palette value", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1c);
    expect(pal.ulaFirst[0x1c]).toBe(0x40);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(true);
  });

  it("Setting 8-bit palette value resets second byte flag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    const secondWriteBefore = pal.secondWrite;
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x41, 0x20);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.ulaFirst[0x1c]).toBe(0x40);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit palette value #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x00);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.ulaFirst[0x1c]).toBe(0x40);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit palette value #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.ulaFirst[0x1c]).toBe(0x41);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit palette value #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x80);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.ulaFirst[0x1c]).toBe(0x40);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit palette value #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.ulaFirst[0x1c]).toBe(0x41);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit Layer 2 palette value #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x00);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.layer2First[0x1c]).toBe(0x40);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit Layer 2 palette value #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.layer2First[0x1c]).toBe(0x41);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit Layer 2 palette value #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x80);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.layer2First[0x1c]).toBe(0x240);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting LSB and MSB of 9-bit Layer 2 palette value #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1d);
    expect(pal.layer2First[0x1c]).toBe(0x241);
    expect(secondWriteBefore).toBe(false);
    expect(pal.secondWrite).toBe(false);
  });

  it("Setting palette control resets second byte flag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);
    nrDevice.directSetRegValue(0x40, 0x1c);
    nrDevice.directSetRegValue(0x44, 0x20);
    const secondWriteBefore = pal.secondWrite;

    // --- Act
    nrDevice.directSetRegValue(0x43, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x1c);
    expect(pal.ulaFirst[0x1c]).toBe(0x40);
    expect(secondWriteBefore).toBe(true);
    expect(pal.secondWrite).toBe(false);
  });

  it("9-bit palette fill with ULA first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.ulaFirst[0x1f]).toBe(0x1ff); // Unchanged
    expect(pal.ulaFirst[0x20]).toBe(0x41);
    expect(pal.ulaFirst[0x21]).toBe(0x43);
    expect(pal.ulaFirst[0x22]).toBe(0x45);
    expect(pal.ulaFirst[0x23]).toBe(0x47);
    expect(pal.ulaFirst[0x24]).toBe(0x28); // Unchanged
  });

  it("9-bit palette fill with ULA second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x40);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.ulaSecond[0x1f]).toBe(0x1ff); // Unchanged
    expect(pal.ulaSecond[0x20]).toBe(0x41);
    expect(pal.ulaSecond[0x21]).toBe(0x43);
    expect(pal.ulaSecond[0x22]).toBe(0x45);
    expect(pal.ulaSecond[0x23]).toBe(0x47);
    expect(pal.ulaSecond[0x24]).toBe(0x28); // Unchanged
  });

  it("9-bit palette fill with Layer2 first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.layer2First[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.layer2First[0x20]).toBe(0x41);
    expect(pal.layer2First[0x21]).toBe(0x43);
    expect(pal.layer2First[0x22]).toBe(0x245);
    expect(pal.layer2First[0x23]).toBe(0x47);
    expect(pal.layer2First[0x24]).toBe(0x48); // Unchanged
  });

  it("9-bit palette fill with Layer2 second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x50);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.layer2Second[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.layer2Second[0x20]).toBe(0x41);
    expect(pal.layer2Second[0x21]).toBe(0x43);
    expect(pal.layer2Second[0x22]).toBe(0x245);
    expect(pal.layer2Second[0x23]).toBe(0x47);
    expect(pal.layer2Second[0x24]).toBe(0x48); // Unchanged
  });

  it("9-bit palette fill with sprite first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.spriteFirst[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.spriteFirst[0x20]).toBe(0x41);
    expect(pal.spriteFirst[0x21]).toBe(0x43);
    expect(pal.spriteFirst[0x22]).toBe(0x45);
    expect(pal.spriteFirst[0x23]).toBe(0x47);
    expect(pal.spriteFirst[0x24]).toBe(0x48); // Unchanged
  });

  it("9-bit palette fill with sprite second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x60);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.spriteSecond[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.spriteSecond[0x20]).toBe(0x41);
    expect(pal.spriteSecond[0x21]).toBe(0x43);
    expect(pal.spriteSecond[0x22]).toBe(0x45);
    expect(pal.spriteSecond[0x23]).toBe(0x47);
    expect(pal.spriteSecond[0x24]).toBe(0x48); // Unchanged
  });

  it("9-bit palette fill with tilemap first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x30);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.tilemapFirst[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.tilemapFirst[0x20]).toBe(0x41);
    expect(pal.tilemapFirst[0x21]).toBe(0x43);
    expect(pal.tilemapFirst[0x22]).toBe(0x45);
    expect(pal.tilemapFirst[0x23]).toBe(0x47);
    expect(pal.tilemapFirst[0x24]).toBe(0x48); // Unchanged
  });

  it("9-bit palette fill with tilemap second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x70);

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x21);
    nrDevice.directSetRegValue(0x44, 0x01);
    nrDevice.directSetRegValue(0x44, 0x22);
    nrDevice.directSetRegValue(0x44, 0x81);
    nrDevice.directSetRegValue(0x44, 0x23);
    nrDevice.directSetRegValue(0x44, 0x01);

    // --- Assert
    expect(pal.paletteIndex).toBe(0x24);
    expect(pal.tilemapSecond[0x1f]).toBe(0x3f); // Unchanged
    expect(pal.tilemapSecond[0x20]).toBe(0x41);
    expect(pal.tilemapSecond[0x21]).toBe(0x43);
    expect(pal.tilemapSecond[0x22]).toBe(0x45);
    expect(pal.tilemapSecond[0x23]).toBe(0x47);
    expect(pal.tilemapSecond[0x24]).toBe(0x48); // Unchanged
  });

  it("RGB333 arrays initialized on reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    const rgb333Value0 = pal.getUlaRgb333(0);
    const rgb333Value11 = pal.getUlaRgb333(11);

    // --- Assert
    // Default ULA color 0 is 0x000
    expect(rgb333Value0).toBe(0x000000);
    // Default ULA color 11 (bright magenta) is 0x1cf -> 0xff24ff
    expect(rgb333Value11).toBe(0x1cf);
  });

  it("RGB333 arrays updated via 8-bit palette write (ULA first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00); // Select ULA first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x10); // Set index to 0x10
    nrDevice.directSetRegValue(0x41, 0x20); // Write color value 0x20 -> regValue 0x40

    // --- Assert
    expect(pal.ulaFirst[0x10]).toBe(0x40);
    // Color 0x40 in RGB333 should be 0x240000
    expect(pal.getUlaRgb333(0x10)).toBe(0x40);
  });

  it("RGB333 arrays updated via 8-bit palette write (ULA second)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x42); // Select ULA second and enable secondUlaPalette

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x15); // Set index to 0x15
    nrDevice.directSetRegValue(0x41, 0x30); // Write color value 0x30 -> regValue 0x60

    // --- Assert
    expect(pal.ulaSecond[0x15]).toBe(0x60);
    // Color 0x60 in RGB333
    expect(pal.getUlaRgb333(0x15)).toBe(0x60);
  });

  it("RGB333 arrays updated via 9-bit palette write (ULA first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00); // Select ULA first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x08); // Set index to 0x08
    nrDevice.directSetRegValue(0x44, 0x80); // Write LSB
    nrDevice.directSetRegValue(0x44, 0x01); // Write MSB with bit 0 set

    // --- Assert
    expect(pal.ulaFirst[0x08]).toBe(0x101);
    // Color 0x101 in RGB333 should be 0x920024
    expect(pal.getUlaRgb333(0x08)).toBe(0x101);
  });

  it("RGB333 arrays updated via 9-bit palette write (ULA second)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x42); // Select ULA second and enable secondUlaPalette

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x0a); // Set index to 0x0a
    nrDevice.directSetRegValue(0x44, 0x50); // Write LSB
    nrDevice.directSetRegValue(0x44, 0x00); // Write MSB

    // --- Assert
    expect(pal.ulaSecond[0x0a]).toBe(0xa0);
    // Color 0xa0 in RGB333 should be 0x499200
    expect(pal.getUlaRgb333(0x0a)).toBe(0xa0);
  });

  it("getUlaRgb333 returns from first palette when secondUlaPalette is false", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;

    // Set different values in first and second palettes
    nrDevice.directSetRegValue(0x43, 0x00); // Select ULA first
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x41, 0x10); // regValue 0x20

    nrDevice.directSetRegValue(0x43, 0x40); // Select ULA second
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x41, 0x20); // regValue 0x40

    // --- Act
    nrDevice.directSetRegValue(0x43, 0x00); // secondUlaPalette = false

    // --- Assert
    expect(pal.getUlaRgb333(0x05)).toBe(0x20); // Color 0x20
  });

  it("getUlaRgb333 returns from second palette when secondUlaPalette is true", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;

    // Set different values in first and second palettes
    nrDevice.directSetRegValue(0x43, 0x00); // Select ULA first
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x41, 0x10); // regValue 0x20

    nrDevice.directSetRegValue(0x43, 0x40); // Select ULA second
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x41, 0x20); // regValue 0x40

    // --- Act
    nrDevice.directSetRegValue(0x43, 0x02); // secondUlaPalette = true

    // --- Assert
    expect(pal.getUlaRgb333(0x05)).toBe(0x40); // Color 0x40
  });

  it("getUlaRgb333 with index wrapping", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    const value256 = pal.getUlaRgb333(256);
    const value512 = pal.getUlaRgb333(512);
    const value0 = pal.getUlaRgb333(0);

    // --- Assert
    // All should return the same value (index 0)
    expect(value256).toBe(value0);
    expect(value512).toBe(value0);
  });

  it("Layer2 RGB333 arrays initialized on reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    const rgb333Value0 = pal.getLayer2Rgb333(0);
    const rgb333Value64 = pal.getLayer2Rgb333(64);

    // --- Assert
    // Default Layer2 color 0 is 0x000
    expect(rgb333Value0).toBe(0x000000);
    // Default Layer2 color 64 (0x40) is 0x80
    expect(rgb333Value64).toBe(0x80);
  });

  it("Layer2 RGB333 arrays updated via 8-bit palette write (first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Select Layer2 first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x10); // Set index to 0x10
    nrDevice.directSetRegValue(0x41, 0x20); // Write color value 0x20 -> regValue 0x40

    // --- Assert
    expect(pal.layer2First[0x10]).toBe(0x40);
    expect(pal.getLayer2Rgb333(0x10)).toBe(0x40);
  });

  it("Layer2 RGB333 arrays updated via 8-bit palette write (second)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x54); // Select Layer2 second and enable secondLayer2Palette

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x15); // Set index to 0x15
    nrDevice.directSetRegValue(0x41, 0x30); // Write color value 0x30 -> regValue 0x60

    // --- Assert
    expect(pal.layer2Second[0x15]).toBe(0x60);
    expect(pal.getLayer2Rgb333(0x15)).toBe(0x60);
  });

  it("Layer2 RGB333 arrays updated via 9-bit palette write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Select Layer2 first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x08); // Set index to 0x08
    nrDevice.directSetRegValue(0x44, 0x80); // Write LSB
    nrDevice.directSetRegValue(0x44, 0x81); // Write MSB with priority bit

    // --- Assert
    expect(pal.layer2First[0x08]).toBe(0x301); // Includes priority bit 0x200
    expect(pal.getLayer2Rgb333(0x08)).toBe(0x301); // Masked to 9-bit for RGB lookup
  });

  it("Sprite RGB333 arrays initialized on reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    const rgb333Value0 = pal.getSpriteRgb333(0);
    const rgb333Value32 = pal.getSpriteRgb333(32);

    // --- Assert
    expect(rgb333Value0).toBe(0x000000);
    expect(rgb333Value32).toBe(0x40);
  });

  it("Sprite RGB333 arrays updated via 8-bit palette write (first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // Select Sprite first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x12); // Set index to 0x12
    nrDevice.directSetRegValue(0x41, 0x25); // Write color value 0x25 -> regValue 0x4b

    // --- Assert
    expect(pal.spriteFirst[0x12]).toBe(0x4b);
    expect(pal.getSpriteRgb333(0x12)).toBe(0x4b);
  });

  it("Sprite RGB333 arrays updated via 8-bit palette write (second)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x68); // Select Sprite second and enable secondSpritePalette

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x20); // Set index to 0x20
    nrDevice.directSetRegValue(0x41, 0x40); // Write color value 0x40 -> regValue 0x80

    // --- Assert
    expect(pal.spriteSecond[0x20]).toBe(0x80);
    expect(pal.getSpriteRgb333(0x20)).toBe(0x80);
  });

  it("Sprite RGB333 arrays updated via 9-bit palette write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // Select Sprite first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x0c); // Set index to 0x0c
    nrDevice.directSetRegValue(0x44, 0xa0); // Write LSB
    nrDevice.directSetRegValue(0x44, 0x01); // Write MSB

    // --- Assert
    expect(pal.spriteFirst[0x0c]).toBe(0x141);
    expect(pal.getSpriteRgb333(0x0c)).toBe(0x141);
  });

  it("Tilemap RGB333 arrays initialized on reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    const rgb333Value0 = pal.getTilemapRgb333(0);
    const rgb333Value48 = pal.getTilemapRgb333(48);

    // --- Assert
    expect(rgb333Value0).toBe(0x000000);
    expect(rgb333Value48).toBe(0x60);
  });

  it("Tilemap RGB333 arrays updated via 8-bit palette write (first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x30); // Select Tilemap first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x18); // Set index to 0x18
    nrDevice.directSetRegValue(0x41, 0x35); // Write color value 0x35 -> regValue 0x6b

    // --- Assert
    expect(pal.tilemapFirst[0x18]).toBe(0x6b);
    expect(pal.getTilemapRgb333(0x18)).toBe(0x6b);
  });

  it("Tilemap RGB333 arrays updated via 8-bit palette write (second)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x70); // Select Tilemap second

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x2a); // Set index to 0x2a
    nrDevice.directSetRegValue(0x41, 0x50); // Write color value 0x50 -> regValue 0xa0

    // --- Assert
    expect(pal.tilemapSecond[0x2a]).toBe(0xa0);
    expect(pal.getTilemapRgb333(0x2a)).toBe(0x55);
  });

  it("Tilemap RGB333 arrays updated via 9-bit palette write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x30); // Select Tilemap first

    // --- Act
    nrDevice.directSetRegValue(0x40, 0x14); // Set index to 0x14
    nrDevice.directSetRegValue(0x44, 0xc0); // Write LSB
    nrDevice.directSetRegValue(0x44, 0x00); // Write MSB

    // --- Assert
    expect(pal.tilemapFirst[0x14]).toBe(0x180);
    expect(pal.getTilemapRgb333(0x14)).toBe(0x180);
  });

  it("getLayer2Rgb333 returns from correct palette based on secondLayer2Palette flag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;

    // Set different values in first and second palettes
    nrDevice.directSetRegValue(0x43, 0x10); // Select Layer2 first
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x41, 0x10); // regValue 0x20

    nrDevice.directSetRegValue(0x43, 0x50); // Select Layer2 second
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x41, 0x20); // regValue 0x40

    // --- Act & Assert with first palette
    nrDevice.directSetRegValue(0x43, 0x10); // secondLayer2Palette = false
    expect(pal.getLayer2Rgb333(0x05)).toBe(0x20);

    // --- Act & Assert with second palette
    nrDevice.directSetRegValue(0x43, 0x14); // secondLayer2Palette = true
    expect(pal.getLayer2Rgb333(0x05)).toBe(0x40);
  });

  it("getSpriteRgb333 returns from correct palette based on secondSpritePalette flag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;

    // Set different values in first and second palettes
    nrDevice.directSetRegValue(0x43, 0x20); // Select Sprite first
    nrDevice.directSetRegValue(0x40, 0x07);
    nrDevice.directSetRegValue(0x41, 0x18); // regValue 0x30

    nrDevice.directSetRegValue(0x43, 0x60); // Select Sprite second
    nrDevice.directSetRegValue(0x40, 0x07);
    nrDevice.directSetRegValue(0x41, 0x28); // regValue 0x50

    // --- Act & Assert with first palette
    nrDevice.directSetRegValue(0x43, 0x20); // secondSpritePalette = false
    expect(pal.getSpriteRgb333(0x07)).toBe(0x30);

    // --- Act & Assert with second palette
    nrDevice.directSetRegValue(0x43, 0x28); // secondSpritePalette = true
    expect(pal.getSpriteRgb333(0x07)).toBe(0x50);
  });

  it("All RGB333 getters handle index wrapping correctly", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const pal = m.paletteDevice;

    // --- Act
    const ula256 = pal.getUlaRgb333(256);
    const ula0 = pal.getUlaRgb333(0);
    const layer2_300 = pal.getLayer2Rgb333(300);
    const layer2_44 = pal.getLayer2Rgb333(44);
    const sprite512 = pal.getSpriteRgb333(512);
    const sprite0 = pal.getSpriteRgb333(0);
    const tilemap400 = pal.getTilemapRgb333(400);
    const tilemap144 = pal.getTilemapRgb333(144);

    // --- Assert
    expect(ula256).toBe(ula0);
    expect(layer2_300).toBe(layer2_44);
    expect(sprite512).toBe(sprite0);
    expect(tilemap400).toBe(tilemap144);
  });

  describe("Reg 0x40 - Palette Index", () => {
    it("write #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x40, 0x5a);

      // --- Assert
      expect(pal.paletteIndex).toBe(0x5a);
      expect(pal.secondWrite).toBe(false);
    });

    it("write #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x40, 0xa5);

      // --- Assert
      expect(pal.paletteIndex).toBe(0xa5);
    });
  });

  describe("Reg 0x43 - Palette control", () => {
    it("disablePaletteWriteAutoInc", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x80);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x80);
      expect(pal.disablePaletteWriteAutoInc).toBe(true);
      expect(pal.selectedPalette).toBe(0x00);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x00);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x00);
      expect(pal.getCurrentPalette()).toBe(pal.ulaFirst);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x00);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x10);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x10);
      expect(pal.getCurrentPalette()).toBe(pal.layer2First);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x01);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x20);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x20);
      expect(pal.getCurrentPalette()).toBe(pal.spriteFirst);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x02);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #4", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x30);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x30);
      expect(pal.getCurrentPalette()).toBe(pal.tilemapFirst);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x03);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #5", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x40);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x40);
      expect(pal.getCurrentPalette()).toBe(pal.ulaSecond);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x04);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #6", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x50);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x50);
      expect(pal.getCurrentPalette()).toBe(pal.layer2Second);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x05);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #7", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x60);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x60);
      expect(pal.getCurrentPalette()).toBe(pal.spriteSecond);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x06);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("selectedPalette #8", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x70);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x70);
      expect(pal.getCurrentPalette()).toBe(pal.tilemapSecond);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x07);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("secondSpritePalette", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x08);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x08);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x00);
      expect(pal.secondSpritePalette).toBe(true);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("secondLayer2Palette", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x04);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x04);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x00);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(true);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("secondUlaPalette", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x02);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x02);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x00);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(true);
      expect(pal.enableUlaNextMode).toBe(false);
      expect(pal.secondWrite).toBe(false);
    });

    it("enableUlaNextMode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pal = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x43, 0x01);

      // --- Assert
      expect(readNextReg(m, 0x43)).toBe(0x01);
      expect(pal.disablePaletteWriteAutoInc).toBe(false);
      expect(pal.selectedPalette).toBe(0x00);
      expect(pal.secondSpritePalette).toBe(false);
      expect(pal.secondLayer2Palette).toBe(false);
      expect(pal.secondUlaPalette).toBe(false);
      expect(pal.enableUlaNextMode).toBe(true);
      expect(pal.secondWrite).toBe(false);
    });
  });

  describe("Reg 0x6b - Tilemap controls", () => {
    it("paletteSelect", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const paletteDevice = m.paletteDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x10);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x10);
      expect(paletteDevice.secondTilemapPalette).toBe(true);
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
