import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

// --- Port constants
const PORT_FBDF = 0xfbdf; // Mouse X
const PORT_FFDF = 0xffdf; // Mouse Y
const PORT_FADF = 0xfadf; // Mouse wheel + buttons

describe("Kempston Mouse", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ========================================================================
  // Device initialization and reset
  // ========================================================================

  describe("Device initialization", () => {
    it("mouseDevice is defined", () => {
      expect(machine.mouseDevice).toBeDefined();
    });

    it("initial X position is 0", () => {
      expect(machine.mouseDevice.xPos).toBe(0x00);
    });

    it("initial Y position is 0", () => {
      expect(machine.mouseDevice.yPos).toBe(0x00);
    });

    it("initial wheel position is 0", () => {
      expect(machine.mouseDevice.wheelZ).toBe(0x00);
    });

    it("initial buttons are all released", () => {
      expect(machine.mouseDevice.buttonLeft).toBe(false);
      expect(machine.mouseDevice.buttonRight).toBe(false);
      expect(machine.mouseDevice.buttonMiddle).toBe(false);
    });

    it("initial DPI is 1 (default)", () => {
      expect(machine.mouseDevice.dpi).toBe(1);
    });

    it("initial swapButtons is false", () => {
      expect(machine.mouseDevice.swapButtons).toBe(false);
    });

    it("reset clears position and buttons", () => {
      machine.mouseDevice.addDelta(50, 100);
      machine.mouseDevice.addWheelDelta(5);
      machine.mouseDevice.setButtons(true, true, true);
      machine.mouseDevice.reset();

      expect(machine.mouseDevice.xPos).toBe(0x00);
      expect(machine.mouseDevice.yPos).toBe(0x00);
      expect(machine.mouseDevice.wheelZ).toBe(0x00);
      expect(machine.mouseDevice.buttonLeft).toBe(false);
      expect(machine.mouseDevice.buttonRight).toBe(false);
      expect(machine.mouseDevice.buttonMiddle).toBe(false);
    });
  });

  // ========================================================================
  // Port 0xFBDF — Mouse X position
  // ========================================================================

  describe("Port 0xFBDF - Mouse X", () => {
    it("returns 0x00 with no movement", () => {
      expect(machine.mouseDevice.readPortFbdf()).toBe(0x00);
    });

    it("accumulates positive X delta (rightward)", () => {
      machine.mouseDevice.addDelta(10, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(10);
    });

    it("accumulates negative X delta (leftward)", () => {
      machine.mouseDevice.addDelta(-5, 0);
      // --- 0 - 5 = -5, wrapped to 251
      expect(machine.mouseDevice.readPortFbdf()).toBe(251);
    });

    it("wraps X from 255 to 0", () => {
      machine.mouseDevice.addDelta(255, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(255);
      machine.mouseDevice.addDelta(1, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(0);
    });

    it("wraps X from 0 to 255", () => {
      machine.mouseDevice.addDelta(-1, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(255);
    });

    it("accumulates multiple X deltas", () => {
      machine.mouseDevice.addDelta(100, 0);
      machine.mouseDevice.addDelta(50, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(150);
    });

    it("reading X does NOT reset the accumulator", () => {
      machine.mouseDevice.addDelta(42, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(42);
      expect(machine.mouseDevice.readPortFbdf()).toBe(42); // same value
    });

    it("port read via portManager matches device read", () => {
      machine.mouseDevice.addDelta(77, 0);
      const portResult = machine.portManager.readPort(PORT_FBDF);
      expect(portResult & 0xff).toBe(77);
    });
  });

  // ========================================================================
  // Port 0xFFDF — Mouse Y position
  // ========================================================================

  describe("Port 0xFFDF - Mouse Y", () => {
    it("returns 0x00 with no movement", () => {
      expect(machine.mouseDevice.readPortFfdf()).toBe(0x00);
    });

    it("accumulates positive Y delta (upward)", () => {
      machine.mouseDevice.addDelta(0, 10);
      expect(machine.mouseDevice.readPortFfdf()).toBe(10);
    });

    it("accumulates negative Y delta (downward)", () => {
      machine.mouseDevice.addDelta(0, -3);
      // --- 0 - 3 = -3, wrapped to 253
      expect(machine.mouseDevice.readPortFfdf()).toBe(253);
    });

    it("wraps Y from 255 to 0", () => {
      machine.mouseDevice.addDelta(0, 255);
      machine.mouseDevice.addDelta(0, 1);
      expect(machine.mouseDevice.readPortFfdf()).toBe(0);
    });

    it("wraps Y from 0 to 255", () => {
      machine.mouseDevice.addDelta(0, -1);
      expect(machine.mouseDevice.readPortFfdf()).toBe(255);
    });

    it("reading Y does NOT reset the accumulator", () => {
      machine.mouseDevice.addDelta(0, 33);
      expect(machine.mouseDevice.readPortFfdf()).toBe(33);
      expect(machine.mouseDevice.readPortFfdf()).toBe(33);
    });

    it("port read via portManager matches device read", () => {
      machine.mouseDevice.addDelta(0, 99);
      const portResult = machine.portManager.readPort(PORT_FFDF);
      expect(portResult & 0xff).toBe(99);
    });
  });

  // ========================================================================
  // Port 0xFADF — Mouse wheel + buttons
  // ========================================================================

  describe("Port 0xFADF - Wheel + Buttons", () => {
    it("returns 0x08 with no buttons and no wheel (bit 3 always 1)", () => {
      expect(machine.mouseDevice.readPortFadf()).toBe(0x08);
    });

    it("left button sets bit 1", () => {
      machine.mouseDevice.setButtons(true, false, false);
      expect(machine.mouseDevice.readPortFadf()).toBe(0x08 | 0x02);
    });

    it("right button sets bit 0", () => {
      machine.mouseDevice.setButtons(false, true, false);
      expect(machine.mouseDevice.readPortFadf()).toBe(0x08 | 0x01);
    });

    it("middle button sets bit 2", () => {
      machine.mouseDevice.setButtons(false, false, true);
      expect(machine.mouseDevice.readPortFadf()).toBe(0x08 | 0x04);
    });

    it("all buttons pressed", () => {
      machine.mouseDevice.setButtons(true, true, true);
      // --- bit 3 = 1, bit 2 = middle, bit 1 = left, bit 0 = right
      expect(machine.mouseDevice.readPortFadf()).toBe(0x08 | 0x04 | 0x02 | 0x01);
    });

    it("wheel positive delta in bits 7:4", () => {
      machine.mouseDevice.addWheelDelta(3);
      expect(machine.mouseDevice.readPortFadf()).toBe((3 << 4) | 0x08);
    });

    it("wheel negative delta wraps in 4-bit range", () => {
      machine.mouseDevice.addWheelDelta(-1);
      // --- 0 - 1 = -1, masked to 0x0F = 15
      expect(machine.mouseDevice.readPortFadf()).toBe((15 << 4) | 0x08);
    });

    it("wheel wraps at 4 bits (0-15)", () => {
      machine.mouseDevice.addWheelDelta(15);
      expect((machine.mouseDevice.readPortFadf() >> 4) & 0x0f).toBe(15);
      machine.mouseDevice.addWheelDelta(1);
      expect((machine.mouseDevice.readPortFadf() >> 4) & 0x0f).toBe(0);
    });

    it("wheel and buttons combined", () => {
      machine.mouseDevice.addWheelDelta(7);
      machine.mouseDevice.setButtons(true, false, true);
      // --- wheel=7 in bits 7:4, bit 3=1, middle=1 (bit 2), left=1 (bit 1)
      expect(machine.mouseDevice.readPortFadf()).toBe((7 << 4) | 0x08 | 0x04 | 0x02);
    });

    it("port read via portManager matches device read", () => {
      machine.mouseDevice.addWheelDelta(5);
      machine.mouseDevice.setButtons(false, true, false);
      const portResult = machine.portManager.readPort(PORT_FADF);
      const deviceResult = machine.mouseDevice.readPortFadf();
      expect(portResult & 0xff).toBe(deviceResult);
    });
  });

  // ========================================================================
  // X and Y move simultaneously
  // ========================================================================

  describe("Combined X and Y movement", () => {
    it("addDelta updates both X and Y", () => {
      machine.mouseDevice.addDelta(30, 50);
      expect(machine.mouseDevice.readPortFbdf()).toBe(30);
      expect(machine.mouseDevice.readPortFfdf()).toBe(50);
    });

    it("negative deltas for both axes", () => {
      machine.mouseDevice.addDelta(-10, -20);
      expect(machine.mouseDevice.readPortFbdf()).toBe(246); // 256 - 10
      expect(machine.mouseDevice.readPortFfdf()).toBe(236); // 256 - 20
    });
  });

  // ========================================================================
  // Button swap (NR 0x0A bit 3)
  // ========================================================================

  describe("Button swap", () => {
    it("no swap: left=bit1, right=bit0", () => {
      machine.mouseDevice.swapButtons = false;
      machine.mouseDevice.setButtons(true, false, false); // left only
      const result = machine.mouseDevice.readPortFadf();
      expect(result & 0x02).toBe(0x02); // left in bit 1
      expect(result & 0x01).toBe(0x00); // right off
    });

    it("swap: left button appears in bit 0 (right position)", () => {
      machine.mouseDevice.swapButtons = true;
      machine.mouseDevice.setButtons(true, false, false); // left only
      const result = machine.mouseDevice.readPortFadf();
      expect(result & 0x01).toBe(0x01); // swapped to right position
      expect(result & 0x02).toBe(0x00); // left position off
    });

    it("swap: right button appears in bit 1 (left position)", () => {
      machine.mouseDevice.swapButtons = true;
      machine.mouseDevice.setButtons(false, true, false); // right only
      const result = machine.mouseDevice.readPortFadf();
      expect(result & 0x02).toBe(0x02); // swapped to left position
      expect(result & 0x01).toBe(0x00); // right position off
    });

    it("swap: middle button is unaffected", () => {
      machine.mouseDevice.swapButtons = true;
      machine.mouseDevice.setButtons(false, false, true); // middle only
      const result = machine.mouseDevice.readPortFadf();
      expect(result & 0x04).toBe(0x04); // middle still in bit 2
    });

    it("swap: both left and right swap positions", () => {
      machine.mouseDevice.swapButtons = true;
      machine.mouseDevice.setButtons(true, true, false);
      const result = machine.mouseDevice.readPortFadf();
      // --- Both are pressed, so both bits should be set regardless
      expect(result & 0x03).toBe(0x03);
    });

    it("swap via NR 0x0A", () => {
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      // --- Set bit 3 (swap) + DPI = 01 (default)
      machine.nextRegDevice.setNextRegisterValue(0x08 | 0x01);
      expect(machine.mouseDevice.swapButtons).toBe(true);

      machine.mouseDevice.setButtons(true, false, false); // left only
      const result = machine.mouseDevice.readPortFadf();
      expect(result & 0x01).toBe(0x01); // swapped to right position
    });
  });

  // ========================================================================
  // DPI scaling (NR 0x0A bits 1:0)
  // ========================================================================

  describe("DPI scaling", () => {
    it("DPI 00 (low): doubles delta", () => {
      machine.mouseDevice.dpi = 0;
      machine.mouseDevice.addDelta(10, 20);
      expect(machine.mouseDevice.readPortFbdf()).toBe(20);
      expect(machine.mouseDevice.readPortFfdf()).toBe(40);
    });

    it("DPI 01 (default): no change", () => {
      machine.mouseDevice.dpi = 1;
      machine.mouseDevice.addDelta(10, 20);
      expect(machine.mouseDevice.readPortFbdf()).toBe(10);
      expect(machine.mouseDevice.readPortFfdf()).toBe(20);
    });

    it("DPI 10 (medium): halves delta", () => {
      machine.mouseDevice.dpi = 2;
      machine.mouseDevice.addDelta(10, 20);
      expect(machine.mouseDevice.readPortFbdf()).toBe(5);
      expect(machine.mouseDevice.readPortFfdf()).toBe(10);
    });

    it("DPI 11 (high): quarters delta", () => {
      machine.mouseDevice.dpi = 3;
      machine.mouseDevice.addDelta(20, 40);
      expect(machine.mouseDevice.readPortFbdf()).toBe(5);
      expect(machine.mouseDevice.readPortFfdf()).toBe(10);
    });

    it("DPI 00: negative delta doubled", () => {
      machine.mouseDevice.dpi = 0;
      machine.mouseDevice.addDelta(-5, 0);
      // --- -5 << 1 = -10, wrapped: 256 - 10 = 246
      expect(machine.mouseDevice.readPortFbdf()).toBe(246);
    });

    it("DPI scaling via NR 0x0A", () => {
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      // --- DPI = 10 (medium), no swap
      machine.nextRegDevice.setNextRegisterValue(0x02);
      expect(machine.mouseDevice.dpi).toBe(2);

      machine.mouseDevice.addDelta(20, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe(10); // halved
    });

    it("DPI 10: small deltas round down to 0", () => {
      machine.mouseDevice.dpi = 2;
      machine.mouseDevice.addDelta(1, 1);
      // --- 1 >> 1 = 0
      expect(machine.mouseDevice.readPortFbdf()).toBe(0);
      expect(machine.mouseDevice.readPortFfdf()).toBe(0);
    });

    it("DPI 11: small deltas round down to 0", () => {
      machine.mouseDevice.dpi = 3;
      machine.mouseDevice.addDelta(3, 3);
      // --- 3 >> 2 = 0
      expect(machine.mouseDevice.readPortFbdf()).toBe(0);
      expect(machine.mouseDevice.readPortFfdf()).toBe(0);
    });
  });

  // ========================================================================
  // NR 0x0A integration
  // ========================================================================

  describe("NR 0x0A - Peripheral 5 Setting", () => {
    it("read back DPI and swap settings", () => {
      machine.mouseDevice.dpi = 3;
      machine.mouseDevice.swapButtons = true;
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      const val = machine.nextRegDevice.getNextRegisterValue();
      expect(val & 0x08).toBe(0x08); // swap = 1
      expect(val & 0x03).toBe(0x03); // DPI = 11
    });

    it("write DPI = 00 (low)", () => {
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      machine.nextRegDevice.setNextRegisterValue(0x00);
      expect(machine.mouseDevice.dpi).toBe(0);
    });

    it("write DPI = 11 (high)", () => {
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      machine.nextRegDevice.setNextRegisterValue(0x03);
      expect(machine.mouseDevice.dpi).toBe(3);
    });

    it("write swap = 1", () => {
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      machine.nextRegDevice.setNextRegisterValue(0x09); // swap + DPI=01
      expect(machine.mouseDevice.swapButtons).toBe(true);
    });
  });

  // ========================================================================
  // Port decode masks
  // ========================================================================

  describe("Port decode masks", () => {
    it("0xFBDF responds regardless of upper 4 address bits", () => {
      machine.mouseDevice.addDelta(42, 0);
      // --- Upper nibble doesn't matter: 0x0BDF, 0x1BDF, etc. should all match
      const result1 = machine.portManager.readPort(0xfbdf);
      const result2 = machine.portManager.readPort(0x0bdf);
      expect(result1 & 0xff).toBe(42);
      expect(result2 & 0xff).toBe(42);
    });

    it("0xFFDF responds regardless of upper 4 address bits", () => {
      machine.mouseDevice.addDelta(0, 77);
      const result1 = machine.portManager.readPort(0xffdf);
      const result2 = machine.portManager.readPort(0x0fdf);
      expect(result1 & 0xff).toBe(77);
      expect(result2 & 0xff).toBe(77);
    });

    it("0xFADF responds regardless of upper 4 address bits", () => {
      machine.mouseDevice.setButtons(true, false, false);
      const result1 = machine.portManager.readPort(0xfadf);
      const result2 = machine.portManager.readPort(0x0adf);
      expect(result1 & 0xff).toBe(result2 & 0xff);
    });
  });

  // ========================================================================
  // Edge cases
  // ========================================================================

  describe("Edge cases", () => {
    it("large positive X delta wraps correctly", () => {
      machine.mouseDevice.addDelta(300, 0);
      // --- 300 & 0xFF = 44
      expect(machine.mouseDevice.readPortFbdf()).toBe(300 & 0xff);
    });

    it("large negative X delta wraps correctly", () => {
      machine.mouseDevice.addDelta(-300, 0);
      expect(machine.mouseDevice.readPortFbdf()).toBe((-300) & 0xff);
    });

    it("wheel accumulates multiple deltas", () => {
      machine.mouseDevice.addWheelDelta(3);
      machine.mouseDevice.addWheelDelta(5);
      expect((machine.mouseDevice.readPortFadf() >> 4) & 0x0f).toBe(8);
    });

    it("button state can be changed multiple times", () => {
      machine.mouseDevice.setButtons(true, false, false);
      expect(machine.mouseDevice.readPortFadf() & 0x07).toBe(0x02); // left
      machine.mouseDevice.setButtons(false, true, false);
      expect(machine.mouseDevice.readPortFadf() & 0x07).toBe(0x01); // right
      machine.mouseDevice.setButtons(false, false, false);
      expect(machine.mouseDevice.readPortFadf() & 0x07).toBe(0x00); // none
    });

    it("bit 3 is always 1 regardless of state", () => {
      // --- Various combinations, bit 3 must always be set
      expect(machine.mouseDevice.readPortFadf() & 0x08).toBe(0x08);
      machine.mouseDevice.setButtons(true, true, true);
      expect(machine.mouseDevice.readPortFadf() & 0x08).toBe(0x08);
      machine.mouseDevice.addWheelDelta(15);
      expect(machine.mouseDevice.readPortFadf() & 0x08).toBe(0x08);
    });
  });

  // ========================================================================
  // Integration: full workflow
  // ========================================================================

  describe("Integration - full workflow", () => {
    it("configure DPI via NR 0x0A, move mouse, read all three ports", () => {
      // --- Set DPI to medium (halve)
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      machine.nextRegDevice.setNextRegisterValue(0x02); // DPI = 10

      // --- Move mouse right 20, up 40
      machine.mouseDevice.addDelta(20, 40);

      // --- Scroll wheel
      machine.mouseDevice.addWheelDelta(3);

      // --- Press left + middle
      machine.mouseDevice.setButtons(true, false, true);

      // --- Read X (20 halved = 10)
      expect(machine.portManager.readPort(PORT_FBDF) & 0xff).toBe(10);

      // --- Read Y (40 halved = 20)
      expect(machine.portManager.readPort(PORT_FFDF) & 0xff).toBe(20);

      // --- Read wheel + buttons: wheel=3 in bits 7:4, bit3=1, middle=1, left=1
      const fadf = machine.portManager.readPort(PORT_FADF) & 0xff;
      expect((fadf >> 4) & 0x0f).toBe(3);  // wheel
      expect(fadf & 0x08).toBe(0x08);       // bit 3
      expect(fadf & 0x04).toBe(0x04);       // middle
      expect(fadf & 0x02).toBe(0x02);       // left
      expect(fadf & 0x01).toBe(0x00);       // right (not pressed)
    });

    it("swap buttons via NR 0x0A and verify port output", () => {
      // --- Enable button swap, default DPI
      machine.nextRegDevice.setNextRegisterIndex(0x0a);
      machine.nextRegDevice.setNextRegisterValue(0x09); // swap=1, DPI=01

      // --- Press left only
      machine.mouseDevice.setButtons(true, false, false);

      // --- Read port — left should appear as right (bit 0)
      const fadf = machine.portManager.readPort(PORT_FADF) & 0xff;
      expect(fadf & 0x01).toBe(0x01); // swapped to right
      expect(fadf & 0x02).toBe(0x00); // left position empty
    });
  });
});
