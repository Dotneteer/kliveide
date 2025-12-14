import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

describe("Next - InterrputDevice", function () {
  describe("Reg $02 - Control Register 1", () => {
    it("busResetRequested #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x02, 0x80);

      // --- Assert
      const value = readNextReg(m, 0x02);
      expect(value).toBe(0x82);
      expect(intDevice.busResetRequested).toBe(true);
      expect(intDevice.mfNmiByIoTrap).toBe(false);
      expect(intDevice.mfNmiByNextReg).toBe(false);
      expect(intDevice.divMccNmiBtNextReg).toBe(false);
      expect(intDevice.lastWasHardReset).toBe(true);
      expect(intDevice.lastWasSoftReset).toBe(false);
    });

    it("busResetRequested #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.lastWasHardReset = false;

      // --- Act
      writeNextReg(m, 0x02, 0xff);

      // --- Assert
      const value = readNextReg(m, 0x02);
      expect(value).toBe(0x80);
      expect(intDevice.busResetRequested).toBe(true);
      expect(intDevice.mfNmiByIoTrap).toBe(false);
      expect(intDevice.mfNmiByNextReg).toBe(false);
      expect(intDevice.divMccNmiBtNextReg).toBe(false);
      expect(intDevice.lastWasHardReset).toBe(false);
      expect(intDevice.lastWasSoftReset).toBe(false);
    });

    it("busResetRequested #3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x02, 0x80);

      // --- Assert
      const value = readNextReg(m, 0x02);
      expect(value).toBe(0x82);
      expect(intDevice.busResetRequested).toBe(true);
      expect(intDevice.mfNmiByIoTrap).toBe(false);
      expect(intDevice.mfNmiByNextReg).toBe(false);
      expect(intDevice.divMccNmiBtNextReg).toBe(false);
      expect(intDevice.lastWasHardReset).toBe(true);
      expect(intDevice.lastWasSoftReset).toBe(false);
    });
  });

  describe("Reg $22 - Line interrupt control", () => {
    it("intSignalActive", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x22, 0x80);

      // --- Assert
      expect(readNextReg(m, 0x22)).toBe(0x80);
      expect(intDevice.intSignalActive).toBe(true);
      expect(intDevice.ulaInterruptDisabled).toBe(false);
      expect(intDevice.lineInterruptEnabled).toBe(false);
      expect(intDevice.lineInterrupt).toBe(0x00);
    });

    it("ulaInterruptDisabled", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x22, 0x04);

      // --- Assert
      expect(readNextReg(m, 0x22)).toBe(0x04);
      expect(intDevice.intSignalActive).toBe(false);
      expect(intDevice.ulaInterruptDisabled).toBe(true);
      expect(intDevice.lineInterruptEnabled).toBe(false);
      expect(intDevice.lineInterrupt).toBe(0x00);
      expect(readNextReg(m, 0xc4) & 0x01).toBe(0x01);
    });

    it("lineInteeruptEnabled", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x22, 0x02);

      // --- Assert
      expect(readNextReg(m, 0x22)).toBe(0x02);
      expect(intDevice.intSignalActive).toBe(false);
      expect(intDevice.ulaInterruptDisabled).toBe(false);
      expect(intDevice.lineInterruptEnabled).toBe(true);
      expect(intDevice.lineInterrupt).toBe(0x00);
      expect(readNextReg(m, 0xc4) & 0x02).toBe(0x02);
    });

    it("lineInterruptMsb", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x22, 0x01);

      // --- Assert
      expect(readNextReg(m, 0x22)).toBe(0x01);
      expect(intDevice.intSignalActive).toBe(false);
      expect(intDevice.ulaInterruptDisabled).toBe(false);
      expect(intDevice.lineInterruptEnabled).toBe(false);
      expect(intDevice.lineInterrupt).toBe(0x100);
    });

    it("all bit 1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0x22, 0xff);

      // --- Assert
      expect(readNextReg(m, 0x22)).toBe(0x87);
      expect(intDevice.intSignalActive).toBe(true);
      expect(intDevice.ulaInterruptDisabled).toBe(true);
      expect(intDevice.lineInterruptEnabled).toBe(true);
      expect(intDevice.lineInterrupt).toBe(0x100);
    });

    it("ulaDisableInterrupt alias in $c4 #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      writeNextReg(m, 0xc4, 0x00);

      // --- Act
      writeNextReg(m, 0x22, 0x04);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x01);
    });

    it("ulaDisableInterrupt alias in $c4 #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      writeNextReg(m, 0xc4, 0x00);

      // --- Act
      writeNextReg(m, 0x22, 0x00);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x00);
    });

    it("lineEnableInterrupt alias in $c4 #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      writeNextReg(m, 0xc4, 0x00);

      // --- Act
      writeNextReg(m, 0x22, 0x06);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x03);
    });

    it("lineEnableInterrupt alias in $c4 #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      writeNextReg(m, 0xc4, 0x00);

      // --- Act
      writeNextReg(m, 0x22, 0x02);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x02);
    });
  });

  describe("Reg $23 - Line interrupt value MSB", () => {
    it("read", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      const value = readNextReg(m, 0x23);

      // --- Assert
      expect(value).toBe(0x00);
    });

    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      writeNextReg(m, 0x23, 0x5a);

      // --- Assert
      expect(readNextReg(m, 0x23)).toBe(0x5a);
    });
  });

  describe("Reg $c0 - Interrupt control", () => {
    it("im2TopBits", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc0, 0xe0);

      // --- Assert
      expect(readNextReg(m, 0xc0)).toBe(0xe0);
      expect(intDevice.im2TopBits).toBe(0xe0);
      expect(intDevice.enableStacklessNmi).toBe(false);
      expect(intDevice.hwIm2Mode).toBe(false);
    });

    it("enableStacklessNmi", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc0, 0x08);

      // --- Assert
      expect(readNextReg(m, 0xc0)).toBe(0x08);
      expect(intDevice.im2TopBits).toBe(0x00);
      expect(intDevice.enableStacklessNmi).toBe(true);
      expect(intDevice.hwIm2Mode).toBe(false);
    });

    it("hwIm2Mode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);

      // --- Assert
      expect(readNextReg(m, 0xc0)).toBe(0x01);
      expect(intDevice.im2TopBits).toBe(0x00);
      expect(intDevice.enableStacklessNmi).toBe(false);
      expect(intDevice.hwIm2Mode).toBe(true);
    });

    it("currentInterruptMode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      m.interruptMode = 0x01;

      // --- Act
      m.interruptMode = 0x01;

      // --- Assert
      expect(readNextReg(m, 0xc0)).toBe(0x02);
      expect(intDevice.currentInterruptMode).toBe(0x01);
    });
  });

  describe("Reg $c2 - NMI return address LSB", () => {
    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc2, 0xa5);

      // --- Assert
      expect(readNextReg(m, 0xc2)).toBe(0xa5);
    });
  });

  describe("Reg $c3 - NMI return address MSB", () => {
    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc3, 0xa5);

      // --- Assert
      expect(readNextReg(m, 0xc3)).toBe(0xa5);
    });
  });

  describe("Reg $c4 - Interrupt enable 0", () => {
    it("write #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc4, 0x80);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x80);
      expect(intDevice.ulaInterruptDisabled).toBe(false);
      expect(intDevice.lineInterruptEnabled).toBe(false);
      expect(readNextReg(m, 0x22) & 0x04).toBe(0x00);
      expect(readNextReg(m, 0x22) & 0x02).toBe(0x00);
    });

    it("write #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc4, 0x81);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x81);
      expect(intDevice.ulaInterruptDisabled).toBe(true);
      expect(intDevice.lineInterruptEnabled).toBe(false);
      expect(readNextReg(m, 0x22) & 0x04).toBe(0x04);
      expect(readNextReg(m, 0x22) & 0x02).toBe(0x00);
    });

    it("write #3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc4, 0x02);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x02);
      expect(intDevice.ulaInterruptDisabled).toBe(false);
      expect(intDevice.lineInterruptEnabled).toBe(true);
      expect(readNextReg(m, 0x22) & 0x04).toBe(0x00);
      expect(readNextReg(m, 0x22) & 0x02).toBe(0x02);
    });

    it("write #4", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc4, 0x03);

      // --- Assert
      expect(readNextReg(m, 0xc4)).toBe(0x03);
      expect(intDevice.ulaInterruptDisabled).toBe(true);
      expect(intDevice.lineInterruptEnabled).toBe(true);
      expect(readNextReg(m, 0x22) & 0x04).toBe(0x04);
      expect(readNextReg(m, 0x22) & 0x02).toBe(0x02);
    });
  });

  describe("Reg $c5 - Interrupt enable 1", () => {
    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc5, 0xa5);

      // --- Assert
      expect(readNextReg(m, 0xc5)).toBe(0xa5);
      expect(intDevice.ctcIntEnabled[7]).toBe(true);
      expect(intDevice.ctcIntEnabled[6]).toBe(false);
      expect(intDevice.ctcIntEnabled[5]).toBe(true);
      expect(intDevice.ctcIntEnabled[4]).toBe(false);
      expect(intDevice.ctcIntEnabled[3]).toBe(false);
      expect(intDevice.ctcIntEnabled[2]).toBe(true);
      expect(intDevice.ctcIntEnabled[1]).toBe(false);
      expect(intDevice.ctcIntEnabled[0]).toBe(true);
    });
  });

  describe("Reg $c6 - Interrupt enable 2", () => {
    it("uart1TxEmpty", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc6, 0x40);

      // --- Assert
      expect(readNextReg(m, 0xc6)).toBe(0x40);
      expect(intDevice.uart1TxEmpty).toBe(true);
      expect(intDevice.uart1RxNearFull).toBe(false);
      expect(intDevice.uart1RxAvailable).toBe(false);
      expect(intDevice.uart0TxEmpty).toBe(false);
      expect(intDevice.uart0RxNearFull).toBe(false);
      expect(intDevice.uart0RxAvailable).toBe(false);
    });

    it("uart1TxNearFull", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc6, 0x20);

      // --- Assert
      expect(readNextReg(m, 0xc6)).toBe(0x20);
      expect(intDevice.uart1TxEmpty).toBe(false);
      expect(intDevice.uart1RxNearFull).toBe(true);
      expect(intDevice.uart1RxAvailable).toBe(false);
      expect(intDevice.uart0TxEmpty).toBe(false);
      expect(intDevice.uart0RxNearFull).toBe(false);
      expect(intDevice.uart0RxAvailable).toBe(false);
    });

    it("uart1TxAvailable", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc6, 0x10);

      // --- Assert
      expect(readNextReg(m, 0xc6)).toBe(0x10);
      expect(intDevice.uart1TxEmpty).toBe(false);
      expect(intDevice.uart1RxNearFull).toBe(false);
      expect(intDevice.uart1RxAvailable).toBe(true);
      expect(intDevice.uart0TxEmpty).toBe(false);
      expect(intDevice.uart0RxNearFull).toBe(false);
      expect(intDevice.uart0RxAvailable).toBe(false);
    });

    it("uart0RxEmpty", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc6, 0x04);

      // --- Assert
      expect(readNextReg(m, 0xc6)).toBe(0x04);
      expect(intDevice.uart1TxEmpty).toBe(false);
      expect(intDevice.uart1RxNearFull).toBe(false);
      expect(intDevice.uart1RxAvailable).toBe(false);
      expect(intDevice.uart0TxEmpty).toBe(true);
      expect(intDevice.uart0RxNearFull).toBe(false);
      expect(intDevice.uart0RxAvailable).toBe(false);
    });

    it("uart0RxNearFull", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc6, 0x02);

      // --- Assert
      expect(readNextReg(m, 0xc6)).toBe(0x02);
      expect(intDevice.uart1TxEmpty).toBe(false);
      expect(intDevice.uart1RxNearFull).toBe(false);
      expect(intDevice.uart1RxAvailable).toBe(false);
      expect(intDevice.uart0TxEmpty).toBe(false);
      expect(intDevice.uart0RxNearFull).toBe(true);
      expect(intDevice.uart0RxAvailable).toBe(false);
    });

    it("uart0RxAvailable", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xc6, 0x01);

      // --- Assert
      expect(readNextReg(m, 0xc6)).toBe(0x01);
      expect(intDevice.uart1TxEmpty).toBe(false);
      expect(intDevice.uart1RxNearFull).toBe(false);
      expect(intDevice.uart1RxAvailable).toBe(false);
      expect(intDevice.uart0TxEmpty).toBe(false);
      expect(intDevice.uart0RxNearFull).toBe(false);
      expect(intDevice.uart0RxAvailable).toBe(true);
    });
  });

  describe("Reg $c8 - Interrupt status 0", () => {
    it("lineInterruptStatus", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.lineInterruptStatus = true;

      // --- Act
      writeNextReg(m, 0xc8, 0x01);

      // --- Assert
      expect(intDevice.lineInterruptStatus).toBe(true);
      expect(intDevice.ulaInterruptStatus).toBe(false);
    });

    it("ulaInterruptStatus", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ulaInterruptStatus = true;

      // --- Act
      writeNextReg(m, 0xc8, 0x02);

      // --- Assert
      expect(intDevice.lineInterruptStatus).toBe(false);
      expect(intDevice.ulaInterruptStatus).toBe(true);
    });

    it("lineInterruptStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.lineInterruptStatus = true;

      // --- Act
      writeNextReg(m, 0xc8, 0x02);

      // --- Assert
      expect(intDevice.lineInterruptStatus).toBe(false);
    });

    it("lineInterruptStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.lineInterruptStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc8, 0x02);

      // --- Assert
      expect(intDevice.lineInterruptStatus).toBe(true);
    });

    it("ulaInterruptStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ulaInterruptStatus = true;

      // --- Act
      writeNextReg(m, 0xc8, 0x01);

      // --- Assert
      expect(intDevice.ulaInterruptStatus).toBe(false);
    });

    it("ulaInterruptStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ulaInterruptStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc8, 0x01);

      // --- Assert
      expect(intDevice.ulaInterruptStatus).toBe(true);
    });
  });

  describe("Reg $c9 - Interrupt status 1", () => {
    it("ctcChannelInterruptStatus 0 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[0] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x01);

      // --- Assert
      expect(intDevice.ctcIntStatus[0]).toBe(false);
    });

    it("ctcChannelInterruptStatus 0 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[0] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x01);

      // --- Assert
      expect(intDevice.ctcIntStatus[0]).toBe(true);
    });

    it("ctcChannelInterruptStatus 1 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[1] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x02);

      // --- Assert
      expect(intDevice.ctcIntStatus[1]).toBe(false);
    });

    it("ctcChannelInterruptStatus 1 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[1] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x02);

      // --- Assert
      expect(intDevice.ctcIntStatus[1]).toBe(true);
    });

    it("ctcChannelInterruptStatus 2 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[2] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x04);

      // --- Assert
      expect(intDevice.ctcIntStatus[2]).toBe(false);
    });

    it("ctcChannelInterruptStatus 2 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[2] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x04);

      // --- Assert
      expect(intDevice.ctcIntStatus[2]).toBe(true);
    });

    it("ctcChannelInterruptStatus 3 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[3] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x08);

      // --- Assert
      expect(intDevice.ctcIntStatus[3]).toBe(false);
    });

    it("ctcChannelInterruptStatus 3 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[3] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x08);

      // --- Assert
      expect(intDevice.ctcIntStatus[3]).toBe(true);
    });

    it("ctcChannelInterruptStatus 4 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[4] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x10);

      // --- Assert
      expect(intDevice.ctcIntStatus[4]).toBe(false);
    });

    it("ctcChannelInterruptStatus 4 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[4] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x10);

      // --- Assert
      expect(intDevice.ctcIntStatus[4]).toBe(true);
    });

    it("ctcChannelInterruptStatus 5 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[5] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x20);

      // --- Assert
      expect(intDevice.ctcIntStatus[5]).toBe(false);
    });

    it("ctcChannelInterruptStatus 5 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[5] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x20);

      // --- Assert
      expect(intDevice.ctcIntStatus[5]).toBe(true);
    });

    it("ctcChannelInterruptStatus 6 - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[6] = true;

      // --- Act
      writeNextReg(m, 0xc9, 0x40);

      // --- Assert
      expect(intDevice.ctcIntStatus[6]).toBe(false);
    });

    it("ctcChannelInterruptStatus 6 - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.ctcIntStatus[6] = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xc9, 0x40);

      // --- Assert
      expect(intDevice.ctcIntStatus[6]).toBe(true);
    });
  });

  describe("Reg $ca - Interrupt status 2", () => {
    it("uart1TxEmptyStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart1TxEmptyStatus = true;

      // --- Act
      writeNextReg(m, 0xca, 0x40);

      // --- Assert
      expect(intDevice.uart1TxEmptyStatus).toBe(false);
    });

    it("uart1TxEmptyStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart1TxEmptyStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xca, 0x40);

      // --- Assert
      expect(intDevice.uart1TxEmptyStatus).toBe(true);
    });

    it("uart1RxNearFullStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart1RxNearFullStatus = true;

      // --- Act
      writeNextReg(m, 0xca, 0x20);

      // --- Assert
      expect(intDevice.uart1RxNearFullStatus).toBe(false);
    });

    it("uart1RxNearFullStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart1RxNearFullStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xca, 0x20);

      // --- Assert
      expect(intDevice.uart1RxNearFullStatus).toBe(true);
    });

    it("uart1RxAvailableStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart1RxAvailableStatus = true;

      // --- Act
      writeNextReg(m, 0xca, 0x10);

      // --- Assert
      expect(intDevice.uart1RxAvailableStatus).toBe(false);
    });

    it("uart1RxAvailableStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart1RxAvailableStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xca, 0x10);

      // --- Assert
      expect(intDevice.uart1RxAvailableStatus).toBe(true);
    });

    it("uart0TxEmptyStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart0TxEmptyStatus = true;

      // --- Act
      writeNextReg(m, 0xca, 0x04);

      // --- Assert
      expect(intDevice.uart0TxEmptyStatus).toBe(false);
    });

    it("uart0TxEmptyStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart0TxEmptyStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xca, 0x04);

      // --- Assert
      expect(intDevice.uart0TxEmptyStatus).toBe(true);
    });

    it("uart0RxNearFullStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart0RxNearFullStatus = true;

      // --- Act
      writeNextReg(m, 0xca, 0x02);

      // --- Assert
      expect(intDevice.uart0RxNearFullStatus).toBe(false);
    });

    it("uart0RxNearFullStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart0RxNearFullStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xca, 0x02);

      // --- Assert
      expect(intDevice.uart0RxNearFullStatus).toBe(true);
    });

    it("uart0RxAvailableStatus - clear", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart0RxAvailableStatus = true;

      // --- Act
      writeNextReg(m, 0xca, 0x01);

      // --- Assert
      expect(intDevice.uart0RxAvailableStatus).toBe(false);
    });

    it("uart0RxAvailableStatus - no clear with HW IM2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;
      intDevice.uart0RxAvailableStatus = true;

      // --- Act
      writeNextReg(m, 0xc0, 0x01);
      writeNextReg(m, 0xca, 0x01);

      // --- Assert
      expect(intDevice.uart0RxAvailableStatus).toBe(true);
    });
  });

  describe("Reg $cc - DMA interrupt enable 0", () => {
    it("enableNmiToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcc, 0x80);

      // --- Assert
      expect(intDevice.enableNmiToIntDma).toBe(true);
      expect(intDevice.enableLineIntToIntDma).toBe(false);
      expect(intDevice.enableUlaIntToIntDma).toBe(false);
    });

    it("enableLineIntToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcc, 0x02);

      // --- Assert
      expect(intDevice.enableNmiToIntDma).toBe(false);
      expect(intDevice.enableLineIntToIntDma).toBe(true);
      expect(intDevice.enableUlaIntToIntDma).toBe(false);
    });

    it("enableUlaIntToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcc, 0x01);

      // --- Assert
      expect(intDevice.enableNmiToIntDma).toBe(false);
      expect(intDevice.enableLineIntToIntDma).toBe(false);
      expect(intDevice.enableUlaIntToIntDma).toBe(true);
    });
  });

  describe("Reg $cd - DMA interrupt enable 1", () => {
    it("enableCtcToIntDma 0", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x01);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(true);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x02);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(true);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x04);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(true);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x08);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(true);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 4", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x10);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(true);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 5", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x20);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(true);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 6", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x40);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(true);
      expect(intDevice.enableCtcToIntDma[7]).toBe(false);
    });

    it("enableCtcToIntDma 7", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xcd, 0x80);

      // --- Assert
      expect(intDevice.enableCtcToIntDma[0]).toBe(false);
      expect(intDevice.enableCtcToIntDma[1]).toBe(false);
      expect(intDevice.enableCtcToIntDma[2]).toBe(false);
      expect(intDevice.enableCtcToIntDma[3]).toBe(false);
      expect(intDevice.enableCtcToIntDma[4]).toBe(false);
      expect(intDevice.enableCtcToIntDma[5]).toBe(false);
      expect(intDevice.enableCtcToIntDma[6]).toBe(false);
      expect(intDevice.enableCtcToIntDma[7]).toBe(true);
    });
  });

  describe("Reg $ce - DMA interrupt enable 2", () => {
    it("enableUart1EmptyToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xce, 0x40);

      // --- Assert
      expect(intDevice.enableUart1TxEmptyToIntDma).toBe(true);
      expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
      expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
    });

    it("enableUart1RxNearFullToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xce, 0x20);

      // --- Assert
      expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart1RxNearFullToIntDma).toBe(true);
      expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
      expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
    });

    it("enableUart1RxAvailableToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xce, 0x10);

      // --- Assert
      expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart1RxAvailableToIntDma).toBe(true);
      expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
    });

    it("enableUart0TxEmptyToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xce, 0x04);

      // --- Assert
      expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
      expect(intDevice.enableUart0TxEmptyToIntDma).toBe(true);
      expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
    });

    it("enableUart0RxNearFullToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xce, 0x02);

      // --- Assert
      expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
      expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart0RxNearFullToIntDma).toBe(true);
      expect(intDevice.enableUart0RxAvailableToIntDma).toBe(false);
    });

    it("enableUart0RxAvailableToIntDma", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const intDevice = m.interruptDevice;

      // --- Act
      writeNextReg(m, 0xce, 0x01);

      // --- Assert
      expect(intDevice.enableUart1TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart1RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart1RxAvailableToIntDma).toBe(false);
      expect(intDevice.enableUart0TxEmptyToIntDma).toBe(false);
      expect(intDevice.enableUart0RxNearFullToIntDma).toBe(false);
      expect(intDevice.enableUart0RxAvailableToIntDma).toBe(true);
    });
  });

  it("port 0xff Bit 6 write #1", async () => {
        // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pm = m.portManager;
    const intD = m.interruptDevice;
    nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

    // --- Act
    pm.writePort(0xff, 0x00);

    // --- Assert
    expect(intD.ulaInterruptDisabled).toBe(false);
  });

  it("port 0xff Bit 6 write #0", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    const pm = m.portManager;
    const intD = m.interruptDevice;
    nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode
    intD.ulaInterruptDisabled = false;

    // --- Act
    pm.writePort(0xff, 0x40);

    // --- Assert
    expect(intD.ulaInterruptDisabled).toBe(true);
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
