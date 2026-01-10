import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Unit tests for SpriteDevice sprite index management
 * 
 * Tests cover:
 * - Sprite index wrapping at 128
 * - lastVisibleSpriteIndex tracking
 * - Sprite index auto-increment behavior
 */

describe("SpriteDevice - Sprite Index Management", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Sprite Index Wrapping at 128", () => {
    it("should wrap sprite index from 127 to 0 when writing 5th attribute byte via port 0x57", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set sprite index to 127
      io.writePort(0x303b, 127);
      expect(spriteDevice.spriteIndex).toBe(127);

      // --- Write 5 attribute bytes for sprite 127
      io.writePort(0x3157, 0x10); // X LSB
      io.writePort(0x3257, 0x20); // Y LSB
      io.writePort(0x3357, 0xa0); // Attr2
      io.writePort(0x3457, 0x40); // Attr3 (has5AttributeBytes = 1)
      
      // --- Act: Write 5th byte, should auto-increment and wrap
      io.writePort(0x3557, 0x00); // Attr4

      // --- Assert: Index should wrap to 0
      expect(spriteDevice.spriteIndex).toBe(0);
      expect(spriteDevice.spriteSubIndex).toBe(0);
    });

    it("should wrap sprite index from 127 to 0 when writing 4th attribute byte via port 0x57", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set sprite index to 127
      io.writePort(0x303b, 127);

      // --- Write 4 attribute bytes for sprite 127 (no 5th byte)
      io.writePort(0x3157, 0x10); // X LSB
      io.writePort(0x3257, 0x20); // Y LSB
      io.writePort(0x3357, 0xa0); // Attr2
      
      // --- Act: Write 4th byte without has5AttributeBytes, should auto-increment and wrap
      io.writePort(0x3457, 0x00); // Attr3 (has5AttributeBytes = 0)

      // --- Assert: Index should wrap to 0
      expect(spriteDevice.spriteIndex).toBe(0);
      expect(spriteDevice.spriteSubIndex).toBe(0);
    });

    it("should keep sprite index at 127 when not all bytes are written", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set sprite index to 127
      io.writePort(0x303b, 127);

      // --- Write only 3 attribute bytes
      io.writePort(0x3157, 0x10); // X LSB
      io.writePort(0x3257, 0x20); // Y LSB
      io.writePort(0x3357, 0xa0); // Attr2

      // --- Assert: Index should still be 127, subindex at 3
      expect(spriteDevice.spriteIndex).toBe(127);
      expect(spriteDevice.spriteSubIndex).toBe(3);
    });

    it("should handle multiple sprites near the wrap boundary", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set sprite index to 126
      io.writePort(0x303b, 126);

      // --- Write sprite 126 (4 bytes)
      io.writePort(0x3157, 0x11);
      io.writePort(0x3257, 0x22);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x00);

      expect(spriteDevice.spriteIndex).toBe(127);

      // --- Write sprite 127 (4 bytes)
      io.writePort(0x3157, 0x33);
      io.writePort(0x3257, 0x44);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x00);

      // --- Assert: Should have wrapped to 0
      expect(spriteDevice.spriteIndex).toBe(0);

      // --- Verify sprite data was stored correctly
      const sprite126 = spriteDevice.spriteMemory[126];
      expect(sprite126.x).toBe(0x11);
      expect(sprite126.y).toBe(0x22);

      const sprite127 = spriteDevice.spriteMemory[127];
      expect(sprite127.x).toBe(0x33);
      expect(sprite127.y).toBe(0x44);
    });

    it("should allow setting sprite index to 127 and beyond via NextReg writes", async () => {
      const spriteDevice = machine.spriteDevice;
      
      // --- Enable lockstep mode via NextReg 0x09 bit 4
      writeNextReg(machine, 0x09, 0x10); // Set sprite ID lockstep bit
      expect(spriteDevice.spriteIdLockstep).toBe(true);

      // --- Set sprite index to 127 via NextReg 0x34 (in lockstep, this writes to port 0x303b)
      writeNextReg(machine, 0x34, 127);
      expect(spriteDevice.spriteIndex).toBe(127);

      // --- Write attributes via NextReg
      writeNextReg(machine, 0x35, 0x50); // X LSB 
      writeNextReg(machine, 0x36, 0x60); // Y LSB

      // --- Verify sprite 127 received the values
      const sprite127 = spriteDevice.spriteMemory[127];
      expect(sprite127.x & 0xFF).toBe(0x50);
      expect(sprite127.y).toBe(0x60);
    });
  });

  describe("Sprite Index via Port 0x303B", () => {
    it("should mask sprite index to 7 bits when writing to port 0x303B", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Act: Write value with bit 7 set (should be masked out for sprite index)
      io.writePort(0x303b, 0xFF);

      // --- Assert: Sprite index should be 0x7F (127), not 0xFF
      expect(spriteDevice.spriteIndex).toBe(0x7F);
      expect(spriteDevice.spriteSubIndex).toBe(0);
    });

    it("should allow setting any sprite index from 0 to 127", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      const testIndices = [0, 1, 63, 64, 126, 127];

      for (const idx of testIndices) {
        io.writePort(0x303b, idx);
        expect(spriteDevice.spriteIndex).toBe(idx);
      }
    });
  });

  describe("lastVisibleSpriteIndex Tracking", () => {
    it("should initialize lastVisibleSpriteIndex to -1", async () => {
      const spriteDevice = machine.spriteDevice;
      expect(spriteDevice.lastVisibileSpriteIndex).toBe(-1);
    });

    it("should not modify lastVisibleSpriteIndex when writing sprite attributes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Write sprite 0 attributes
      io.writePort(0x303b, 0);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x00);

      // --- Assert: lastVisibleSpriteIndex is still -1 (only renderer should modify it)
      expect(spriteDevice.lastVisibileSpriteIndex).toBe(-1);
    });

    it("should preserve lastVisibleSpriteIndex value across sprite writes", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Manually set lastVisibleSpriteIndex (simulating renderer behavior)
      spriteDevice.lastVisibileSpriteIndex = 42;

      // --- Write some sprites
      io.writePort(0x303b, 10);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x00);

      // --- Assert: lastVisibleSpriteIndex should remain unchanged
      expect(spriteDevice.lastVisibileSpriteIndex).toBe(42);
    });

    it("should allow setting lastVisibleSpriteIndex to any value 0-127", async () => {
      const spriteDevice = machine.spriteDevice;

      const testIndices = [-1, 0, 1, 63, 64, 126, 127];

      for (const idx of testIndices) {
        spriteDevice.lastVisibileSpriteIndex = idx;
        expect(spriteDevice.lastVisibileSpriteIndex).toBe(idx);
      }
    });

    it("should maintain lastVisibleSpriteIndex separately from spriteIndex", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set different values
      spriteDevice.lastVisibileSpriteIndex = 50;
      io.writePort(0x303b, 25);

      // --- Assert: Both maintain their own values
      expect(spriteDevice.lastVisibileSpriteIndex).toBe(50);
      expect(spriteDevice.spriteIndex).toBe(25);
    });

    it("should reset lastVisibleSpriteIndex to -1 on device reset", async () => {
      const spriteDevice = machine.spriteDevice;

      // --- Set lastVisibleSpriteIndex to a value
      spriteDevice.lastVisibileSpriteIndex = 100;
      expect(spriteDevice.lastVisibileSpriteIndex).toBe(100);

      // --- Act: Reset device
      spriteDevice.reset();

      // --- Assert: Should be back to -1
      expect(spriteDevice.lastVisibileSpriteIndex).toBe(-1);
    });
  });

  describe("Sprite Index Auto-Increment", () => {
    it("should increment sprite index after writing 4-byte sprite", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 5);

      // --- Write 4-byte sprite
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x00); // has5AttributeBytes = 0

      // --- Assert: Index should increment to 6
      expect(spriteDevice.spriteIndex).toBe(6);
      expect(spriteDevice.spriteSubIndex).toBe(0);
    });

    it("should increment sprite index after writing 5-byte sprite", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 10);

      // --- Write 5-byte sprite
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0x40); // has5AttributeBytes = 1
      io.writePort(0x3557, 0x00); // 5th byte

      // --- Assert: Index should increment to 11
      expect(spriteDevice.spriteIndex).toBe(11);
      expect(spriteDevice.spriteSubIndex).toBe(0);
    });

    it("should increment sprite subindex for each byte until sprite complete", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0);

      io.writePort(0x3157, 0x10);
      expect(spriteDevice.spriteSubIndex).toBe(1);

      io.writePort(0x3257, 0x20);
      expect(spriteDevice.spriteSubIndex).toBe(2);

      io.writePort(0x3357, 0xa0);
      expect(spriteDevice.spriteSubIndex).toBe(3);

      io.writePort(0x3457, 0x00);
      // --- After 4th byte (no 5th byte), should reset to 0 and increment sprite index
      expect(spriteDevice.spriteSubIndex).toBe(0);
      expect(spriteDevice.spriteIndex).toBe(1);
    });
  });
});

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}
