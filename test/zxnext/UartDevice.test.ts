import { describe, it, expect, beforeEach } from "vitest";
import { UartDevice, UartFifo, UartChannel } from "@emu/machines/zxNext/UartDevice";
import { createTestNextMachine } from "./TestNextMachine";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

let machine: IZxNextMachine;
let uart: UartDevice;

async function createUart(): Promise<void> {
  machine = await createTestNextMachine();
  uart = machine.uartDevice;
}

// ============================================================================
// UartFifo unit tests
// ============================================================================

describe("UartFifo", () => {
  it("starts empty", () => {
    const fifo = new UartFifo(8);
    expect(fifo.isEmpty).toBe(true);
    expect(fifo.isFull).toBe(false);
    expect(fifo.count).toBe(0);
  });

  it("push and pop single value", () => {
    const fifo = new UartFifo(8);
    expect(fifo.push(42)).toBe(true);
    expect(fifo.isEmpty).toBe(false);
    expect(fifo.count).toBe(1);
    expect(fifo.pop()).toBe(42);
    expect(fifo.isEmpty).toBe(true);
  });

  it("preserves FIFO order", () => {
    const fifo = new UartFifo(8);
    fifo.push(1);
    fifo.push(2);
    fifo.push(3);
    expect(fifo.pop()).toBe(1);
    expect(fifo.pop()).toBe(2);
    expect(fifo.pop()).toBe(3);
  });

  it("returns 0 when popping empty FIFO", () => {
    const fifo = new UartFifo(8);
    expect(fifo.pop()).toBe(0);
  });

  it("peek returns next value without removing", () => {
    const fifo = new UartFifo(8);
    fifo.push(99);
    expect(fifo.peek()).toBe(99);
    expect(fifo.count).toBe(1);
    expect(fifo.peek()).toBe(99);
  });

  it("peek returns 0 on empty FIFO", () => {
    const fifo = new UartFifo(8);
    expect(fifo.peek()).toBe(0);
  });

  it("reports full when capacity reached", () => {
    const fifo = new UartFifo(4);
    fifo.push(1);
    fifo.push(2);
    fifo.push(3);
    fifo.push(4);
    expect(fifo.isFull).toBe(true);
    expect(fifo.push(5)).toBe(false);
    expect(fifo.count).toBe(4);
  });

  it("nearFull at 3/4 capacity", () => {
    const fifo = new UartFifo(8);
    // 3/4 of 8 = 6
    for (let i = 0; i < 5; i++) fifo.push(i);
    expect(fifo.isNearFull).toBe(false);
    fifo.push(5); // 6 items
    expect(fifo.isNearFull).toBe(true);
  });

  it("clear empties FIFO", () => {
    const fifo = new UartFifo(8);
    fifo.push(1);
    fifo.push(2);
    fifo.push(3);
    fifo.clear();
    expect(fifo.isEmpty).toBe(true);
    expect(fifo.count).toBe(0);
  });

  it("wraps around correctly", () => {
    const fifo = new UartFifo(4);
    fifo.push(1);
    fifo.push(2);
    fifo.push(3);
    fifo.pop(); // remove 1
    fifo.pop(); // remove 2
    fifo.push(4);
    fifo.push(5);
    // FIFO now: 3, 4, 5
    expect(fifo.pop()).toBe(3);
    expect(fifo.pop()).toBe(4);
    expect(fifo.pop()).toBe(5);
    expect(fifo.isEmpty).toBe(true);
  });
});

// ============================================================================
// UartChannel unit tests
// ============================================================================

describe("UartChannel", () => {
  it("default prescaler is 243", () => {
    const ch = new UartChannel();
    expect(ch.prescaler).toBe(243);
    expect(ch.prescalerLsb).toBe(243);
    expect(ch.prescalerMsb).toBe(0);
  });

  it("default frame register is 0x18 (8N1)", () => {
    const ch = new UartChannel();
    expect(ch.frameRegister).toBe(0x18);
  });

  it("reset restores defaults", () => {
    const ch = new UartChannel();
    ch.prescalerLsb = 100;
    ch.prescalerMsb = 3;
    ch.frameRegister = 0x3f;
    ch.breakCondition = true;
    ch.framingError = true;
    ch.rxOverflow = true;
    ch.rxFifo.push(42);
    ch.txFifo.push(99);
    ch.reset();
    expect(ch.prescaler).toBe(243);
    expect(ch.frameRegister).toBe(0x18);
    expect(ch.breakCondition).toBe(false);
    expect(ch.framingError).toBe(false);
    expect(ch.rxOverflow).toBe(false);
    expect(ch.rxFifo.isEmpty).toBe(true);
    expect(ch.txFifo.isEmpty).toBe(true);
  });

  it("prescaler combines MSB and LSB", () => {
    const ch = new UartChannel();
    ch.prescalerLsb = 0x3fff;
    ch.prescalerMsb = 0x07;
    // 0x07 << 14 | 0x3fff = 0x1ffff = 131071
    expect(ch.prescaler).toBe(0x1ffff);
  });
});

// ============================================================================
// UartDevice — Reset & Initial State
// ============================================================================

describe("UartDevice - Reset & Initial State", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("default selectedUart is 0 (UART0/ESP)", () => {
    expect(uart.selectedUart).toBe(0);
  });

  it("both channels have default prescaler 243", () => {
    expect(uart.channels[0].prescaler).toBe(243);
    expect(uart.channels[1].prescaler).toBe(243);
  });

  it("both channels have default frame 0x18", () => {
    expect(uart.channels[0].frameRegister).toBe(0x18);
    expect(uart.channels[1].frameRegister).toBe(0x18);
  });

  it("both channels have empty FIFOs", () => {
    expect(uart.channels[0].rxFifo.isEmpty).toBe(true);
    expect(uart.channels[0].txFifo.isEmpty).toBe(true);
    expect(uart.channels[1].rxFifo.isEmpty).toBe(true);
    expect(uart.channels[1].txFifo.isEmpty).toBe(true);
  });

  it("status byte shows TX empty, no RX data after reset", () => {
    // bit 4 = TX empty, all others = 0
    expect(uart.readTxPort()).toBe(0x10);
  });

  it("reset clears all state", () => {
    uart.pushRxByte(0, 0xaa);
    uart.writeTxPort(0x55);
    uart.writeSelectPort(0x40); // switch to UART1
    uart.reset();
    expect(uart.selectedUart).toBe(0);
    expect(uart.channels[0].rxFifo.isEmpty).toBe(true);
    expect(uart.channels[0].txFifo.isEmpty).toBe(true);
    expect(uart.channels[1].rxFifo.isEmpty).toBe(true);
    expect(uart.channels[1].txFifo.isEmpty).toBe(true);
  });
});

// ============================================================================
// UartDevice — Select Register (Port 0x153B)
// ============================================================================

describe("UartDevice - Select Register", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("read returns selectedUart in bit 6 and prescaler MSB in bits 2:0", () => {
    expect(uart.readSelectPort()).toBe(0x00); // UART0 selected, MSB=0
  });

  it("writing bit 6 switches to UART1", () => {
    uart.writeSelectPort(0x40); // bit 6 = 1
    expect(uart.selectedUart).toBe(1);
    expect(uart.readSelectPort() & 0x40).toBe(0x40);
  });

  it("writing bit 6 = 0 switches back to UART0", () => {
    uart.writeSelectPort(0x40); // UART1
    uart.writeSelectPort(0x00); // UART0
    expect(uart.selectedUart).toBe(0);
  });

  it("writing prescaler MSB with bit 4 gate", () => {
    // bit 4 = 1 (gate), bits 2:0 = 5
    uart.writeSelectPort(0x15); // 0b0001_0101
    expect(uart.channels[0].prescalerMsb).toBe(5);
    expect(uart.readSelectPort() & 0x07).toBe(5);
  });

  it("prescaler MSB NOT written when bit 4 is 0", () => {
    uart.writeSelectPort(0x05); // bit 4 = 0, bits 2:0 = 5
    expect(uart.channels[0].prescalerMsb).toBe(0); // unchanged
  });

  it("prescaler MSB goes to OLD UART when switching", () => {
    // Write MSB=3 to UART0 while simultaneously switching to UART1
    uart.writeSelectPort(0x53); // bit 6=1 (switch to UART1), bit 4=1 (gate), bits 2:0=3
    // MSB should go to UART0 (the OLD selected UART)
    expect(uart.channels[0].prescalerMsb).toBe(3);
    // Now UART1 is selected
    expect(uart.selectedUart).toBe(1);
    // UART1 MSB is unchanged
    expect(uart.channels[1].prescalerMsb).toBe(0);
  });

  it("read returns bits 5:3 as 0, bit 7 as 0", () => {
    uart.writeSelectPort(0x17); // MSB = 7
    const v = uart.readSelectPort();
    expect(v & 0x80).toBe(0); // bit 7 = 0
    expect(v & 0x38).toBe(0); // bits 5:3 = 0
    expect(v & 0x07).toBe(7); // bits 2:0 = 7
  });
});

// ============================================================================
// UartDevice — Prescaler LSB (Port 0x143B write)
// ============================================================================

describe("UartDevice - Prescaler LSB", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("write lower 7 bits when bit 7 = 0", () => {
    uart.writeRxPort(0x55); // bit 7 = 0, value = 0x55
    expect(uart.channels[0].prescalerLsb & 0x7f).toBe(0x55);
  });

  it("write upper 7 bits when bit 7 = 1", () => {
    uart.writeRxPort(0x80 | 0x0a); // bit 7 = 1, upper = 0x0a
    expect((uart.channels[0].prescalerLsb >> 7) & 0x7f).toBe(0x0a);
  });

  it("lower bits preserved when writing upper", () => {
    uart.writeRxPort(0x33); // lower = 0x33
    uart.writeRxPort(0x80 | 0x0a); // upper = 0x0a
    expect(uart.channels[0].prescalerLsb & 0x7f).toBe(0x33);
    expect((uart.channels[0].prescalerLsb >> 7) & 0x7f).toBe(0x0a);
  });

  it("upper bits preserved when writing lower", () => {
    uart.writeRxPort(0x80 | 0x05); // upper = 0x05
    uart.writeRxPort(0x7f); // lower = 0x7f
    expect(uart.channels[0].prescalerLsb & 0x7f).toBe(0x7f);
    expect((uart.channels[0].prescalerLsb >> 7) & 0x7f).toBe(0x05);
  });

  it("full 17-bit prescaler with MSB", () => {
    uart.writeRxPort(0x33); // lower 7 = 0x33
    uart.writeRxPort(0x80 | 0x22); // upper 7 = 0x22
    uart.writeSelectPort(0x13); // MSB gate + MSB = 3
    // prescaler = 3 << 14 | (0x22 << 7 | 0x33)
    const expected = (3 << 14) | (0x22 << 7) | 0x33;
    expect(uart.channels[0].prescaler).toBe(expected);
  });

  it("prescaler writes go to selected UART", () => {
    uart.writeSelectPort(0x40); // switch to UART1
    uart.writeRxPort(0x55); // lower = 0x55
    expect(uart.channels[1].prescalerLsb & 0x7f).toBe(0x55);
    expect(uart.channels[0].prescalerLsb & 0x7f).toBe(243 & 0x7f); // UART0 unchanged
  });
});

// ============================================================================
// UartDevice — Frame Register (Port 0x163B)
// ============================================================================

describe("UartDevice - Frame Register", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("read returns default 0x18 (8N1)", () => {
    expect(uart.readFramePort()).toBe(0x18);
  });

  it("write stores bits 6:0", () => {
    uart.writeFramePort(0x3f);
    expect(uart.readFramePort()).toBe(0x3f);
  });

  it("bit 7 is not stored (action only)", () => {
    uart.writeFramePort(0xff); // bit 7 = reset + value 0x7f
    expect(uart.readFramePort()).toBe(0x7f);
  });

  it("bit 7 resets FIFOs", () => {
    uart.pushRxByte(0, 0xaa);
    uart.writeTxPort(0x55);
    expect(uart.channels[0].rxFifo.isEmpty).toBe(false);
    expect(uart.channels[0].txFifo.isEmpty).toBe(false);
    uart.writeFramePort(0x80); // reset
    expect(uart.channels[0].rxFifo.isEmpty).toBe(true);
    expect(uart.channels[0].txFifo.isEmpty).toBe(true);
  });

  it("bit 7 clears break, framing error, overflow", () => {
    uart.channels[0].breakCondition = true;
    uart.channels[0].framingError = true;
    uart.channels[0].rxOverflow = true;
    uart.writeFramePort(0x80);
    expect(uart.channels[0].breakCondition).toBe(false);
    expect(uart.channels[0].framingError).toBe(false);
    expect(uart.channels[0].rxOverflow).toBe(false);
  });

  it("frame register is per-UART", () => {
    uart.writeFramePort(0x0c); // UART0 frame = 0x0c
    uart.writeSelectPort(0x40); // switch to UART1
    expect(uart.readFramePort()).toBe(0x18); // UART1 still default
    uart.writeFramePort(0x3b); // UART1 frame = 0x3b
    uart.writeSelectPort(0x00); // back to UART0
    expect(uart.readFramePort()).toBe(0x0c); // UART0 preserved
  });
});

// ============================================================================
// UartDevice — TX FIFO (Port 0x133B write)
// ============================================================================

describe("UartDevice - TX FIFO", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("write byte to TX FIFO", () => {
    uart.writeTxPort(0xab);
    expect(uart.hasTxData(0)).toBe(true);
    expect(uart.popTxByte(0)).toBe(0xab);
  });

  it("TX FIFO preserves order", () => {
    uart.writeTxPort(0x01);
    uart.writeTxPort(0x02);
    uart.writeTxPort(0x03);
    expect(uart.popTxByte(0)).toBe(0x01);
    expect(uart.popTxByte(0)).toBe(0x02);
    expect(uart.popTxByte(0)).toBe(0x03);
  });

  it("TX empty status bit", () => {
    // Initially empty
    expect(uart.readTxPort() & 0x10).toBe(0x10);
    uart.writeTxPort(0xaa);
    // Not empty
    expect(uart.readTxPort() & 0x10).toBe(0x00);
  });

  it("TX full status bit", () => {
    // Fill TX FIFO (64 entries)
    for (let i = 0; i < 64; i++) {
      uart.writeTxPort(i);
    }
    expect(uart.readTxPort() & 0x02).toBe(0x02); // TX full
  });

  it("TX writes go to selected UART", () => {
    uart.writeTxPort(0xaa); // UART0
    uart.writeSelectPort(0x40); // switch to UART1
    uart.writeTxPort(0xbb); // UART1
    expect(uart.popTxByte(0)).toBe(0xaa);
    expect(uart.popTxByte(1)).toBe(0xbb);
  });

  it("popTxByte returns undefined when empty", () => {
    expect(uart.popTxByte(0)).toBeUndefined();
  });

  it("drainTxFifo clears TX FIFO", () => {
    uart.writeTxPort(0x01);
    uart.writeTxPort(0x02);
    uart.drainTxFifo(0);
    expect(uart.hasTxData(0)).toBe(false);
  });

  it("value masked to 8 bits", () => {
    uart.writeTxPort(0x1ab);
    expect(uart.popTxByte(0)).toBe(0xab);
  });
});

// ============================================================================
// UartDevice — RX FIFO (Port 0x143B read)
// ============================================================================

describe("UartDevice - RX FIFO", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("pushRxByte and readRxPort", () => {
    uart.pushRxByte(0, 0xab);
    expect(uart.readRxPort()).toBe(0xab);
  });

  it("RX FIFO preserves order", () => {
    uart.pushRxByte(0, 0x01);
    uart.pushRxByte(0, 0x02);
    uart.pushRxByte(0, 0x03);
    expect(uart.readRxPort()).toBe(0x01);
    expect(uart.readRxPort()).toBe(0x02);
    expect(uart.readRxPort()).toBe(0x03);
  });

  it("readRxPort returns 0x00 when empty", () => {
    expect(uart.readRxPort()).toBe(0x00);
  });

  it("RX available status bit (bit 0)", () => {
    expect(uart.readTxPort() & 0x01).toBe(0x00); // empty
    uart.pushRxByte(0, 0xaa);
    expect(uart.readTxPort() & 0x01).toBe(0x01); // has data
  });

  it("RX near full status bit (bit 3)", () => {
    // 512 * 3/4 = 384
    for (let i = 0; i < 383; i++) {
      uart.pushRxByte(0, i & 0xff);
    }
    expect(uart.readTxPort() & 0x08).toBe(0x00); // not near full
    uart.pushRxByte(0, 0x00); // 384th entry
    expect(uart.readTxPort() & 0x08).toBe(0x08); // near full
  });

  it("RX overflow sets bit 2 and clears on status read", () => {
    // Fill RX FIFO (512 entries)
    for (let i = 0; i < 512; i++) {
      uart.pushRxByte(0, i & 0xff);
    }
    // Push one more → overflow
    uart.pushRxByte(0, 0xff);
    const status1 = uart.readTxPort();
    expect(status1 & 0x04).toBe(0x04); // overflow set
    // Second read should have overflow cleared
    const status2 = uart.readTxPort();
    expect(status2 & 0x04).toBe(0x00); // overflow cleared
  });

  it("RX per-UART independence", () => {
    uart.pushRxByte(0, 0xaa); // UART0
    uart.pushRxByte(1, 0xbb); // UART1

    // Read from UART0
    expect(uart.readRxPort()).toBe(0xaa);

    // Switch to UART1
    uart.writeSelectPort(0x40);
    expect(uart.readRxPort()).toBe(0xbb);
  });

  it("error flag stored in RX FIFO but stripped on read", () => {
    uart.pushRxByte(0, 0xab, true); // with error flag
    expect(uart.readRxPort()).toBe(0xab); // data only
  });
});

// ============================================================================
// UartDevice — Status Byte (Port 0x133B read)
// ============================================================================

describe("UartDevice - Status Byte", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("break condition in bit 7", () => {
    uart.setBreakCondition(0, true);
    expect(uart.readTxPort() & 0x80).toBe(0x80);
    uart.setBreakCondition(0, false);
    expect(uart.readTxPort() & 0x80).toBe(0x00);
  });

  it("framing error in bit 6, clears on read", () => {
    uart.setFramingError(0, true);
    const s1 = uart.readTxPort();
    expect(s1 & 0x40).toBe(0x40);
    // Should clear after read
    const s2 = uart.readTxPort();
    expect(s2 & 0x40).toBe(0x00);
  });

  it("err_bit8 (bit 5) reflects error flag on next RX byte", () => {
    uart.pushRxByte(0, 0xaa, true); // byte with error
    expect(uart.readTxPort() & 0x20).toBe(0x20);
  });

  it("err_bit8 (bit 5) is 0 for normal RX byte", () => {
    uart.pushRxByte(0, 0xaa, false); // no error
    expect(uart.readTxPort() & 0x20).toBe(0x00);
  });

  it("err_bit8 (bit 5) is 0 when RX empty", () => {
    expect(uart.readTxPort() & 0x20).toBe(0x00);
  });

  it("TX empty (bit 4) and TX full (bit 1)", () => {
    // Empty
    expect(uart.readTxPort() & 0x12).toBe(0x10); // TX empty=1, TX full=0
    // Write one byte
    uart.writeTxPort(0xaa);
    expect(uart.readTxPort() & 0x12).toBe(0x00); // TX empty=0, TX full=0
    // Fill to capacity
    for (let i = 0; i < 64; i++) uart.writeTxPort(i);
    expect(uart.readTxPort() & 0x12).toBe(0x02); // TX empty=0, TX full=1
  });

  it("RX near full (bit 3)", () => {
    for (let i = 0; i < 384; i++) uart.pushRxByte(0, i & 0xff);
    expect(uart.readTxPort() & 0x08).toBe(0x08);
  });

  it("full status byte composition", () => {
    // Set up specific flags
    uart.setBreakCondition(0, true);   // bit 7
    uart.setFramingError(0, true);     // bit 6
    uart.pushRxByte(0, 0xaa, true);    // bit 5 (error byte), bit 0 (RX has data)
    // TX empty by default                // bit 4

    const status = uart.readTxPort();
    expect(status & 0x80).toBe(0x80); // break
    expect(status & 0x40).toBe(0x40); // framing error
    expect(status & 0x20).toBe(0x20); // err_bit8
    expect(status & 0x10).toBe(0x10); // TX empty
    expect(status & 0x01).toBe(0x01); // RX has data
  });

  it("status reads from selected UART", () => {
    uart.setBreakCondition(0, true);
    uart.writeSelectPort(0x40); // switch to UART1
    expect(uart.readTxPort() & 0x80).toBe(0x00); // UART1 has no break
    uart.setBreakCondition(1, true);
    expect(uart.readTxPort() & 0x80).toBe(0x80); // UART1 break
  });
});

// ============================================================================
// UartDevice — Frame Reset (bit 7 of frame register)
// ============================================================================

describe("UartDevice - Frame Reset", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("frame reset only affects selected UART", () => {
    uart.pushRxByte(0, 0xaa); // UART0 RX
    uart.pushRxByte(1, 0xbb); // UART1 RX
    uart.writeSelectPort(0x40); // switch to UART1
    uart.writeFramePort(0x80); // reset UART1
    // UART1 should be cleared
    expect(uart.channels[1].rxFifo.isEmpty).toBe(true);
    // UART0 should be untouched
    expect(uart.channels[0].rxFifo.isEmpty).toBe(false);
  });

  it("frame reset preserves frame register value from same write", () => {
    uart.writeFramePort(0x9c); // bit 7 = reset, bits 6:0 = 0x1c
    expect(uart.readFramePort()).toBe(0x1c);
  });
});

// ============================================================================
// UartDevice — External Interface
// ============================================================================

describe("UartDevice - External Interface", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("pushRxByte channel parameter selects UART", () => {
    uart.pushRxByte(0, 0x01);
    uart.pushRxByte(1, 0x02);
    expect(uart.channels[0].rxFifo.count).toBe(1);
    expect(uart.channels[1].rxFifo.count).toBe(1);
  });

  it("popTxByte retrieves from specific channel", () => {
    uart.writeTxPort(0xaa); // UART0
    uart.writeSelectPort(0x40);
    uart.writeTxPort(0xbb); // UART1
    expect(uart.popTxByte(0)).toBe(0xaa);
    expect(uart.popTxByte(1)).toBe(0xbb);
  });

  it("hasTxData checks specific channel", () => {
    expect(uart.hasTxData(0)).toBe(false);
    uart.writeTxPort(0x01);
    expect(uart.hasTxData(0)).toBe(true);
    expect(uart.hasTxData(1)).toBe(false);
  });

  it("setBreakCondition sets break on specific channel", () => {
    uart.setBreakCondition(0, true);
    expect(uart.channels[0].breakCondition).toBe(true);
    expect(uart.channels[1].breakCondition).toBe(false);
  });

  it("setFramingError sets error on specific channel", () => {
    uart.setFramingError(1, true);
    expect(uart.channels[0].framingError).toBe(false);
    expect(uart.channels[1].framingError).toBe(true);
  });
});

// ============================================================================
// UartDevice — onNewFrame
// ============================================================================

describe("UartDevice - onNewFrame", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("drains TX FIFOs on both channels", () => {
    uart.writeTxPort(0xaa); // UART0
    uart.writeSelectPort(0x40);
    uart.writeTxPort(0xbb); // UART1
    uart.onNewFrame();
    expect(uart.channels[0].txFifo.isEmpty).toBe(true);
    expect(uart.channels[1].txFifo.isEmpty).toBe(true);
  });

  it("does not affect RX FIFOs", () => {
    uart.pushRxByte(0, 0xaa);
    uart.pushRxByte(1, 0xbb);
    uart.onNewFrame();
    expect(uart.channels[0].rxFifo.isEmpty).toBe(false);
    expect(uart.channels[1].rxFifo.isEmpty).toBe(false);
  });
});

// ============================================================================
// UartDevice — Dual UART Independence
// ============================================================================

describe("UartDevice - Dual UART Independence", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("separate prescalers per UART", () => {
    // UART0 prescaler
    uart.writeRxPort(0x11); // lower = 0x11
    uart.writeRxPort(0x80 | 0x22); // upper = 0x22
    uart.writeSelectPort(0x13); // MSB = 3, UART0

    // Switch to UART1
    uart.writeSelectPort(0x40);
    uart.writeRxPort(0x44); // lower = 0x44
    uart.writeRxPort(0x80 | 0x55); // upper = 0x55
    uart.writeSelectPort(0x55); // MSB = 5, gate + stay UART1

    // Verify UART0
    expect(uart.channels[0].prescalerLsb & 0x7f).toBe(0x11);
    expect((uart.channels[0].prescalerLsb >> 7) & 0x7f).toBe(0x22);
    expect(uart.channels[0].prescalerMsb).toBe(3);

    // Verify UART1
    expect(uart.channels[1].prescalerLsb & 0x7f).toBe(0x44);
    expect((uart.channels[1].prescalerLsb >> 7) & 0x7f).toBe(0x55);
    expect(uart.channels[1].prescalerMsb).toBe(5);
  });

  it("separate frame registers per UART", () => {
    uart.writeFramePort(0x0c); // UART0: 6-bit, even parity, 1 stop
    uart.writeSelectPort(0x40); // UART1
    uart.writeFramePort(0x3b); // UART1: 8-bit, odd parity, 2 stop, flow ctrl
    uart.writeSelectPort(0x00); // back to UART0
    expect(uart.readFramePort()).toBe(0x0c);
    uart.writeSelectPort(0x40);
    expect(uart.readFramePort()).toBe(0x3b);
  });

  it("separate status flags per UART", () => {
    uart.setBreakCondition(0, true);
    uart.setFramingError(1, true);
    // UART0: break=1, framing=0
    expect(uart.readTxPort() & 0xc0).toBe(0x80);
    // UART1: break=0, framing=1
    uart.writeSelectPort(0x40);
    expect(uart.readTxPort() & 0xc0).toBe(0x40);
  });

  it("separate TX FIFOs per UART", () => {
    uart.writeTxPort(0x01); // UART0
    uart.writeTxPort(0x02);
    uart.writeSelectPort(0x40); // UART1
    uart.writeTxPort(0x03);
    expect(uart.channels[0].txFifo.count).toBe(2);
    expect(uart.channels[1].txFifo.count).toBe(1);
  });

  it("separate RX FIFOs per UART", () => {
    uart.pushRxByte(0, 0x01);
    uart.pushRxByte(0, 0x02);
    uart.pushRxByte(1, 0x03);
    expect(uart.channels[0].rxFifo.count).toBe(2);
    expect(uart.channels[1].rxFifo.count).toBe(1);
  });
});

// ============================================================================
// InterruptDevice — UART-related bug fixes
// ============================================================================

describe("InterruptDevice - UART CA register fixes", () => {
  beforeEach(async () => {
    await createUart();
  });

  it("nextRegCAValue bit 5 = uart1RxNearFullStatus (not uart1TxEmptyStatus)", () => {
    const intDev = machine.interruptDevice;
    intDev.uart1RxNearFullStatus = true;
    intDev.uart1TxEmptyStatus = false;
    expect(intDev.nextRegCAValue & 0x20).toBe(0x20);
  });

  it("nextRegCAValue bit 0 = uart0RxAvailableStatus (not uart0RxNearFullStatus)", () => {
    const intDev = machine.interruptDevice;
    intDev.uart0RxAvailableStatus = true;
    intDev.uart0RxNearFullStatus = false;
    expect(intDev.nextRegCAValue & 0x01).toBe(0x01);
  });

  it("nextRegCAValue all bits correct", () => {
    const intDev = machine.interruptDevice;
    intDev.uart1TxEmptyStatus = true;       // bit 6
    intDev.uart1RxNearFullStatus = true;     // bit 5
    intDev.uart1RxAvailableStatus = true;    // bit 4
    intDev.uart0TxEmptyStatus = true;        // bit 2
    intDev.uart0RxNearFullStatus = true;     // bit 1
    intDev.uart0RxAvailableStatus = true;    // bit 0
    expect(intDev.nextRegCAValue).toBe(0x77);
  });

  it("UART interrupt fields reset properly", () => {
    const intDev = machine.interruptDevice;
    intDev.uart0TxEmpty = true;
    intDev.uart1RxAvailableStatus = true;
    intDev.enableUart0TxEmptyToIntDma = true;
    intDev.reset();
    expect(intDev.uart0TxEmpty).toBe(false);
    expect(intDev.uart1RxAvailableStatus).toBe(false);
    expect(intDev.enableUart0TxEmptyToIntDma).toBe(false);
  });
});
