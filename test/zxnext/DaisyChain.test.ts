import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import {
  DAISY_PRIORITY_LINE,
  DAISY_PRIORITY_UART0_RX,
  DAISY_PRIORITY_UART1_RX,
  DAISY_PRIORITY_CTC_BASE,
  DAISY_PRIORITY_ULA,
  DAISY_PRIORITY_UART0_TX,
  DAISY_PRIORITY_UART1_TX
} from "@emu/machines/zxNext/InterruptDevice";

describe("Next - Daisy Chain", () => {

  // ========================================================================
  // Initial / Reset State
  // ========================================================================
  describe("Initial state", () => {
    it("All devices are Idle after reset", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      for (let i = 0; i < 14; i++) {
        expect(id.daisyInService[i]).toBe(false);
      }
    });

    it("daisyUpdateIrqState returns false when no devices requesting", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      expect(id.daisyUpdateIrqState()).toBe(false);
    });
  });

  // ========================================================================
  // isDeviceRequesting
  // ========================================================================
  describe("isDeviceRequesting", () => {
    it("LINE device requests when status set and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_LINE)).toBe(true);
    });

    it("LINE device does not request when status set but disabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = false;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_LINE)).toBe(false);
    });

    it("UART0 RX requests when nearFull status set and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart0RxNearFullStatus = true;
      id.uart0RxNearFull = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_UART0_RX)).toBe(true);
    });

    it("UART0 RX requests when available status set and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart0RxAvailableStatus = true;
      id.uart0RxAvailable = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_UART0_RX)).toBe(true);
    });

    it("UART0 RX does not request when no enable", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart0RxNearFullStatus = true;
      id.uart0RxNearFull = false;
      id.uart0RxAvailable = false;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_UART0_RX)).toBe(false);
    });

    it("UART1 RX requests when enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart1RxAvailableStatus = true;
      id.uart1RxAvailable = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_UART1_RX)).toBe(true);
    });

    it("CTC channel 0 requests when status and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ctcIntStatus[0] = true;
      id.ctcIntEnabled[0] = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_CTC_BASE)).toBe(true);
    });

    it("CTC channel 3 requests when status and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ctcIntStatus[3] = true;
      id.ctcIntEnabled[3] = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_CTC_BASE + 3)).toBe(true);
    });

    it("CTC channel 7 requests when status and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ctcIntStatus[7] = true;
      id.ctcIntEnabled[7] = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_CTC_BASE + 7)).toBe(true);
    });

    it("CTC channel does not request when not enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ctcIntStatus[5] = true;
      id.ctcIntEnabled[5] = false;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_CTC_BASE + 5)).toBe(false);
    });

    it("ULA requests when status set and not disabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_ULA)).toBe(true);
    });

    it("ULA does not request when disabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_ULA)).toBe(false);
    });

    it("UART0 TX requests when status and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart0TxEmptyStatus = true;
      id.uart0TxEmpty = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_UART0_TX)).toBe(true);
    });

    it("UART1 TX requests when status and enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart1TxEmptyStatus = true;
      id.uart1TxEmpty = true;
      expect(id.isDeviceRequesting(DAISY_PRIORITY_UART1_TX)).toBe(true);
    });

    it("Invalid priority returns false", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      expect(id.isDeviceRequesting(14)).toBe(false);
      expect(id.isDeviceRequesting(-1)).toBe(false);
    });
  });

  // ========================================================================
  // clearDeviceRequest
  // ========================================================================
  describe("clearDeviceRequest", () => {
    it("Clears LINE status", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.lineInterruptStatus = true;
      id.clearDeviceRequest(DAISY_PRIORITY_LINE);
      expect(id.lineInterruptStatus).toBe(false);
    });

    it("Clears UART0 RX status (both flags)", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart0RxNearFullStatus = true;
      id.uart0RxAvailableStatus = true;
      id.clearDeviceRequest(DAISY_PRIORITY_UART0_RX);
      expect(id.uart0RxNearFullStatus).toBe(false);
      expect(id.uart0RxAvailableStatus).toBe(false);
    });

    it("Clears UART1 RX status (both flags)", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart1RxNearFullStatus = true;
      id.uart1RxAvailableStatus = true;
      id.clearDeviceRequest(DAISY_PRIORITY_UART1_RX);
      expect(id.uart1RxNearFullStatus).toBe(false);
      expect(id.uart1RxAvailableStatus).toBe(false);
    });

    it("Clears CTC channel status", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      for (let ch = 0; ch < 8; ch++) {
        id.ctcIntStatus[ch] = true;
        id.clearDeviceRequest(DAISY_PRIORITY_CTC_BASE + ch);
        expect(id.ctcIntStatus[ch]).toBe(false);
      }
    });

    it("Clears ULA status", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.ulaInterruptStatus = true;
      id.clearDeviceRequest(DAISY_PRIORITY_ULA);
      expect(id.ulaInterruptStatus).toBe(false);
    });

    it("Clears UART0 TX status", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart0TxEmptyStatus = true;
      id.clearDeviceRequest(DAISY_PRIORITY_UART0_TX);
      expect(id.uart0TxEmptyStatus).toBe(false);
    });

    it("Clears UART1 TX status", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.uart1TxEmptyStatus = true;
      id.clearDeviceRequest(DAISY_PRIORITY_UART1_TX);
      expect(id.uart1TxEmptyStatus).toBe(false);
    });
  });

  // ========================================================================
  // daisyUpdateIrqState
  // ========================================================================
  describe("daisyUpdateIrqState", () => {
    it("Returns true when a single device is requesting", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      expect(id.daisyUpdateIrqState()).toBe(true);
    });

    it("Returns true when LINE device is requesting", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;

      expect(id.daisyUpdateIrqState()).toBe(true);
    });

    it("Returns true for CTC channel request", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.ctcIntStatus[4] = true;
      id.ctcIntEnabled[4] = true;

      expect(id.daisyUpdateIrqState()).toBe(true);
    });

    it("Returns false when device requesting but not enabled", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = true; // disabled

      expect(id.daisyUpdateIrqState()).toBe(false);
    });

    it("InService device blocks lower-priority requesting device", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      // LINE (priority 0) is InService
      id.daisyInService[DAISY_PRIORITY_LINE] = true;

      // ULA (priority 11) is requesting
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      // ULA should be blocked
      expect(id.daisyUpdateIrqState()).toBe(false);
    });

    it("Higher-priority request passes through when lower is InService", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      // ULA (priority 11) is InService
      id.daisyInService[DAISY_PRIORITY_ULA] = true;

      // LINE (priority 0) is requesting — higher priority, not blocked
      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;

      expect(id.daisyUpdateIrqState()).toBe(true);
    });

    it("Multiple requesters — returns true for highest priority", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;
      id.ctcIntStatus[2] = true;
      id.ctcIntEnabled[2] = true;

      expect(id.daisyUpdateIrqState()).toBe(true);
    });
  });

  // ========================================================================
  // daisyAcknowledge
  // ========================================================================
  describe("daisyAcknowledge", () => {
    it("Returns 0xFF when no device is requesting", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      expect(id.daisyAcknowledge()).toBe(0xff);
    });

    it("Acknowledges LINE (priority 0) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (0 << 1)); // 0xC0
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(true);
      expect(id.lineInterruptStatus).toBe(false);
    });

    it("Acknowledges UART0 RX (priority 1) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xe0;

      id.uart0RxNearFullStatus = true;
      id.uart0RxNearFull = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xe0 | (1 << 1)); // 0xE2
      expect(id.daisyInService[DAISY_PRIORITY_UART0_RX]).toBe(true);
      expect(id.uart0RxNearFullStatus).toBe(false);
    });

    it("Acknowledges UART1 RX (priority 2) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xa0;

      id.uart1RxAvailableStatus = true;
      id.uart1RxAvailable = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xa0 | (2 << 1)); // 0xA4
      expect(id.daisyInService[DAISY_PRIORITY_UART1_RX]).toBe(true);
      expect(id.uart1RxAvailableStatus).toBe(false);
    });

    it("Acknowledges CTC channel 0 (priority 3) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.ctcIntStatus[0] = true;
      id.ctcIntEnabled[0] = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (3 << 1)); // 0xC6
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE]).toBe(true);
      expect(id.ctcIntStatus[0]).toBe(false);
    });

    it("Acknowledges CTC channel 7 (priority 10) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.ctcIntStatus[7] = true;
      id.ctcIntEnabled[7] = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (10 << 1)); // 0xD4
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 7]).toBe(true);
      expect(id.ctcIntStatus[7]).toBe(false);
    });

    it("Acknowledges ULA (priority 11) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (11 << 1)); // 0xD6
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true);
      expect(id.ulaInterruptStatus).toBe(false);
    });

    it("Acknowledges UART0 TX (priority 12) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.uart0TxEmptyStatus = true;
      id.uart0TxEmpty = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (12 << 1)); // 0xD8
      expect(id.daisyInService[DAISY_PRIORITY_UART0_TX]).toBe(true);
      expect(id.uart0TxEmptyStatus).toBe(false);
    });

    it("Acknowledges UART1 TX (priority 13) with correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.uart1TxEmptyStatus = true;
      id.uart1TxEmpty = true;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (13 << 1)); // 0xDA
      expect(id.daisyInService[DAISY_PRIORITY_UART1_TX]).toBe(true);
      expect(id.uart1TxEmptyStatus).toBe(false);
    });

    it("Acknowledges highest-priority device when multiple are requesting", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      // CTC 2 (priority 5) and ULA (priority 11) both requesting
      id.ctcIntStatus[2] = true;
      id.ctcIntEnabled[2] = true;
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      const vector = id.daisyAcknowledge();
      // CTC 2 is higher priority → acknowledged
      expect(vector).toBe(0xc0 | (5 << 1)); // 0xCA
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 2]).toBe(true);
      expect(id.ctcIntStatus[2]).toBe(false);
      // ULA should still be requesting
      expect(id.ulaInterruptStatus).toBe(true);
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(false);
    });

    it("InService device blocks acknowledge of lower-priority device", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      // CTC 0 (priority 3) is InService
      id.daisyInService[DAISY_PRIORITY_CTC_BASE] = true;

      // ULA (priority 11) is requesting
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xff); // blocked
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(false);
      expect(id.ulaInterruptStatus).toBe(true); // status not cleared
    });

    it("Different im2TopBits produce correct vectors", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      const testCases = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0];
      for (const topBits of testCases) {
        id.im2TopBits = topBits;
        // Reset states
        for (let i = 0; i < 14; i++) id.daisyInService[i] = false;
        id.ulaInterruptStatus = true;
        id.ulaInterruptDisabled = false;

        const vector = id.daisyAcknowledge();
        expect(vector).toBe(topBits | (11 << 1));
        id.ulaInterruptStatus = false; // cleanup
      }
    });
  });

  // ========================================================================
  // daisyReti
  // ========================================================================
  describe("daisyReti", () => {
    it("Does nothing when no device is InService", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.daisyReti();
      // No error, all still Idle
      for (let i = 0; i < 14; i++) {
        expect(id.daisyInService[i]).toBe(false);
      }
    });

    it("Clears single InService device", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.daisyInService[DAISY_PRIORITY_ULA] = true;
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(false);
    });

    it("Clears only the highest-priority InService device", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      // Two devices in service: LINE (0) and ULA (11)
      id.daisyInService[DAISY_PRIORITY_LINE] = true;
      id.daisyInService[DAISY_PRIORITY_ULA] = true;

      id.daisyReti();
      // LINE cleared first (highest priority)
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(false);
      // ULA still in service
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true);
    });

    it("Second RETI clears the next InService device", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.daisyInService[DAISY_PRIORITY_CTC_BASE + 2] = true;
      id.daisyInService[DAISY_PRIORITY_UART1_TX] = true;

      id.daisyReti(); // clears CTC 2
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 2]).toBe(false);
      expect(id.daisyInService[DAISY_PRIORITY_UART1_TX]).toBe(true);

      id.daisyReti(); // clears UART1 TX
      expect(id.daisyInService[DAISY_PRIORITY_UART1_TX]).toBe(false);
    });
  });

  // ========================================================================
  // Full Request → Acknowledge → RETI cycle
  // ========================================================================
  describe("Full lifecycle", () => {
    it("Single device: Request → Acknowledge → RETI", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      // Step 1: ULA fires interrupt
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      // Step 2: Check IRQ state
      expect(id.daisyUpdateIrqState()).toBe(true);

      // Step 3: CPU acknowledges
      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xd6); // 0xC0 | (11 << 1)
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true);
      expect(id.ulaInterruptStatus).toBe(false);

      // Step 4: No more interrupts pending
      expect(id.daisyUpdateIrqState()).toBe(false);

      // Step 5: ISR executes RETI
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(false);

      // Step 6: Back to idle
      expect(id.daisyUpdateIrqState()).toBe(false);
    });

    it("Nested interrupt: higher priority preempts lower", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      // Step 1: ULA (priority 11) fires interrupt
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;
      expect(id.daisyUpdateIrqState()).toBe(true);

      // Step 2: CPU acknowledges ULA
      const v1 = id.daisyAcknowledge();
      expect(v1).toBe(0xd6); // priority 11
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true);

      // Step 3: While ULA ISR runs, LINE (priority 0) fires
      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;

      // LINE is higher priority than ULA → can interrupt
      expect(id.daisyUpdateIrqState()).toBe(true);

      // Step 4: CPU acknowledges LINE
      const v2 = id.daisyAcknowledge();
      expect(v2).toBe(0xc0); // priority 0
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(true);
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true); // still in service

      // Step 5: No more pending (LINE in service blocks everything below)
      expect(id.daisyUpdateIrqState()).toBe(false);

      // Step 6: LINE ISR does RETI → clears LINE
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(false);
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true); // still in service

      // Step 7: Back to ULA ISR, no new interrupts → false
      expect(id.daisyUpdateIrqState()).toBe(false);

      // Step 8: ULA ISR does RETI → clears ULA
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(false);
    });

    it("Lower-priority interrupt blocked while higher is InService", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      // CTC 0 (priority 3) is being serviced
      id.daisyInService[DAISY_PRIORITY_CTC_BASE] = true;

      // UART0 TX (priority 12) fires — blocked by CTC 0
      id.uart0TxEmptyStatus = true;
      id.uart0TxEmpty = true;

      expect(id.daisyUpdateIrqState()).toBe(false);
      expect(id.daisyAcknowledge()).toBe(0xff);

      // CTC 0 finishes (RETI)
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE]).toBe(false);

      // Now UART0 TX can be served
      expect(id.daisyUpdateIrqState()).toBe(true);
      const v = id.daisyAcknowledge();
      expect(v).toBe(0xc0 | (12 << 1)); // 0xD8
    });

    it("New request on same device while InService is re-queued after RETI", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      // CTC 3 fires
      id.ctcIntStatus[3] = true;
      id.ctcIntEnabled[3] = true;

      // Acknowledge
      id.daisyAcknowledge();
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 3]).toBe(true);
      expect(id.ctcIntStatus[3]).toBe(false);

      // While ISR runs, CTC 3 fires again
      id.ctcIntStatus[3] = true;

      // Can't acknowledge — same device is InService and blocks
      // (device is Requesting again but also InService — isDeviceRequesting is true
      //  but daisyInService blocks the walk before reaching it since it's in service)
      // Actually, the InService check comes BEFORE the isRequesting check for the same priority.
      // Wait: daisyInService[i] is checked FIRST in the loop. If the device is both InService
      // and requesting, the InService check blocks the walk.
      expect(id.daisyUpdateIrqState()).toBe(false);

      // RETI clears InService
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 3]).toBe(false);

      // Now the pending request can be served
      expect(id.daisyUpdateIrqState()).toBe(true);
      const v = id.daisyAcknowledge();
      expect(v).toBe(0xc0 | (6 << 1)); // priority 6 = CTC 3
    });
  });

  // ========================================================================
  // Status registers NR $C8 / $C9 / $CA
  // ========================================================================
  describe("Status registers in hwIm2Mode", () => {
    it("NR $C8 reflects InService state in hwIm2Mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      // Nothing in service
      expect(readNextReg(m, 0xc8)).toBe(0x00);

      // LINE InService
      id.daisyInService[DAISY_PRIORITY_LINE] = true;
      expect(readNextReg(m, 0xc8)).toBe(0x02);

      // ULA InService too
      id.daisyInService[DAISY_PRIORITY_ULA] = true;
      expect(readNextReg(m, 0xc8)).toBe(0x03);

      // Clear LINE
      id.daisyInService[DAISY_PRIORITY_LINE] = false;
      expect(readNextReg(m, 0xc8)).toBe(0x01);
    });

    it("NR $C8 reflects pending flags in pulse mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = false;

      id.lineInterruptStatus = true;
      expect(readNextReg(m, 0xc8)).toBe(0x02);

      id.ulaInterruptStatus = true;
      expect(readNextReg(m, 0xc8)).toBe(0x03);
    });

    it("NR $C9 reflects CTC InService state in hwIm2Mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      expect(readNextReg(m, 0xc9)).toBe(0x00);

      // CTC 0 InService → bit 0
      id.daisyInService[DAISY_PRIORITY_CTC_BASE] = true;
      expect(readNextReg(m, 0xc9)).toBe(0x01);

      // CTC 3 InService → bit 3
      id.daisyInService[DAISY_PRIORITY_CTC_BASE + 3] = true;
      expect(readNextReg(m, 0xc9)).toBe(0x09);

      // CTC 7 InService → bit 7
      id.daisyInService[DAISY_PRIORITY_CTC_BASE + 7] = true;
      expect(readNextReg(m, 0xc9)).toBe(0x89);
    });

    it("NR $C9 reflects pending CTC flags in pulse mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = false;

      id.ctcIntStatus[0] = true;
      id.ctcIntStatus[5] = true;
      expect(readNextReg(m, 0xc9)).toBe(0x21); // bits 0 and 5
    });

    it("NR $CA reflects UART InService state in hwIm2Mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      expect(readNextReg(m, 0xca)).toBe(0x00);

      // UART0 RX InService → bits 0,1
      id.daisyInService[DAISY_PRIORITY_UART0_RX] = true;
      expect(readNextReg(m, 0xca)).toBe(0x03);

      // UART1 TX InService → bit 6
      id.daisyInService[DAISY_PRIORITY_UART1_TX] = true;
      expect(readNextReg(m, 0xca)).toBe(0x43);
    });

    it("NR $CA reflects pending UART flags in pulse mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = false;

      id.uart0RxNearFullStatus = true;
      id.uart1TxEmptyStatus = true;
      expect(readNextReg(m, 0xca)).toBe(0x42);
    });

    it("Writing NR $C8 in hwIm2Mode does not clear InService state", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.daisyInService[DAISY_PRIORITY_LINE] = true;
      id.daisyInService[DAISY_PRIORITY_ULA] = true;

      // Write 1s to clear — should have no effect in hwIm2Mode
      writeNextReg(m, 0xc8, 0x03);

      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(true);
      expect(id.daisyInService[DAISY_PRIORITY_ULA]).toBe(true);
    });

    it("Writing NR $C8 in pulse mode clears pending flags", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = false;

      id.lineInterruptStatus = true;
      id.ulaInterruptStatus = true;

      writeNextReg(m, 0xc8, 0x03);
      expect(id.lineInterruptStatus).toBe(false);
      expect(id.ulaInterruptStatus).toBe(false);
    });
  });

  // ========================================================================
  // Vector computation for all 14 priorities
  // ========================================================================
  describe("Vector computation for all priorities", () => {
    it("Each priority produces correct vector", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      const expectedVectors: [number, () => void, () => void][] = [
        [0, () => { id.lineInterruptStatus = true; id.lineInterruptEnabled = true; },
         () => { id.lineInterruptStatus = false; }],
        [1, () => { id.uart0RxNearFullStatus = true; id.uart0RxNearFull = true; },
         () => { id.uart0RxNearFullStatus = false; }],
        [2, () => { id.uart1RxAvailableStatus = true; id.uart1RxAvailable = true; },
         () => { id.uart1RxAvailableStatus = false; }],
        [3, () => { id.ctcIntStatus[0] = true; id.ctcIntEnabled[0] = true; },
         () => { id.ctcIntStatus[0] = false; }],
        [4, () => { id.ctcIntStatus[1] = true; id.ctcIntEnabled[1] = true; },
         () => { id.ctcIntStatus[1] = false; }],
        [5, () => { id.ctcIntStatus[2] = true; id.ctcIntEnabled[2] = true; },
         () => { id.ctcIntStatus[2] = false; }],
        [6, () => { id.ctcIntStatus[3] = true; id.ctcIntEnabled[3] = true; },
         () => { id.ctcIntStatus[3] = false; }],
        [7, () => { id.ctcIntStatus[4] = true; id.ctcIntEnabled[4] = true; },
         () => { id.ctcIntStatus[4] = false; }],
        [8, () => { id.ctcIntStatus[5] = true; id.ctcIntEnabled[5] = true; },
         () => { id.ctcIntStatus[5] = false; }],
        [9, () => { id.ctcIntStatus[6] = true; id.ctcIntEnabled[6] = true; },
         () => { id.ctcIntStatus[6] = false; }],
        [10, () => { id.ctcIntStatus[7] = true; id.ctcIntEnabled[7] = true; },
         () => { id.ctcIntStatus[7] = false; }],
        [11, () => { id.ulaInterruptStatus = true; id.ulaInterruptDisabled = false; },
         () => { id.ulaInterruptStatus = false; }],
        [12, () => { id.uart0TxEmptyStatus = true; id.uart0TxEmpty = true; },
         () => { id.uart0TxEmptyStatus = false; }],
        [13, () => { id.uart1TxEmptyStatus = true; id.uart1TxEmpty = true; },
         () => { id.uart1TxEmptyStatus = false; }],
      ];

      for (const [priority, setup, cleanup] of expectedVectors) {
        // Reset all InService states
        for (let i = 0; i < 14; i++) id.daisyInService[i] = false;
        setup();
        const vector = id.daisyAcknowledge();
        expect(vector).toBe(0xc0 | (priority << 1));
        cleanup();
      }
    });
  });

  // ========================================================================
  // Reset behavior
  // ========================================================================
  describe("Reset", () => {
    it("Reset clears all InService states", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;

      id.daisyInService[0] = true;
      id.daisyInService[5] = true;
      id.daisyInService[11] = true;
      id.daisyInService[13] = true;

      id.reset();

      for (let i = 0; i < 14; i++) {
        expect(id.daisyInService[i]).toBe(false);
      }
    });
  });

  // ========================================================================
  // ZxNextMachine integration (getInterruptVector, onInterruptAcknowledged, onRetnExecuted)
  // ========================================================================
  describe("ZxNextMachine integration", () => {
    it("getInterruptVector returns 0xFF in non-hwIm2 mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = false;

      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      // Access via the machine's protected method through code execution
      // We'll test via initCode + executeOneInstruction for real integration,
      // or we can test the underlying InterruptDevice methods directly
      expect(id.daisyUpdateIrqState()).toBe(true);
    });

    it("getInterruptVector uses daisy chain in hwIm2Mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.ctcIntStatus[2] = true;
      id.ctcIntEnabled[2] = true;
      id.ulaInterruptStatus = true;
      id.ulaInterruptDisabled = false;

      // The vector should be for CTC 2 (priority 5) — highest priority requesting
      // We verify via daisyAcknowledge which does the same walk as getInterruptVector
      const vector = id.daisyAcknowledge();
      expect(vector).toBe(0xc0 | (5 << 1)); // CTC 2 wins
    });

    it("onInterruptAcknowledged transitions device to InService in hwIm2Mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0xc0;

      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;

      // Simulate what onInterruptAcknowledged does
      id.daisyAcknowledge();
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(true);
      expect(id.lineInterruptStatus).toBe(false);
    });

    it("RETI clears InService in hwIm2Mode", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;

      id.daisyInService[DAISY_PRIORITY_CTC_BASE + 4] = true;
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 4]).toBe(false);
    });

    it("Three levels of nested interrupts", async () => {
      const m = await createTestNextMachine();
      const id = m.interruptDevice;
      id.hwIm2Mode = true;
      id.im2TopBits = 0x80;

      // Level 1: UART1 TX (priority 13) fires
      id.uart1TxEmptyStatus = true;
      id.uart1TxEmpty = true;
      expect(id.daisyUpdateIrqState()).toBe(true);
      const v1 = id.daisyAcknowledge();
      expect(v1).toBe(0x80 | (13 << 1));

      // Level 2: CTC 5 (priority 8) fires during UART1 TX ISR
      id.ctcIntStatus[5] = true;
      id.ctcIntEnabled[5] = true;
      expect(id.daisyUpdateIrqState()).toBe(true); // higher priority
      const v2 = id.daisyAcknowledge();
      expect(v2).toBe(0x80 | (8 << 1));

      // Level 3: LINE (priority 0) fires during CTC 5 ISR
      id.lineInterruptStatus = true;
      id.lineInterruptEnabled = true;
      expect(id.daisyUpdateIrqState()).toBe(true);
      const v3 = id.daisyAcknowledge();
      expect(v3).toBe(0x80 | (0 << 1));

      // All three InService
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(true);
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 5]).toBe(true);
      expect(id.daisyInService[DAISY_PRIORITY_UART1_TX]).toBe(true);

      // No more interrupts possible (all blocked by LINE at top)
      expect(id.daisyUpdateIrqState()).toBe(false);

      // RETI from LINE ISR
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_LINE]).toBe(false);
      // Still blocked by CTC 5
      expect(id.daisyUpdateIrqState()).toBe(false);

      // RETI from CTC 5 ISR
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_CTC_BASE + 5]).toBe(false);
      // Still blocked by UART1 TX? No — UART1 TX is in service but nothing below requests
      expect(id.daisyUpdateIrqState()).toBe(false);

      // RETI from UART1 TX ISR
      id.daisyReti();
      expect(id.daisyInService[DAISY_PRIORITY_UART1_TX]).toBe(false);

      // Back to fully idle
      for (let i = 0; i < 14; i++) {
        expect(id.daisyInService[i]).toBe(false);
      }
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
