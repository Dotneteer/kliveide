import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { JoystickMode } from "@emu/machines/zxNext/JoystickDevice";

// --- Port constants
const PORT_1F = 0x1f;
const PORT_DF = 0xdf;
const PORT_37 = 0x37;

// --- Bit constants (active high)
const JOY_RIGHT = 0x01;
const JOY_LEFT = 0x02;
const JOY_DOWN = 0x04;
const JOY_UP = 0x08;
const JOY_FIRE1 = 0x10; // B button in MD mode
const JOY_FIRE2 = 0x20; // C button in MD mode
const JOY_A = 0x40; // MD mode only
const JOY_START = 0x80; // MD mode only

describe("Kempston Joystick Ports", () => {
  let machine: TestZxNextMachine;

  beforeEach(async () => {
    machine = await createTestNextMachine();
  });

  // ========================================================================
  // Device initialization
  // ========================================================================

  describe("Device initialization", () => {
    it("joystickDevice is defined", () => {
      expect(machine.joystickDevice).toBeDefined();
    });

    it("initial state is 0x00 for both connectors", () => {
      expect(machine.joystickDevice.leftState).toBe(0x00);
      expect(machine.joystickDevice.rightState).toBe(0x00);
    });

    it("default joystick modes after hard reset", () => {
      // --- Hard reset sets NR 0x05 = 0x41:
      // --- joy1 = {bit3=0, bits7:6=01} = 001 = Kempston1
      // --- joy2 = {bit1=0, bits5:4=00} = 000 = Sinclair2
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.Kempston1);
      expect(machine.joystickDevice.joystick2Mode).toBe(JoystickMode.Sinclair2);
    });

    it("reset clears connector states", () => {
      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setRightState(0xff);
      machine.joystickDevice.reset();
      expect(machine.joystickDevice.leftState).toBe(0x00);
      expect(machine.joystickDevice.rightState).toBe(0x00);
    });
  });

  // ========================================================================
  // Port 0x1F — Kempston Joy 1 (default: no joystick mapped)
  // ========================================================================

  describe("Port 0x1F - default mode after hard reset", () => {
    it("returns joystick state because hard reset sets joy1 to Kempston1", () => {
      // --- Hard reset sets NR 0x05 = 0x41 → joy1 = Kempston1
      // --- Left connector maps to port 0x1F in Kempston1 mode
      machine.joystickDevice.setLeftState(0xff);
      const result = machine.portManager.readPort(PORT_1F);
      // --- Kempston1 masks bits 7:6
      expect(result & 0xff).toBe(0x3f);
    });

    it("returns 0x00 when connectors set to non-Kempston mode", () => {
      // --- Override joy1 to Cursor (non-Kempston)
      machine.joystickDevice.joystick1Mode = JoystickMode.Cursor;
      machine.joystickDevice.setLeftState(0xff);
      const result = machine.portManager.readPort(PORT_1F);
      expect(result & 0xff).toBe(0x00);
    });
  });

  // ========================================================================
  // Port 0x1F — Kempston1 mode
  // ========================================================================

  describe("Port 0x1F - Kempston1 mode", () => {
    beforeEach(() => {
      // --- Configure left connector as Kempston1
      machine.joystickDevice.joystick1Mode = JoystickMode.Kempston1;
    });

    it("reads 0x00 when no buttons pressed", () => {
      const result = machine.joystickDevice.readPort1f();
      expect(result).toBe(0x00);
    });

    it("reads right direction (bit 0)", () => {
      machine.joystickDevice.setLeftState(JOY_RIGHT);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_RIGHT);
    });

    it("reads left direction (bit 1)", () => {
      machine.joystickDevice.setLeftState(JOY_LEFT);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_LEFT);
    });

    it("reads down direction (bit 2)", () => {
      machine.joystickDevice.setLeftState(JOY_DOWN);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_DOWN);
    });

    it("reads up direction (bit 3)", () => {
      machine.joystickDevice.setLeftState(JOY_UP);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_UP);
    });

    it("reads fire 1 / B (bit 4)", () => {
      machine.joystickDevice.setLeftState(JOY_FIRE1);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_FIRE1);
    });

    it("reads fire 2 / C (bit 5)", () => {
      machine.joystickDevice.setLeftState(JOY_FIRE2);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_FIRE2);
    });

    it("bits 7:6 are masked off in standard Kempston mode", () => {
      machine.joystickDevice.setLeftState(0xff);
      // --- Kempston1 only exposes bits 5:0
      expect(machine.joystickDevice.readPort1f()).toBe(0x3f);
    });

    it("reads multiple simultaneous buttons", () => {
      machine.joystickDevice.setLeftState(JOY_UP | JOY_FIRE1);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_UP | JOY_FIRE1);
    });

    it("reads all directions and fires simultaneously", () => {
      machine.joystickDevice.setLeftState(JOY_RIGHT | JOY_LEFT | JOY_DOWN | JOY_UP | JOY_FIRE1 | JOY_FIRE2);
      expect(machine.joystickDevice.readPort1f()).toBe(0x3f);
    });

    it("port read via portManager matches device read", () => {
      machine.joystickDevice.setLeftState(JOY_UP | JOY_RIGHT | JOY_FIRE1);
      const portResult = machine.portManager.readPort(PORT_1F);
      const deviceResult = machine.joystickDevice.readPort1f();
      // --- portManager may OR results from multiple handlers; mask to 8 bits
      expect(portResult & 0xff).toBe(deviceResult);
    });
  });

  // ========================================================================
  // Port 0xDF — Kempston Joy 1 alias
  // ========================================================================

  describe("Port 0xDF - Joy 1 alias", () => {
    it("returns same value as port 0x1F", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Kempston1;
      machine.joystickDevice.setLeftState(JOY_UP | JOY_FIRE1);
      const port1f = machine.portManager.readPort(PORT_1F);
      const portDf = machine.portManager.readPort(PORT_DF);
      expect(portDf & 0xff).toBe(port1f & 0xff);
    });
  });

  // ========================================================================
  // Port 0x37 — Kempston Joy 2
  // ========================================================================

  describe("Port 0x37 - Kempston2 mode", () => {
    beforeEach(() => {
      // --- Configure right connector as Kempston2
      machine.joystickDevice.joystick2Mode = JoystickMode.Kempston2;
    });

    it("reads 0x00 when no buttons pressed", () => {
      expect(machine.joystickDevice.readPort37()).toBe(0x00);
    });

    it("reads right direction (bit 0)", () => {
      machine.joystickDevice.setRightState(JOY_RIGHT);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_RIGHT);
    });

    it("reads left direction (bit 1)", () => {
      machine.joystickDevice.setRightState(JOY_LEFT);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_LEFT);
    });

    it("reads up direction (bit 3)", () => {
      machine.joystickDevice.setRightState(JOY_UP);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_UP);
    });

    it("reads fire 1 / B (bit 4)", () => {
      machine.joystickDevice.setRightState(JOY_FIRE1);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_FIRE1);
    });

    it("bits 7:6 are masked off in standard Kempston mode", () => {
      machine.joystickDevice.setRightState(0xff);
      expect(machine.joystickDevice.readPort37()).toBe(0x3f);
    });

    it("reads multiple simultaneous buttons", () => {
      machine.joystickDevice.setRightState(JOY_DOWN | JOY_LEFT | JOY_FIRE2);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_DOWN | JOY_LEFT | JOY_FIRE2);
    });

    it("port read via portManager works", () => {
      machine.joystickDevice.setRightState(JOY_UP | JOY_FIRE1);
      const result = machine.portManager.readPort(PORT_37);
      expect(result & 0xff).toBe(JOY_UP | JOY_FIRE1);
    });
  });

  // ========================================================================
  // MD (MegaDrive) mode
  // ========================================================================

  describe("MD mode - port 0x1F", () => {
    beforeEach(() => {
      machine.joystickDevice.joystick1Mode = JoystickMode.MD1;
    });

    it("bits 7:6 are exposed in MD mode (A and Start)", () => {
      machine.joystickDevice.setLeftState(JOY_A | JOY_START);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_A | JOY_START);
    });

    it("all 8 bits available in MD mode", () => {
      machine.joystickDevice.setLeftState(0xff);
      expect(machine.joystickDevice.readPort1f()).toBe(0xff);
    });

    it("standard bits still work in MD mode", () => {
      machine.joystickDevice.setLeftState(JOY_UP | JOY_FIRE1);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_UP | JOY_FIRE1);
    });

    it("full MD pad state: Start + A + C + B + directions", () => {
      const state = JOY_START | JOY_A | JOY_FIRE2 | JOY_FIRE1 | JOY_UP | JOY_RIGHT;
      machine.joystickDevice.setLeftState(state);
      expect(machine.joystickDevice.readPort1f()).toBe(state);
    });
  });

  describe("MD mode - port 0x37", () => {
    beforeEach(() => {
      machine.joystickDevice.joystick2Mode = JoystickMode.MD2;
    });

    it("bits 7:6 are exposed in MD2 mode", () => {
      machine.joystickDevice.setRightState(JOY_A | JOY_START);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_A | JOY_START);
    });

    it("all 8 bits available in MD2 mode", () => {
      machine.joystickDevice.setRightState(0xff);
      expect(machine.joystickDevice.readPort37()).toBe(0xff);
    });
  });

  // ========================================================================
  // Mode routing — connectors can be assigned to either port
  // ========================================================================

  describe("Mode routing", () => {
    it("left connector mapped to port 0x37 via Kempston2 mode", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Kempston2;
      machine.joystickDevice.setLeftState(JOY_UP | JOY_FIRE1);

      // --- Should appear on port 0x37, not 0x1F
      expect(machine.joystickDevice.readPort37()).toBe(JOY_UP | JOY_FIRE1);
      expect(machine.joystickDevice.readPort1f()).toBe(0x00);
    });

    it("right connector mapped to port 0x1F via Kempston1 mode", () => {
      machine.joystickDevice.joystick2Mode = JoystickMode.Kempston1;
      machine.joystickDevice.setRightState(JOY_DOWN | JOY_FIRE2);

      // --- Should appear on port 0x1F, not 0x37
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_DOWN | JOY_FIRE2);
      expect(machine.joystickDevice.readPort37()).toBe(0x00);
    });

    it("both connectors mapped to port 0x1F (OR'd together)", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Kempston1;
      machine.joystickDevice.joystick2Mode = JoystickMode.Kempston1;
      machine.joystickDevice.setLeftState(JOY_UP);
      machine.joystickDevice.setRightState(JOY_FIRE1);

      // --- Both contribute to port 0x1F via OR
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_UP | JOY_FIRE1);
    });

    it("both connectors mapped to port 0x37 (OR'd together)", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Kempston2;
      machine.joystickDevice.joystick2Mode = JoystickMode.Kempston2;
      machine.joystickDevice.setLeftState(JOY_LEFT);
      machine.joystickDevice.setRightState(JOY_RIGHT);

      expect(machine.joystickDevice.readPort37()).toBe(JOY_LEFT | JOY_RIGHT);
    });

    it("left MD1 on 0x1F, right MD2 on 0x37", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.MD1;
      machine.joystickDevice.joystick2Mode = JoystickMode.MD2;
      machine.joystickDevice.setLeftState(JOY_START | JOY_UP);
      machine.joystickDevice.setRightState(JOY_A | JOY_DOWN);

      expect(machine.joystickDevice.readPort1f()).toBe(JOY_START | JOY_UP);
      expect(machine.joystickDevice.readPort37()).toBe(JOY_A | JOY_DOWN);
    });

    it("left MD2 on 0x37, right MD1 on 0x1F (cross-mapping)", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.MD2;
      machine.joystickDevice.joystick2Mode = JoystickMode.MD1;
      machine.joystickDevice.setLeftState(JOY_A | JOY_FIRE1);
      machine.joystickDevice.setRightState(JOY_START | JOY_FIRE2);

      // --- Left connector → port 0x37, right connector → port 0x1F
      expect(machine.joystickDevice.readPort37()).toBe(JOY_A | JOY_FIRE1);
      expect(machine.joystickDevice.readPort1f()).toBe(JOY_START | JOY_FIRE2);
    });
  });

  // ========================================================================
  // Non-Kempston modes produce 0x00 on Kempston ports
  // ========================================================================

  describe("Non-Kempston modes", () => {
    it("Sinclair2 mode returns 0x00 on both ports", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Sinclair2;
      machine.joystickDevice.joystick2Mode = JoystickMode.Sinclair2;
      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setRightState(0xff);

      expect(machine.joystickDevice.readPort1f()).toBe(0x00);
      expect(machine.joystickDevice.readPort37()).toBe(0x00);
    });

    it("Sinclair1 mode returns 0x00 on both ports", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Sinclair1;
      machine.joystickDevice.joystick2Mode = JoystickMode.Sinclair1;
      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setRightState(0xff);

      expect(machine.joystickDevice.readPort1f()).toBe(0x00);
      expect(machine.joystickDevice.readPort37()).toBe(0x00);
    });

    it("Cursor mode returns 0x00 on both ports", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.Cursor;
      machine.joystickDevice.joystick2Mode = JoystickMode.Cursor;
      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setRightState(0xff);

      expect(machine.joystickDevice.readPort1f()).toBe(0x00);
      expect(machine.joystickDevice.readPort37()).toBe(0x00);
    });

    it("UserDefined mode returns 0x00 on both ports", () => {
      machine.joystickDevice.joystick1Mode = JoystickMode.UserDefined;
      machine.joystickDevice.joystick2Mode = JoystickMode.UserDefined;
      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setRightState(0xff);

      expect(machine.joystickDevice.readPort1f()).toBe(0x00);
      expect(machine.joystickDevice.readPort37()).toBe(0x00);
    });
  });

  // ========================================================================
  // NR 0x05 — Joystick mode configuration
  // ========================================================================

  describe("NR 0x05 - Joystick mode configuration", () => {
    it("NR 0x05 = 0x41 sets Kempston1 and Sinclair2 (hard reset default)", () => {
      // --- 0x41 = 0b01000001
      // --- joy1 = ((0xc0 & 0x41) >> 6) | ((0x08 & 0x41) >> 1) = (1|0) = 1 = Kempston1
      // --- joy2 = ((0x30 & 0x41) >> 4) | ((0x02 & 0x41) << 1) = (0|0) = 0 = Sinclair2
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.Kempston1);
      expect(machine.joystickDevice.joystick2Mode).toBe(JoystickMode.Sinclair2);
    });

    it("NR 0x05 = 0x80 sets Cursor mode for joy1", () => {
      // --- joy1 = {bit3=0, bits7:6=10} = 010 = Cursor
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x80);
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.Cursor);
    });

    it("NR 0x05 configures Kempston1 for joy1", () => {
      // --- joy1 = {bit3=0, bits7:6=01} = 001 = Kempston1
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x40);
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.Kempston1);
    });

    it("NR 0x05 configures Kempston2 for joy1", () => {
      // --- joy1 = {bit3=1, bits7:6=00} = 100 = Kempston2
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x08);
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.Kempston2);
    });

    it("NR 0x05 configures MD1 for joy1", () => {
      // --- joy1 = {bit3=1, bits7:6=01} = 101 = MD1
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x48);
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.MD1);
    });

    it("NR 0x05 configures MD2 for joy1", () => {
      // --- joy1 = {bit3=1, bits7:6=10} = 110 = MD2
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x88);
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.MD2);
    });

    it("NR 0x05 configures Kempston1 for joy2", () => {
      // --- joy2 = {bit1=0, bits5:4=01} = 001 = Kempston1
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x10);
      expect(machine.joystickDevice.joystick2Mode).toBe(JoystickMode.Kempston1);
    });

    it("NR 0x05 configures MD2 for joy2", () => {
      // --- joy2 = {bit1=1, bits5:4=10} = 110 = MD2
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x22);
      expect(machine.joystickDevice.joystick2Mode).toBe(JoystickMode.MD2);
    });

    it("NR 0x05 configures both joysticks simultaneously", () => {
      // --- joy1 = MD1 (101): bits7:6=01, bit3=1 → 0x48
      // --- joy2 = Kempston2 (100): bits5:4=00, bit1=1 → 0x02
      // --- Combined: 0x48 | 0x02 = 0x4a
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x4a);
      expect(machine.joystickDevice.joystick1Mode).toBe(JoystickMode.MD1);
      expect(machine.joystickDevice.joystick2Mode).toBe(JoystickMode.Kempston2);
    });
  });

  // ========================================================================
  // setLeftState / setRightState  
  // ========================================================================

  describe("State setters", () => {
    it("setLeftState masks to 8 bits", () => {
      machine.joystickDevice.setLeftState(0x1ff);
      expect(machine.joystickDevice.leftState).toBe(0xff);
    });

    it("setRightState masks to 8 bits", () => {
      machine.joystickDevice.setRightState(0x1ff);
      expect(machine.joystickDevice.rightState).toBe(0xff);
    });

    it("setLeftState with 0 clears all bits", () => {
      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setLeftState(0x00);
      expect(machine.joystickDevice.leftState).toBe(0x00);
    });
  });

  // ========================================================================
  // Integration: full workflow via ports
  // ========================================================================

  describe("Integration - full port workflow", () => {
    it("configure Kempston1 via NR 0x05, set state, read port 0x1F", () => {
      // --- Configure joy1 as Kempston1
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x40); // Kempston1 for joy1

      // --- Press UP + FIRE
      machine.joystickDevice.setLeftState(JOY_UP | JOY_FIRE1);

      // --- Read port 0x1F
      const result = machine.portManager.readPort(PORT_1F);
      expect(result & 0xff).toBe(JOY_UP | JOY_FIRE1);
    });

    it("configure MD1 via NR 0x05, set state, read port 0x1F with all MD bits", () => {
      // --- Configure joy1 as MD1
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x48); // MD1 for joy1

      // --- Press Start + A + Up + Fire1 (B)
      machine.joystickDevice.setLeftState(JOY_START | JOY_A | JOY_UP | JOY_FIRE1);

      const result = machine.portManager.readPort(PORT_1F);
      expect(result & 0xff).toBe(JOY_START | JOY_A | JOY_UP | JOY_FIRE1);
    });

    it("configure Kempston2 for joy2 via NR 0x05, read port 0x37", () => {
      // --- joy2 = Kempston2 (100): bits5:4=00, bit1=1 → 0x02
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x02);

      machine.joystickDevice.setRightState(JOY_LEFT | JOY_DOWN | JOY_FIRE2);

      const result = machine.portManager.readPort(PORT_37);
      expect(result & 0xff).toBe(JOY_LEFT | JOY_DOWN | JOY_FIRE2);
    });

    it("no joystick mapped returns 0x00 on both ports", () => {
      // --- Both in Sinclair mode (no Kempston port output)
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x00); // Sinclair2 for both

      machine.joystickDevice.setLeftState(0xff);
      machine.joystickDevice.setRightState(0xff);

      expect(machine.portManager.readPort(PORT_1F) & 0xff).toBe(0x00);
      expect(machine.portManager.readPort(PORT_37) & 0xff).toBe(0x00);
    });

    it("port 0xDF alias returns same as 0x1F", () => {
      machine.nextRegDevice.setNextRegisterIndex(0x05);
      machine.nextRegDevice.setNextRegisterValue(0x40); // Kempston1 for joy1

      machine.joystickDevice.setLeftState(JOY_RIGHT | JOY_FIRE1);

      const result1f = machine.portManager.readPort(PORT_1F);
      const resultDf = machine.portManager.readPort(PORT_DF);
      expect(result1f & 0xff).toBe(resultDf & 0xff);
    });
  });
});
