import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * Unit tests for SpriteDevice width and height calculation
 * 
 * Tests cover:
 * - Base dimensions (16×16 pixels)
 * - Scaling effects (1x, 2x, 4x, 8x)
 * - Rotation effects (width/height swap)
 * - Mirroring effects (no dimension change)
 * - Combined transformations
 */

describe("SpriteDevice - Sprite Dimensions", () => {
  let machine: IZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  describe("Initial Dimensions", () => {
    it("should initialize all sprites with 16×16 dimensions", async () => {
      const spriteDevice = machine.spriteDevice;

      for (let i = 0; i < 128; i++) {
        const attrs = spriteDevice.attributes[i];
        expect(attrs.width).toBe(16);
        expect(attrs.height).toBe(16);
      }
    });

    it("should have 16×16 dimensions after reset", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Modify sprite 0 dimensions
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10); // X
      io.writePort(0x3257, 0x20); // Y
      io.writePort(0x3357, 0xa0); // Attr2
      io.writePort(0x3457, 0xc0); // Attr3 (5-byte)
      io.writePort(0x3557, 0x18); // Attr4: scaleX=3 (8x)

      expect(spriteDevice.attributes[0].width).toBe(128);

      // --- Reset device
      spriteDevice.reset();

      // --- Dimensions should be back to default
      expect(spriteDevice.attributes[0].width).toBe(16);
      expect(spriteDevice.attributes[0].height).toBe(16);
    });
  });

  describe("Base Dimensions (No Scaling, No Rotation)", () => {
    it("should have 16×16 when scaleX=0, scaleY=0", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10); // X
      io.writePort(0x3257, 0x20); // Y
      io.writePort(0x3357, 0xa0); // Attr2: no rotate, no mirror
      io.writePort(0x3457, 0xc0); // Attr3 (5-byte)
      io.writePort(0x3557, 0x00); // Attr4: scaleX=0, scaleY=0

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(16);
      expect(attrs.scaleX).toBe(0);
      expect(attrs.scaleY).toBe(0);
      expect(attrs.rotate).toBe(false);
    });

    it("should have 16×16 when only writing 4 attribute bytes (no scaling data)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10); // X
      io.writePort(0x3257, 0x20); // Y
      io.writePort(0x3357, 0xa0); // Attr2
      io.writePort(0x3457, 0x80); // Attr3 (4-byte, no attr4)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(16);
      expect(attrs.has5AttributeBytes).toBe(false);
    });
  });

  describe("Scaling Effects on Width", () => {
    it("should have width=32 when scaleX=1 (2x scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x08); // scaleX=1 (bits 4:3 = 01)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(32);
      expect(attrs.height).toBe(16);
      expect(attrs.scaleX).toBe(1);
      expect(attrs.scaleY).toBe(0);
    });

    it("should have width=64 when scaleX=2 (4x scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x10); // scaleX=2 (bits 4:3 = 10)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(64);
      expect(attrs.height).toBe(16);
      expect(attrs.scaleX).toBe(2);
    });

    it("should have width=128 when scaleX=3 (8x scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x18); // scaleX=3 (bits 4:3 = 11)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(128);
      expect(attrs.height).toBe(16);
      expect(attrs.scaleX).toBe(3);
    });
  });

  describe("Scaling Effects on Height", () => {
    it("should have height=32 when scaleY=1 (2x scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x02); // scaleY=1 (bits 2:1 = 01)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(32);
      expect(attrs.scaleX).toBe(0);
      expect(attrs.scaleY).toBe(1);
    });

    it("should have height=64 when scaleY=2 (4x scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x04); // scaleY=2 (bits 2:1 = 10)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(64);
      expect(attrs.scaleY).toBe(2);
    });

    it("should have height=128 when scaleY=3 (8x scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x06); // scaleY=3 (bits 2:1 = 11)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(128);
      expect(attrs.scaleY).toBe(3);
    });
  });

  describe("Combined X and Y Scaling", () => {
    it("should have 32×32 when scaleX=1, scaleY=1", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x0a); // scaleX=1, scaleY=1 (bits 4:1 = 0101)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(32);
      expect(attrs.height).toBe(32);
    });

    it("should have 64×128 when scaleX=2, scaleY=3", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x16); // scaleX=2, scaleY=3 (bits 4:1 = 1011)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(64);
      expect(attrs.height).toBe(128);
      expect(attrs.scaleX).toBe(2);
      expect(attrs.scaleY).toBe(3);
    });

    it("should have 128×128 when scaleX=3, scaleY=3", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x1e); // scaleX=3, scaleY=3 (bits 4:1 = 1111)

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(128);
      expect(attrs.height).toBe(128);
    });

    it("should have 128×16 when scaleX=3, scaleY=0", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x18); // scaleX=3, scaleY=0

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(128);
      expect(attrs.height).toBe(16);
    });
  });

  describe("Rotation Effects", () => {
    it("should swap width and height when rotate=true (no scaling)", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa2); // rotate=true (bit 1)
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x00); // No scaling

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(16);
      expect(attrs.rotate).toBe(true);
    });

    it("should swap dimensions: 32×16 → 16×32 when rotate=true, scaleX=1", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa2); // rotate=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x08); // scaleX=1, scaleY=0 → 32×16 before rotation

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16); // After rotation: height becomes width
      expect(attrs.height).toBe(32); // After rotation: width becomes height
      expect(attrs.rotate).toBe(true);
      expect(attrs.scaleX).toBe(1);
      expect(attrs.scaleY).toBe(0);
    });

    it("should swap dimensions: 16×64 → 64×16 when rotate=true, scaleY=2", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa2); // rotate=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x04); // scaleX=0, scaleY=2 → 16×64 before rotation

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(64); // After rotation: height becomes width
      expect(attrs.height).toBe(16); // After rotation: width becomes height
      expect(attrs.rotate).toBe(true);
    });

    it("should swap dimensions: 64×128 → 128×64 when rotate=true, scaleX=2, scaleY=3", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa2); // rotate=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x16); // scaleX=2, scaleY=3 → 64×128 before rotation

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(128); // After rotation: height becomes width
      expect(attrs.height).toBe(64); // After rotation: width becomes height
    });

    it("should update dimensions when toggling rotate flag", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set up with scaling but no rotation: 32×64
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0); // rotate=false
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x0c); // scaleX=1, scaleY=2

      let attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(32);
      expect(attrs.height).toBe(64);

      // --- Enable rotation: should swap to 64×32
      io.writePort(0x3357, 0xa2); // rotate=true

      attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(64);
      expect(attrs.height).toBe(32);
      expect(attrs.rotate).toBe(true);
    });
  });

  describe("Mirroring Effects", () => {
    it("should NOT change dimensions when mirrorX=true", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa8); // mirrorX=true (bit 3)
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x0a); // scaleX=1, scaleY=1 → 32×32

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(32);
      expect(attrs.height).toBe(32);
      expect(attrs.mirrorX).toBe(true);
    });

    it("should NOT change dimensions when mirrorY=true", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa4); // mirrorY=true (bit 2)
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x10); // scaleX=2, scaleY=0 → 64×16

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(64);
      expect(attrs.height).toBe(16);
      expect(attrs.mirrorY).toBe(true);
    });

    it("should NOT change dimensions when both mirrorX and mirrorY are true", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xac); // mirrorX=true, mirrorY=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x06); // scaleX=0, scaleY=3 → 16×128

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(128);
      expect(attrs.mirrorX).toBe(true);
      expect(attrs.mirrorY).toBe(true);
    });
  });

  describe("Combined Transformations", () => {
    it("should handle rotate + mirrorX: 32×16 → 16×32", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xaa); // rotate=true, mirrorX=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x08); // scaleX=1 → 32×16 before rotation

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(32);
      expect(attrs.rotate).toBe(true);
      expect(attrs.mirrorX).toBe(true);
    });

    it("should handle rotate + mirrorY: 64×32 → 32×64", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa6); // rotate=true, mirrorY=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x12); // scaleX=2, scaleY=1 → 64×32 before rotation

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(32);
      expect(attrs.height).toBe(64);
      expect(attrs.rotate).toBe(true);
      expect(attrs.mirrorY).toBe(true);
    });

    it("should handle all transformations: rotate + mirrorX + mirrorY + scaling", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xae); // rotate=true, mirrorX=true, mirrorY=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x0e); // scaleX=1, scaleY=3 → 32×128 before rotation

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(128); // height becomes width
      expect(attrs.height).toBe(32); // width becomes height
      expect(attrs.rotate).toBe(true);
      expect(attrs.mirrorX).toBe(true);
      expect(attrs.mirrorY).toBe(true);
      expect(attrs.scaleX).toBe(1);
      expect(attrs.scaleY).toBe(3);
    });
  });

  describe("Dimension Updates via NextReg", () => {
    it("should update dimensions when writing attr2 via NextReg 0x36", async () => {
      const spriteDevice = machine.spriteDevice;

      // --- Enable lockstep
      writeNextReg(machine, 0x09, 0x10);

      // --- Select sprite 0
      writeNextReg(machine, 0x34, 0x00);

      // --- Write attributes
      writeNextReg(machine, 0x35, 0x10); // X
      writeNextReg(machine, 0x36, 0x20); // Y
      writeNextReg(machine, 0x37, 0xa2); // Attr2: rotate=true
      writeNextReg(machine, 0x38, 0xc0); // Attr3: 5-byte
      writeNextReg(machine, 0x39, 0x08); // Attr4: scaleX=1

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16); // 32×16 rotated → 16×32
      expect(attrs.height).toBe(32);
      expect(attrs.rotate).toBe(true);
    });

    it("should update dimensions when writing attr4 via NextReg 0x39", async () => {
      const spriteDevice = machine.spriteDevice;

      // --- Enable lockstep
      writeNextReg(machine, 0x09, 0x10);

      // --- Select sprite 5
      writeNextReg(machine, 0x34, 0x05);

      // --- Write attributes
      writeNextReg(machine, 0x35, 0x10);
      writeNextReg(machine, 0x36, 0x20);
      writeNextReg(machine, 0x37, 0xa0);
      writeNextReg(machine, 0x38, 0xc0);
      writeNextReg(machine, 0x39, 0x1e); // scaleX=3, scaleY=3

      const attrs = spriteDevice.attributes[5];
      expect(attrs.width).toBe(128);
      expect(attrs.height).toBe(128);
    });
  });

  describe("Multiple Sprites Independence", () => {
    it("should maintain independent dimensions for different sprites", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Sprite 0: 16×16 (no scaling)
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x00);

      // --- Sprite 1: 32×64
      io.writePort(0x303b, 0x01);
      io.writePort(0x3157, 0x30);
      io.writePort(0x3257, 0x40);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x0c); // scaleX=1, scaleY=2

      // --- Sprite 2: 128×16 rotated → 16×128
      io.writePort(0x303b, 0x02);
      io.writePort(0x3157, 0x50);
      io.writePort(0x3257, 0x60);
      io.writePort(0x3357, 0xa2); // rotate=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x18); // scaleX=3

      // --- Verify each sprite independently
      expect(spriteDevice.attributes[0].width).toBe(16);
      expect(spriteDevice.attributes[0].height).toBe(16);

      expect(spriteDevice.attributes[1].width).toBe(32);
      expect(spriteDevice.attributes[1].height).toBe(64);

      expect(spriteDevice.attributes[2].width).toBe(16);
      expect(spriteDevice.attributes[2].height).toBe(128);
    });

    it("should update only affected sprite dimensions", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Set up sprite 10 and 20 with different dimensions
      io.writePort(0x303b, 0x0a); // Sprite 10
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x0a); // 32×32

      io.writePort(0x303b, 0x14); // Sprite 20
      io.writePort(0x3157, 0x30);
      io.writePort(0x3257, 0x40);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x10); // 64×16

      // --- Modify sprite 10 only
      io.writePort(0x303b, 0x0a);
      io.writePort(0x3357, 0xa2); // Add rotation

      // --- Verify sprite 10 changed, sprite 20 unchanged
      expect(spriteDevice.attributes[10].width).toBe(32);
      expect(spriteDevice.attributes[10].height).toBe(32);
      expect(spriteDevice.attributes[10].rotate).toBe(true);

      expect(spriteDevice.attributes[20].width).toBe(64);
      expect(spriteDevice.attributes[20].height).toBe(16);
      expect(spriteDevice.attributes[20].rotate).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle maximum dimensions: 128×128", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x1e); // scaleX=3, scaleY=3

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(128);
      expect(attrs.height).toBe(128);
    });

    it("should handle minimum dimensions: 16×16", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x00); // scaleX=0, scaleY=0

      const attrs = spriteDevice.attributes[0];
      expect(attrs.width).toBe(16);
      expect(attrs.height).toBe(16);
    });

    it("should handle asymmetric maximum: 128×16 and 16×128", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- 128×16 (no rotation)
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x18); // scaleX=3, scaleY=0

      // --- 16×128 (same but rotated)
      io.writePort(0x303b, 0x01);
      io.writePort(0x3157, 0x30);
      io.writePort(0x3257, 0x40);
      io.writePort(0x3357, 0xa2); // rotate=true
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x18); // scaleX=3, scaleY=0 → 128×16 before rotation

      expect(spriteDevice.attributes[0].width).toBe(128);
      expect(spriteDevice.attributes[0].height).toBe(16);

      expect(spriteDevice.attributes[1].width).toBe(16);
      expect(spriteDevice.attributes[1].height).toBe(128);
    });

    it("should recalculate dimensions when modifying existing sprite", async () => {
      const spriteDevice = machine.spriteDevice;
      const io = machine.portManager;

      // --- Initial setup: 16×16
      io.writePort(0x303b, 0x00);
      io.writePort(0x3157, 0x10);
      io.writePort(0x3257, 0x20);
      io.writePort(0x3357, 0xa0);
      io.writePort(0x3457, 0xc0);
      io.writePort(0x3557, 0x00);

      expect(spriteDevice.attributes[0].width).toBe(16);
      expect(spriteDevice.attributes[0].height).toBe(16);

      // --- Modify to 64×128
      io.writePort(0x303b, 0x00);
      io.writePort(0x3557, 0x16); // scaleX=2, scaleY=3

      expect(spriteDevice.attributes[0].width).toBe(64);
      expect(spriteDevice.attributes[0].height).toBe(128);

      // --- Add rotation: 128×64
      io.writePort(0x3357, 0xa2);

      expect(spriteDevice.attributes[0].width).toBe(128);
      expect(spriteDevice.attributes[0].height).toBe(64);
    });
  });
});

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}
