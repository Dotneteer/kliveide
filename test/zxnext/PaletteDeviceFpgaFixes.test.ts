import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("Next - PaletteDevice FPGA fixes (P1-P4)", async function () {
  // ---------------------------------------------------------------------------
  // P4: NR 0x41 write must NOT update storedPaletteValue (NR 0x28)
  // ---------------------------------------------------------------------------

  it("P4: NR 0x41 write does not change storedPaletteValue", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x00); // ULA first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act: NR 0x44 first byte sets storedPaletteValue
    nrDevice.directSetRegValue(0x44, 0x55);
    const afterFirstNr44 = nrDevice.directGetRegValue(0x28);

    // NR 0x41 write must NOT update storedPaletteValue
    nrDevice.directSetRegValue(0x41, 0xab);
    const afterNr41 = nrDevice.directGetRegValue(0x28);

    // --- Assert
    expect(afterFirstNr44).toBe(0x55);
    expect(afterNr41).toBe(0x55); // storedPaletteValue unchanged by NR 0x41 write
  });

  it("P4: NR 0x41 write does not affect storedPaletteValue (Layer 2 first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Layer 2 first
    nrDevice.directSetRegValue(0x40, 0x20);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x33);
    nrDevice.directSetRegValue(0x41, 0x77);

    // --- Assert
    expect(nrDevice.directGetRegValue(0x28)).toBe(0x33);
  });

  // ---------------------------------------------------------------------------
  // P3: NR 0x44 second byte must NOT update storedPaletteValue (NR 0x28)
  // ---------------------------------------------------------------------------

  it("P3: NR 0x44 second write does not change storedPaletteValue", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Layer 2 first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x20); // first byte → storedPaletteValue = 0x20
    const afterFirst = nrDevice.directGetRegValue(0x28);

    nrDevice.directSetRegValue(0x44, 0x81); // second byte → must NOT change storedPaletteValue
    const afterSecond = nrDevice.directGetRegValue(0x28);

    // --- Assert
    expect(afterFirst).toBe(0x20);
    expect(afterSecond).toBe(0x20);
  });

  it("P3: storedPaletteValue reflects only first-byte of each NR 0x44 write pair", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // sprite first
    nrDevice.directSetRegValue(0x40, 0x00);

    // --- Act: write two consecutive entries
    nrDevice.directSetRegValue(0x44, 0x10); // pair 1 first byte → stored = 0x10
    nrDevice.directSetRegValue(0x44, 0x01); // pair 1 second byte → stored stays 0x10
    nrDevice.directSetRegValue(0x44, 0x30); // pair 2 first byte → stored = 0x30
    nrDevice.directSetRegValue(0x44, 0x81); // pair 2 second byte → stored stays 0x30
    const stored = nrDevice.directGetRegValue(0x28);

    // --- Assert
    expect(stored).toBe(0x30); // last first-byte written
  });

  // ---------------------------------------------------------------------------
  // P1: NR 0x44 read must return priority bits [7:6] from palette entry
  // ---------------------------------------------------------------------------

  it("P1: NR 0x44 read returns priority bit 7 for Layer 2 first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Layer 2 first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act: write 9-bit value with priority (second byte bit 7 set, bit 0 set)
    nrDevice.directSetRegValue(0x44, 0x20); // first byte → bits [8:1] = 0x40
    nrDevice.directSetRegValue(0x44, 0x81); // second byte: bit7=priority, bit0=color-lsb

    nrDevice.directSetRegValue(0x40, 0x10); // reset index to read same entry
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert: readback = {priority[1], priority[0], "00000", color[0]}
    //   bit7 = priority MSB = 1, bit0 = color LSB = 1, bits[6:1] = 0
    expect(readback).toBe(0x81);
  });

  it("P1: NR 0x44 read returns priority bit 7 for sprite first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // sprite first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x81);

    nrDevice.directSetRegValue(0x40, 0x10);
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert
    expect(readback).toBe(0x81);
  });

  it("P1: NR 0x44 read returns priority bit 7 for ULA first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x00); // ULA first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x81);

    nrDevice.directSetRegValue(0x40, 0x10);
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert
    expect(readback).toBe(0x81);
  });

  it("P1: NR 0x44 read returns priority bit 7 for tilemap first", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x30); // tilemap first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x81);

    nrDevice.directSetRegValue(0x40, 0x10);
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert
    expect(readback).toBe(0x81);
  });

  it("P1: NR 0x44 read returns 0x01 when priority bit not set (color lsb only)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Layer 2 first
    nrDevice.directSetRegValue(0x40, 0x10);

    // --- Act: second byte bit7=0 (no priority), bit0=1 (color lsb)
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01);

    nrDevice.directSetRegValue(0x40, 0x10);
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert
    expect(readback).toBe(0x01);
  });

  it("P1: NR 0x44 read returns 0x80 when priority set but color lsb is 0", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // sprite first
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act: first byte 0x20, second byte 0x80 (priority only, bit0=0)
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x80);

    nrDevice.directSetRegValue(0x40, 0x08);
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert: bit7=1 (priority), bit0=0
    expect(readback).toBe(0x80);
  });

  it("P1: NR 0x44 read clears priority bit when re-written without priority", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // sprite first

    // Write with priority
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x81); // priority set

    // Write same index without priority
    nrDevice.directSetRegValue(0x40, 0x05);
    nrDevice.directSetRegValue(0x44, 0x20);
    nrDevice.directSetRegValue(0x44, 0x01); // priority NOT set

    nrDevice.directSetRegValue(0x40, 0x05);
    const readback = nrDevice.directGetRegValue(0x44);

    // --- Assert: priority cleared → bit7=0
    expect(readback).toBe(0x01);
  });

  // ---------------------------------------------------------------------------
  // P2: Priority bit stored in internal palette entry for ALL palette types
  // ---------------------------------------------------------------------------

  it("P2: Priority bit (0x200) stored for sprite first palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // sprite first
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act: write 9-bit value with priority
    nrDevice.directSetRegValue(0x44, 0x30); // first: bits[8:1] = 0x60
    nrDevice.directSetRegValue(0x44, 0x81); // second: priority=1, lsb=1

    // --- Assert: internal entry = 0x60 | 0x01 | 0x200 = 0x261
    expect(pal.spriteFirst[0x08] & 0x200).toBe(0x200);
    expect(pal.spriteFirst[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Priority bit (0x200) stored for sprite second palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x60); // sprite second
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.spriteSecond[0x08] & 0x200).toBe(0x200);
    expect(pal.spriteSecond[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Priority bit (0x200) stored for ULA first palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x00); // ULA first
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.ulaFirst[0x08] & 0x200).toBe(0x200);
    expect(pal.ulaFirst[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Priority bit (0x200) stored for ULA second palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x40); // ULA second
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.ulaSecond[0x08] & 0x200).toBe(0x200);
    expect(pal.ulaSecond[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Priority bit (0x200) stored for tilemap first palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x30); // tilemap first
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.tilemapFirst[0x08] & 0x200).toBe(0x200);
    expect(pal.tilemapFirst[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Priority bit (0x200) stored for tilemap second palette", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x70); // tilemap second
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.tilemapSecond[0x08] & 0x200).toBe(0x200);
    expect(pal.tilemapSecond[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Priority bit cleared when second byte bit 7 is 0 (sprite first)", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x20); // sprite first

    // First write: with priority
    nrDevice.directSetRegValue(0x40, 0x08);
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81); // priority set
    expect(pal.spriteFirst[0x08] & 0x200).toBe(0x200);

    // Second write to same index: without priority
    nrDevice.directSetRegValue(0x40, 0x08);
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x01); // priority NOT set

    // --- Assert: priority cleared
    expect(pal.spriteFirst[0x08] & 0x200).toBe(0);
    expect(pal.spriteFirst[0x08] & 0x1ff).toBe(0x61);
  });

  it("P2: Layer 2 first palette priority still stored correctly", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pal = m.paletteDevice;
    nrDevice.directSetRegValue(0x43, 0x10); // Layer 2 first
    nrDevice.directSetRegValue(0x40, 0x08);

    // --- Act
    nrDevice.directSetRegValue(0x44, 0x30);
    nrDevice.directSetRegValue(0x44, 0x81);

    // --- Assert
    expect(pal.layer2First[0x08] & 0x200).toBe(0x200);
    expect(pal.layer2First[0x08] & 0x1ff).toBe(0x61);
  });
});
