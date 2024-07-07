import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

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
    nrDevice.directSetRegValue(0x43, 0x00)

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
    expect(pal.ulaFirst[0x21]).toBe(0x42);
    expect(pal.ulaFirst[0x22]).toBe(0x44);
    expect(pal.ulaFirst[0x23]).toBe(0x46);
    expect(pal.ulaFirst[0x24]).toBe(0x28); // Unchanged
  });

  it("8-bit palette fill with ULA second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x40)

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
    expect(pal.ulaSecond[0x21]).toBe(0x42);
    expect(pal.ulaSecond[0x22]).toBe(0x44);
    expect(pal.ulaSecond[0x23]).toBe(0x46);
    expect(pal.ulaSecond[0x24]).toBe(0x28); // Unchanged
  });

  it("8-bit palette fill with Layer 2 first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10)

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
    expect(pal.layer2First[0x21]).toBe(0x42);
    expect(pal.layer2First[0x22]).toBe(0x44);
    expect(pal.layer2First[0x23]).toBe(0x46);
    expect(pal.layer2First[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with Layer 2 second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x50)

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
    expect(pal.layer2Second[0x21]).toBe(0x42);
    expect(pal.layer2Second[0x22]).toBe(0x44);
    expect(pal.layer2Second[0x23]).toBe(0x46);
    expect(pal.layer2Second[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with sprite first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20)

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
    expect(pal.spriteFirst[0x21]).toBe(0x42);
    expect(pal.spriteFirst[0x22]).toBe(0x44);
    expect(pal.spriteFirst[0x23]).toBe(0x46);
    expect(pal.spriteFirst[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with sprite second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x60)

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
    expect(pal.spriteSecond[0x21]).toBe(0x42);
    expect(pal.spriteSecond[0x22]).toBe(0x44);
    expect(pal.spriteSecond[0x23]).toBe(0x46);
    expect(pal.spriteSecond[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with tilemap first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x30)

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
    expect(pal.tilemapFirst[0x21]).toBe(0x42);
    expect(pal.tilemapFirst[0x22]).toBe(0x44);
    expect(pal.tilemapFirst[0x23]).toBe(0x46);
    expect(pal.tilemapFirst[0x24]).toBe(0x48); // Unchanged
  });

  it("8-bit palette fill with tilemap second", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x70)

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
    expect(pal.tilemapSecond[0x21]).toBe(0x42);
    expect(pal.tilemapSecond[0x22]).toBe(0x44);
    expect(pal.tilemapSecond[0x23]).toBe(0x46);
    expect(pal.tilemapSecond[0x24]).toBe(0x48); // Unchanged
  });

  it("Setting LSB of 9-bit palette value", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00)
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
    nrDevice.directSetRegValue(0x43, 0x00)
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
    nrDevice.directSetRegValue(0x43, 0x00)
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
    nrDevice.directSetRegValue(0x43, 0x00)
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
    nrDevice.directSetRegValue(0x43, 0x00)
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
    nrDevice.directSetRegValue(0x43, 0x00)
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
    nrDevice.directSetRegValue(0x43, 0x10)
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
    nrDevice.directSetRegValue(0x43, 0x10)
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
    nrDevice.directSetRegValue(0x43, 0x10)
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
    nrDevice.directSetRegValue(0x43, 0x10)
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

});