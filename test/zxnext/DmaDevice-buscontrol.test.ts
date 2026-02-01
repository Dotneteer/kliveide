import { describe, it, expect, beforeEach } from "vitest";
import { DmaDevice, DmaState, TransferMode } from "@emu/machines/zxNext/DmaDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

describe("DmaDevice - Step 9: Bus Control and Handshaking", () => {
  let dma: DmaDevice;
  let machine: IZxNextMachine;

  beforeEach(() => {
    machine = {} as IZxNextMachine;
    dma = new DmaDevice(machine);
  });

  describe("Bus Control State Initialization", () => {
    it("should initialize bus control state to all false", () => {
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      expect(busControl.busAcknowledged).toBe(false);
      expect(busControl.busDelayed).toBe(false);
    });

    it("should maintain separate bus control state from DMA state", () => {
      expect(dma.getDmaState()).toBe(DmaState.IDLE);
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
    });
  });

  describe("Bus Request (BUSREQ)", () => {
    it("should assert BUSREQ when requestBus() is called", () => {
      dma.requestBus();
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(true);
      expect(busControl.busAcknowledged).toBe(false);
    });

    it("should not change BUSREQ if already requested", () => {
      dma.requestBus();
      dma.requestBus();
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(true);
    });

    it("should clear BUSAK when requesting bus again", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      expect(dma.getBusControl().busAcknowledged).toBe(true);
      
      // Request again (simulating re-request scenario)
      dma.releaseBus();
      dma.requestBus();
      expect(dma.getBusControl().busAcknowledged).toBe(false);
    });
  });

  describe("Bus Acknowledge (BUSAK)", () => {
    it("should acknowledge bus only if it was requested", () => {
      dma.acknowledgeBus();
      expect(dma.getBusControl().busAcknowledged).toBe(false);
    });

    it("should acknowledge bus after request", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(true);
      expect(busControl.busAcknowledged).toBe(true);
    });

    it("should maintain acknowledged state across multiple calls", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      dma.acknowledgeBus();
      expect(dma.getBusControl().busAcknowledged).toBe(true);
    });
  });

  describe("Bus Release", () => {
    it("should clear both BUSREQ and BUSAK on release", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      dma.releaseBus();
      
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      expect(busControl.busAcknowledged).toBe(false);
    });

    it("should be safe to call release when bus not requested", () => {
      dma.releaseBus();
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(false);
      expect(busControl.busAcknowledged).toBe(false);
    });

    it("should release from requested-only state", () => {
      dma.requestBus();
      dma.releaseBus();
      expect(dma.getBusControl().busRequested).toBe(false);
    });
  });

  describe("Bus Availability Check", () => {
    it("should return false when bus not requested", () => {
      expect(dma.isBusAvailable()).toBe(false);
    });

    it("should return false when requested but not acknowledged", () => {
      dma.requestBus();
      expect(dma.isBusAvailable()).toBe(false);
    });

    it("should return true when requested and acknowledged", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      expect(dma.isBusAvailable()).toBe(true);
    });

    it("should return false when bus is delayed", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      dma.setBusDelay(true);
      expect(dma.isBusAvailable()).toBe(false);
    });

    it("should return true when delay is cleared", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      dma.setBusDelay(true);
      dma.setBusDelay(false);
      expect(dma.isBusAvailable()).toBe(true);
    });

    it("should return false after bus release", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      expect(dma.isBusAvailable()).toBe(true);
      dma.releaseBus();
      expect(dma.isBusAvailable()).toBe(false);
    });
  });

  describe("Bus Delay Signal", () => {
    it("should allow setting bus delay", () => {
      dma.setBusDelay(true);
      expect(dma.getBusControl().busDelayed).toBe(true);
    });

    it("should allow clearing bus delay", () => {
      dma.setBusDelay(true);
      dma.setBusDelay(false);
      expect(dma.getBusControl().busDelayed).toBe(false);
    });

    it("should not affect BUSREQ or BUSAK", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      dma.setBusDelay(true);
      
      const busControl = dma.getBusControl();
      expect(busControl.busRequested).toBe(true);
      expect(busControl.busAcknowledged).toBe(true);
    });

    it("should work independently of bus request state", () => {
      dma.setBusDelay(true);
      expect(dma.getBusControl().busDelayed).toBe(true);
      expect(dma.getBusControl().busRequested).toBe(false);
    });
  });

  describe("Should Request Bus Logic", () => {
    it("should return false when DMA disabled", () => {
      expect(dma.shouldRequestBus()).toBe(false);
    });

    it("should return false when in IDLE state", () => {
      // Even if enabled, should return false when in IDLE
      expect(dma.getDmaState()).toBe(DmaState.IDLE);
      expect(dma.shouldRequestBus()).toBe(false);
    });
  });

  describe("Burst Mode Bus Release", () => {
    it("should not release bus in continuous mode", () => {
      // Set transfer mode to continuous (bit 4 = 1)
      dma.writeWR4(0x95); // WR4: continuous (bit 4 = 1, 0b10010101)
      dma.writeWR4(0x00);
      dma.writeWR4(0x50);
      
      // Verify mode was set
      const registers = dma.getRegisters();
      expect(registers.transferMode).toBe(TransferMode.CONTINUOUS);
      
      // Request and acknowledge bus
      dma.requestBus();
      dma.acknowledgeBus();
      
      // Call releaseBusForBurst - should NOT release in continuous mode
      dma.releaseBusForBurst();
      expect(dma.getBusControl().busRequested).toBe(true);
    });

    it("should release bus in burst mode", () => {
      // Set transfer mode to burst (bit 4 = 0)
      dma.writeWR4(0x85); // WR4: burst (bit 4 = 0, 0b10000101)
      dma.writeWR4(0x00);
      dma.writeWR4(0x50);
      
      // Request and acknowledge bus
      dma.requestBus();
      dma.acknowledgeBus();
      
      // Call releaseBusForBurst - SHOULD release in burst mode
      dma.releaseBusForBurst();
      expect(dma.getBusControl().busRequested).toBe(false);
      expect(dma.getBusControl().busAcknowledged).toBe(false);
    });
  });

  describe("Bus Control Sequences", () => {
    it("should follow complete request-acknowledge-release cycle", () => {
      // Initial state
      expect(dma.isBusAvailable()).toBe(false);
      
      // Request
      dma.requestBus();
      expect(dma.getBusControl().busRequested).toBe(true);
      expect(dma.isBusAvailable()).toBe(false);
      
      // Acknowledge
      dma.acknowledgeBus();
      expect(dma.getBusControl().busAcknowledged).toBe(true);
      expect(dma.isBusAvailable()).toBe(true);
      
      // Release
      dma.releaseBus();
      expect(dma.isBusAvailable()).toBe(false);
    });

    it("should handle delay during transfer", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      expect(dma.isBusAvailable()).toBe(true);
      
      // External device asserts delay
      dma.setBusDelay(true);
      expect(dma.isBusAvailable()).toBe(false);
      
      // Delay cleared
      dma.setBusDelay(false);
      expect(dma.isBusAvailable()).toBe(true);
      
      // Complete transfer
      dma.releaseBus();
      expect(dma.isBusAvailable()).toBe(false);
    });

    it("should allow multiple request cycles", () => {
      for (let i = 0; i < 3; i++) {
        dma.requestBus();
        expect(dma.getBusControl().busRequested).toBe(true);
        
        dma.acknowledgeBus();
        expect(dma.isBusAvailable()).toBe(true);
        
        dma.releaseBus();
        expect(dma.isBusAvailable()).toBe(false);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle acknowledge before request gracefully", () => {
      dma.acknowledgeBus();
      expect(dma.getBusControl().busAcknowledged).toBe(false);
      expect(dma.isBusAvailable()).toBe(false);
    });

    it("should handle multiple releases gracefully", () => {
      dma.requestBus();
      dma.acknowledgeBus();
      dma.releaseBus();
      dma.releaseBus();
      dma.releaseBus();
      expect(dma.getBusControl().busRequested).toBe(false);
    });

    it("should handle delay toggle without bus request", () => {
      dma.setBusDelay(true);
      dma.setBusDelay(false);
      dma.setBusDelay(true);
      expect(dma.getBusControl().busDelayed).toBe(true);
    });

    it("should preserve delay state across bus cycles", () => {
      dma.setBusDelay(true);
      dma.requestBus();
      expect(dma.getBusControl().busDelayed).toBe(true);
      
      dma.acknowledgeBus();
      expect(dma.getBusControl().busDelayed).toBe(true);
      
      dma.releaseBus();
      expect(dma.getBusControl().busDelayed).toBe(true);
    });
  });
});
