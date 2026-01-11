import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Unit tests for SpriteDevice status register (Port 0x303B) behavior
 * 
 * Tests cover:
 * - Sticky behavior (flags persist until read)
 * - Read-to-clear behavior (auto-clear on read)
 * - Write immunity (writes don't clear flags)
 * - Flag accumulation (multiple sets before read)
 * - Flag independence (collision vs overflow)
 * - Frame-level persistence
 */

describe("SpriteDevice - Status Register Sticky Behavior", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Collision Flag Sticky Behavior", () => {
    it("should keep collision flag set through sprite attribute writes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Perform multiple sprite attribute writes
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x23); // X
      io.writePort(0x3257, 0x45); // Y
      io.writePort(0x3357, 0xa0); // Attr2
      io.writePort(0x3457, 0x80); // Attr3 (visible)

      // --- Assert: Collision flag should still be set
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Act: Read status
      const value = io.readPort(0x303b);

      // --- Assert: Bit 0 should be set, flag should now be cleared
      expect(!!(value & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
    });

    it("should keep collision flag set through pattern writes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Write multiple pattern bytes
      io.writePort(0x303b, 0x80); // Set pattern subindex
      for (let i = 0; i < 16; i++) {
        io.writePort(0x5b, i);
      }

      // --- Assert: Collision flag should still be set
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Act: Read status
      const value = io.readPort(0x303b);

      // --- Assert: Bit 0 should be set, flag should now be cleared
      expect(!!(value & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
    });

    it("should keep collision flag set through sprite index changes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Change sprite index multiple times
      io.writePort(0x303b, 0x10);
      io.writePort(0x303b, 0x20);
      io.writePort(0x303b, 0x30);

      // --- Assert: Collision flag should still be set
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Act: Read status
      const value = io.readPort(0x303b);

      // --- Assert: Bit 0 should be set
      expect(!!(value & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
    });

    it("should keep collision flag set through NextReg writes", async () => {
      const spriteDevice = machine.spriteDevice;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Write to various NextRegs
      writeNextReg(machine, 0x15, 0x82); // Sprite control
      writeNextReg(machine, 0x19, 0x10); // Clip window
      writeNextReg(machine, 0x4b, 0xe3); // Transparent color

      // --- Assert: Collision flag should still be set
      expect(spriteDevice.collisionDetected).toBe(true);
    });
  });

  describe("Overflow Flag Sticky Behavior", () => {
    it("should keep overflow flag set through sprite attribute writes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set overflow flag
      spriteDevice.tooManySpritesPerLine = true;

      // --- Perform multiple sprite attribute writes
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x23);
      io.writePort(0x3257, 0x45);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x80);

      // --- Assert: Overflow flag should still be set
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Act: Read status
      const value = io.readPort(0x303b);

      // --- Assert: Bit 1 should be set, flag should now be cleared
      expect(!!(value & 0x02)).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });

    it("should keep overflow flag set through pattern writes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set overflow flag
      spriteDevice.tooManySpritesPerLine = true;

      // --- Write multiple pattern bytes
      io.writePort(0x303b, 0x80);
      for (let i = 0; i < 16; i++) {
        io.writePort(0x5b, i);
      }

      // --- Assert: Overflow flag should still be set
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Act: Read status
      const value = io.readPort(0x303b);

      // --- Assert: Bit 1 should be set
      expect(!!(value & 0x02)).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });
  });

  describe("Both Flags Sticky Behavior", () => {
    it("should keep both flags set through multiple operations", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Perform various operations
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x23);
      io.writePort(0x303b, 0x80);
      io.writePort(0x5b, 0xAA);
      writeNextReg(machine, 0x15, 0x82);

      // --- Assert: Both flags should still be set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Act: Read status
      const value = io.readPort(0x303b);

      // --- Assert: Both bits should be set, both flags should now be cleared
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });
  });
});

describe("SpriteDevice - Status Register Read-to-Clear", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Single Read Clears Flags", () => {
    it("should clear collision flag after first read", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Act: First read
      const value1 = io.readPort(0x303b);

      // --- Assert: First read returns flag set, then clears it
      expect(!!(value1 & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
    });

    it("should clear overflow flag after first read", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set overflow flag
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: First read
      const value1 = io.readPort(0x303b);

      // --- Assert: First read returns flag set, then clears it
      expect(!!(value1 & 0x02)).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });

    it("should clear both flags after first read", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: First read
      const value1 = io.readPort(0x303b);

      // --- Assert: First read returns both flags set, then clears both
      expect(!!(value1 & 0x01)).toBe(true);
      expect(!!(value1 & 0x02)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });
  });

  describe("Multiple Reads Return Zero After First", () => {
    it("should return 0 on second read of collision flag", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Act: First read
      const value1 = io.readPort(0x303b);
      expect(!!(value1 & 0x01)).toBe(true);

      // --- Act: Second read immediately after
      const value2 = io.readPort(0x303b);

      // --- Assert: Second read should return 0
      expect(!!(value2 & 0x01)).toBe(false);
      expect(!!(value2 & 0x02)).toBe(false);
    });

    it("should return 0 on second read of overflow flag", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set overflow flag
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: First read
      const value1 = io.readPort(0x303b);
      expect(!!(value1 & 0x02)).toBe(true);

      // --- Act: Second read immediately after
      const value2 = io.readPort(0x303b);

      // --- Assert: Second read should return 0
      expect(!!(value2 & 0x01)).toBe(false);
      expect(!!(value2 & 0x02)).toBe(false);
    });

    it("should return 0 on third and subsequent reads", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: First read clears flags
      const value1 = io.readPort(0x303b);
      expect(value1 & 0x03).toBe(0x03);

      // --- Act: Multiple subsequent reads
      const value2 = io.readPort(0x303b);
      const value3 = io.readPort(0x303b);
      const value4 = io.readPort(0x303b);

      // --- Assert: All should return 0
      expect(value2 & 0x03).toBe(0);
      expect(value3 & 0x03).toBe(0);
      expect(value4 & 0x03).toBe(0);
    });

    it("should return flag again after re-setting between reads", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Act: First read clears it
      const value1 = io.readPort(0x303b);
      expect(!!(value1 & 0x01)).toBe(true);

      // --- Second read returns 0
      const value2 = io.readPort(0x303b);
      expect(!!(value2 & 0x01)).toBe(false);

      // --- Set flag again
      spriteDevice.collisionDetected = true;

      // --- Act: Third read should see the flag again
      const value3 = io.readPort(0x303b);
      expect(!!(value3 & 0x01)).toBe(true);

      // --- Fourth read returns 0 again
      const value4 = io.readPort(0x303b);
      expect(!!(value4 & 0x01)).toBe(false);
    });
  });
});

describe("SpriteDevice - Status Register Write Immunity", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Writes to Port 0x303B Don't Clear Flags", () => {
    it("should NOT clear collision flag when writing sprite index", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Act: Write to port 0x303b (sets sprite/pattern index)
      io.writePort(0x303b, 0x10);
      io.writePort(0x303b, 0x20);
      io.writePort(0x303b, 0x30);

      // --- Assert: Collision flag should still be set
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Verify by reading
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(true);
    });

    it("should NOT clear overflow flag when writing sprite index", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set overflow flag
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: Write to port 0x303b
      io.writePort(0x303b, 0x80);
      io.writePort(0x303b, 0x40);

      // --- Assert: Overflow flag should still be set
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Verify by reading
      const value = io.readPort(0x303b);
      expect(!!(value & 0x02)).toBe(true);
    });

    it("should NOT clear both flags when writing sprite index", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: Write to port 0x303b multiple times
      io.writePort(0x303b, 0x00);
      io.writePort(0x303b, 0xFF);
      io.writePort(0x303b, 0x7F);

      // --- Assert: Both flags should still be set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Verify by reading
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(true);
    });
  });

  describe("Other Port Writes Don't Clear Flags", () => {
    it("should NOT clear flags when writing sprite attributes (port 0x57)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: Write sprite attributes
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x23);
      io.writePort(0x3257, 0x45);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x80);

      // --- Assert: Both flags should still be set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);
    });

    it("should NOT clear flags when writing patterns (port 0x5b)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: Write pattern data
      io.writePort(0x303b, 0x80);
      for (let i = 0; i < 32; i++) {
        io.writePort(0x5b, i);
      }

      // --- Assert: Both flags should still be set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);
    });
  });
});

describe("SpriteDevice - Status Flag Accumulation", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Multiple Sets Before Read", () => {
    it("should handle collision flag set multiple times", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Act: Set flag multiple times
      spriteDevice.collisionDetected = true;
      spriteDevice.collisionDetected = true;
      spriteDevice.collisionDetected = true;

      // --- Assert: Flag should be set
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Act: Single read should clear it
      const value = io.readPort(0x303b);

      // --- Assert: Flag returned, then cleared
      expect(!!(value & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);

      // --- Second read returns 0
      const value2 = io.readPort(0x303b);
      expect(!!(value2 & 0x01)).toBe(false);
    });

    it("should handle overflow flag set multiple times", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Act: Set flag multiple times
      spriteDevice.tooManySpritesPerLine = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Assert: Flag should be set
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Act: Single read should clear it
      const value = io.readPort(0x303b);

      // --- Assert: Flag returned, then cleared
      expect(!!(value & 0x02)).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });

    it("should handle alternating collision and overflow sets", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Act: Set flags in alternating pattern
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Assert: Both flags should be set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Act: Single read clears both
      const value = io.readPort(0x303b);

      // --- Assert: Both flags returned, then cleared
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });
  });

  describe("Set, Clear, Set Pattern", () => {
    it("should handle collision flag toggling", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision
      spriteDevice.collisionDetected = true;
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Clear via read
      const value1 = io.readPort(0x303b);
      expect(!!(value1 & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);

      // --- Verify cleared
      const value2 = io.readPort(0x303b);
      expect(!!(value2 & 0x01)).toBe(false);

      // --- Set again
      spriteDevice.collisionDetected = true;
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Clear again
      const value3 = io.readPort(0x303b);
      expect(!!(value3 & 0x01)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
    });
  });
});

describe("SpriteDevice - Status Flag Independence", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Collision and Overflow Are Independent", () => {
    it("should set collision without affecting overflow", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Initially both clear
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);

      // --- Act: Set only collision
      spriteDevice.collisionDetected = true;

      // --- Assert: Only collision set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);

      // --- Verify via read
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(false);
    });

    it("should set overflow without affecting collision", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Act: Set only overflow
      spriteDevice.tooManySpritesPerLine = true;

      // --- Assert: Only overflow set
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Verify via read
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(false);
      expect(!!(value & 0x02)).toBe(true);
    });

    it("should clear both flags independently via read (even though hardware clears both)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Act: Single read clears BOTH (hardware behavior)
      const value = io.readPort(0x303b);

      // --- Assert: Both were returned, both now cleared
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(true);
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);
    });

    it("should allow setting one flag after clearing both", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Read to clear both
      io.readPort(0x303b);
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);

      // --- Set only collision
      spriteDevice.collisionDetected = true;

      // --- Assert: Only collision set
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(false);
    });

    it("should handle interleaved flag operations", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision
      spriteDevice.collisionDetected = true;

      // --- Read (clears both, but only collision was set)
      const value1 = io.readPort(0x303b);
      expect(!!(value1 & 0x01)).toBe(true);
      expect(!!(value1 & 0x02)).toBe(false);

      // --- Set overflow
      spriteDevice.tooManySpritesPerLine = true;

      // --- Read (should see overflow only)
      const value2 = io.readPort(0x303b);
      expect(!!(value2 & 0x01)).toBe(false);
      expect(!!(value2 & 0x02)).toBe(true);

      // --- Set both
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Read (should see both)
      const value3 = io.readPort(0x303b);
      expect(!!(value3 & 0x01)).toBe(true);
      expect(!!(value3 & 0x02)).toBe(true);
    });
  });
});

describe("SpriteDevice - Status Flag Frame-Level Persistence", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Flags Persist Across Multiple Sprite Operations", () => {
    it("should keep collision flag through complete sprite definition sequence", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set collision flag
      spriteDevice.collisionDetected = true;

      // --- Define sprite 0 completely
      io.writePort(0x303b, 0x00); // Select sprite 0
      io.writePort(0x3157, 0x10); // X
      io.writePort(0x3257, 0x20); // Y
      io.writePort(0x3357, 0xa0); // Attr2
      io.writePort(0x3457, 0xc0); // Attr3 (visible, 5-byte)
      io.writePort(0x3557, 0x00); // Attr4

      // --- Define sprite 1
      io.writePort(0x303b, 0x01);
      io.writePort(0x3157, 0x30);
      io.writePort(0x3257, 0x40);
      io.writePort(0x3357, 0xb0);
      io.writePort(0x3457, 0x80);

      // --- Assert: Collision flag should still be set
      expect(spriteDevice.collisionDetected).toBe(true);

      // --- Read should return flag
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(true);
    });

    it("should keep overflow flag through pattern memory writes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set overflow flag
      spriteDevice.tooManySpritesPerLine = true;

      // --- Write complete pattern 0 (256 bytes)
      io.writePort(0x303b, 0x00);
      for (let i = 0; i < 256; i++) {
        io.writePort(0x5b, i & 0xFF);
      }

      // --- Assert: Overflow flag should still be set
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Read should return flag
      const value = io.readPort(0x303b);
      expect(!!(value & 0x02)).toBe(true);
    });

    it("should keep both flags through mixed sprite/pattern operations", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Mixed operations: sprites, patterns, config
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);

      writeNextReg(machine, 0x15, 0x82); // Sprite control

      io.writePort(0x303b, 0x80);
      io.writePort(0x5b, 0xAA);
      io.writePort(0x5b, 0xBB);

      io.writePort(0x303b, 0x01);
      io.writePort(0x3157, 0x30);

      writeNextReg(machine, 0x4b, 0xe3); // Transparent color

      // --- Assert: Both flags should still be set
      expect(spriteDevice.collisionDetected).toBe(true);
      expect(spriteDevice.tooManySpritesPerLine).toBe(true);

      // --- Read should return both
      const value = io.readPort(0x303b);
      expect(!!(value & 0x01)).toBe(true);
      expect(!!(value & 0x02)).toBe(true);
    });
  });

  describe("Flags Reset to Zero After Read", () => {
    it("should not spontaneously re-set flags after clear", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set both flags
      spriteDevice.collisionDetected = true;
      spriteDevice.tooManySpritesPerLine = true;

      // --- Read to clear
      const value1 = io.readPort(0x303b);
      expect(value1 & 0x03).toBe(0x03);

      // --- Perform various operations
      io.writePort(0x303b, 0x05);
      io.writePort(0x3157, 0xFF);
      io.writePort(0x303b, 0x80);
      io.writePort(0x5b, 0x11);

      // --- Assert: Flags should remain clear
      expect(spriteDevice.collisionDetected).toBe(false);
      expect(spriteDevice.tooManySpritesPerLine).toBe(false);

      // --- Read should return 0
      const value2 = io.readPort(0x303b);
      expect(value2 & 0x03).toBe(0);
    });
  });
});

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}
