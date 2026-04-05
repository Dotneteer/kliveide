import { describe, it, expect, beforeEach } from "vitest";
import { I2cDevice, toBcd, fromBcd } from "@emu/machines/zxNext/I2cDevice";
import { createTestNextMachine } from "./TestNextMachine";

// ============================================================================
// I2C bit-bang helpers
// ============================================================================

/** DS1307 I2C address */
const DS1307_ADDR = 0x68;

/** Helper class wrapping an I2cDevice for bit-bang I2C operations */
class I2cDriver {
  constructor(public readonly dev: I2cDevice) {}

  /** Generate START condition: SDA falls while SCL high */
  start(): void {
    // Ensure SCL and SDA are high
    this.dev.writeSdaPort(1);
    this.dev.writeSclPort(1);
    // SDA goes low while SCL is high → START
    this.dev.writeSdaPort(0);
    // Then pull SCL low to prepare for data
    this.dev.writeSclPort(0);
  }

  /** Generate STOP condition: SDA rises while SCL high */
  stop(): void {
    // Ensure SDA is low
    this.dev.writeSdaPort(0);
    // SCL goes high
    this.dev.writeSclPort(1);
    // SDA goes high while SCL is high → STOP
    this.dev.writeSdaPort(1);
  }

  /** Clock one bit out from master to slave. Returns nothing. */
  writeBit(bit: boolean): void {
    this.dev.writeSdaPort(bit ? 1 : 0);
    this.dev.writeSclPort(1); // rising edge: slave samples
    this.dev.writeSclPort(0); // falling edge: slave may drive SDA
  }

  /** Clock one bit in from slave. Returns the bit value. */
  readBit(): boolean {
    // Release SDA so slave can drive
    this.dev.writeSdaPort(1);
    this.dev.writeSclPort(1); // rising edge
    const sdaVal = this.dev.readSdaPort() & 0x01;
    this.dev.writeSclPort(0); // falling edge
    return !!sdaVal;
  }

  /**
   * Write a byte (MSB first) and read back ACK.
   * Returns true if slave ACKed (SDA low).
   */
  writeByte(value: number): boolean {
    for (let i = 7; i >= 0; i--) {
      this.writeBit(!!(value & (1 << i)));
    }
    // Read ACK bit: slave pulls SDA low for ACK
    const ack = !this.readBit(); // ACK = SDA low = true
    return ack;
  }

  /**
   * Read a byte (MSB first) from slave, then send ACK or NACK.
   */
  readByte(ack: boolean): number {
    let value = 0;
    for (let i = 7; i >= 0; i--) {
      if (this.readBit()) {
        value |= 1 << i;
      }
    }
    // Send ACK (SDA low) or NACK (SDA high)
    this.writeBit(!ack);
    return value;
  }

  /**
   * Send address byte with R/W bit. Returns true if ACKed.
   */
  address(addr: number, read: boolean): boolean {
    return this.writeByte((addr << 1) | (read ? 1 : 0));
  }
}

// ============================================================================
// BCD helper tests
// ============================================================================
describe("Next - I2C BCD helpers", () => {
  it("toBcd converts 0", () => {
    expect(toBcd(0)).toBe(0x00);
  });

  it("toBcd converts 59", () => {
    expect(toBcd(59)).toBe(0x59);
  });

  it("toBcd converts 23", () => {
    expect(toBcd(23)).toBe(0x23);
  });

  it("toBcd converts 99", () => {
    expect(toBcd(99)).toBe(0x99);
  });

  it("fromBcd converts 0x00", () => {
    expect(fromBcd(0x00)).toBe(0);
  });

  it("fromBcd converts 0x59", () => {
    expect(fromBcd(0x59)).toBe(59);
  });

  it("fromBcd converts 0x23", () => {
    expect(fromBcd(0x23)).toBe(23);
  });

  it("fromBcd roundtrips", () => {
    for (let i = 0; i <= 99; i++) {
      expect(fromBcd(toBcd(i))).toBe(i);
    }
  });
});

// ============================================================================
// I2cDevice Tests
// ============================================================================
describe("Next - I2cDevice", () => {
  let dev: I2cDevice;
  let drv: I2cDriver;

  beforeEach(async () => {
    const machine = await createTestNextMachine();
    dev = machine.i2cDevice;
    drv = new I2cDriver(dev);
  });

  // --------------------------------------------------------------------------
  // Reset / initial state
  // --------------------------------------------------------------------------
  describe("Reset", () => {
    it("SCL and SDA lines are high after construction", () => {
      expect(dev.sclOut).toBe(true);
      expect(dev.sdaOut).toBe(true);
      expect(dev.sdaLine).toBe(true);
    });

    it("SCL port reads 0xFF initially", () => {
      expect(dev.readSclPort()).toBe(0xff);
    });

    it("SDA port reads 0xFF initially", () => {
      expect(dev.readSdaPort()).toBe(0xff);
    });

    it("register pointer is 0 after reset", () => {
      expect(dev.regPointer).toBe(0);
    });

    it("CMOS registers are initialized with BCD time", () => {
      // Seconds should be a valid BCD (0x00–0x59)
      const sec = dev.cmos[0x00];
      expect(sec).toBeLessThanOrEqual(0x59);
      expect((sec & 0x0f)).toBeLessThanOrEqual(9);
    });

    it("reset restores initial state", () => {
      // Disturb state
      dev.writeSclPort(0);
      dev.writeSdaPort(0);
      dev.reset();
      expect(dev.sclOut).toBe(true);
      expect(dev.sdaOut).toBe(true);
      expect(dev.readSclPort()).toBe(0xff);
      expect(dev.readSdaPort()).toBe(0xff);
    });
  });

  // --------------------------------------------------------------------------
  // Port read/write
  // --------------------------------------------------------------------------
  describe("Port I/O", () => {
    it("writing 0 to SCL port makes readSclPort return 0xFE", () => {
      dev.writeSclPort(0);
      expect(dev.readSclPort()).toBe(0xfe);
    });

    it("writing 1 to SCL port makes readSclPort return 0xFF", () => {
      dev.writeSclPort(0);
      dev.writeSclPort(1);
      expect(dev.readSclPort()).toBe(0xff);
    });

    it("writing 0 to SDA port makes readSdaPort return 0xFE", () => {
      dev.writeSdaPort(0);
      expect(dev.readSdaPort()).toBe(0xfe);
    });

    it("writing 1 to SDA port makes readSdaPort return 0xFF", () => {
      dev.writeSdaPort(0);
      dev.writeSdaPort(1);
      expect(dev.readSdaPort()).toBe(0xff);
    });

    it("SDA read reflects open-drain AND (slave pulls low during ACK)", () => {
      // After START + valid address, slave should ACK (pull SDA low)
      drv.start();
      // Write DS1307 write address byte
      for (let i = 7; i >= 1; i--) {
        drv.writeBit(!!((DS1307_ADDR >> (i - 1)) & 1));
      }
      // R/W bit = 0 (write)
      drv.writeBit(false);
      // Now on ACK clock: release SDA, clock high, read SDA
      dev.writeSdaPort(1); // master releases SDA
      dev.writeSclPort(1); // rising edge: ACK state
      // Slave should be driving SDA low (ACK)
      expect(dev.readSdaPort()).toBe(0xfe);
    });

    it("only bit 0 of write value matters for SCL", () => {
      dev.writeSclPort(0xfe); // bit 0 = 0
      expect(dev.readSclPort()).toBe(0xfe);
      dev.writeSclPort(0x01); // bit 0 = 1
      expect(dev.readSclPort()).toBe(0xff);
    });

    it("only bit 0 of write value matters for SDA", () => {
      dev.writeSdaPort(0xfe); // bit 0 = 0
      expect(dev.readSdaPort()).toBe(0xfe);
      dev.writeSdaPort(0x01); // bit 0 = 1
      expect(dev.readSdaPort()).toBe(0xff);
    });
  });

  // --------------------------------------------------------------------------
  // START / STOP detection
  // --------------------------------------------------------------------------
  describe("START/STOP conditions", () => {
    it("START puts device into ADDRESS state", () => {
      drv.start();
      expect(dev.i2cState).toBe(1); // ADDRESS
    });

    it("STOP returns device to IDLE state", () => {
      drv.start();
      drv.stop();
      expect(dev.i2cState).toBe(0); // IDLE
    });

    it("repeated START resets to ADDRESS state", () => {
      drv.start();
      // Send a few bits
      drv.writeBit(true);
      drv.writeBit(false);
      // Repeated START
      dev.writeSdaPort(1);
      dev.writeSclPort(1);
      dev.writeSdaPort(0); // SDA falls while SCL high → START
      dev.writeSclPort(0);
      expect(dev.i2cState).toBe(1); // ADDRESS
    });
  });

  // --------------------------------------------------------------------------
  // Address byte
  // --------------------------------------------------------------------------
  describe("Address matching", () => {
    it("DS1307 write address (0xD0) is ACKed", () => {
      drv.start();
      const ack = drv.address(DS1307_ADDR, false);
      expect(ack).toBe(true);
    });

    it("DS1307 read address (0xD1) is ACKed", () => {
      drv.start();
      const ack = drv.address(DS1307_ADDR, true);
      expect(ack).toBe(true);
    });

    it("wrong address is NACKed", () => {
      drv.start();
      const ack = drv.address(0x50, false); // Some other device
      expect(ack).toBe(false);
    });

    it("wrong address returns to IDLE", () => {
      drv.start();
      drv.address(0x50, false);
      expect(dev.i2cState).toBe(0); // IDLE
    });
  });

  // --------------------------------------------------------------------------
  // Write operations
  // --------------------------------------------------------------------------
  describe("Write operations", () => {
    it("first write byte sets register pointer", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x05); // Set pointer to 0x05
      expect(dev.regPointer).toBe(0x05);
    });

    it("second write byte writes to register and increments pointer", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08); // Set pointer to 0x08 (SRAM start)
      drv.writeByte(0xAB); // Write 0xAB to register 0x08
      expect(dev.cmos[0x08]).toBe(0xAB);
      expect(dev.regPointer).toBe(0x09);
    });

    it("multi-byte write auto-increments pointer", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08); // Set pointer to 0x08
      drv.writeByte(0x11);
      drv.writeByte(0x22);
      drv.writeByte(0x33);
      drv.stop();
      expect(dev.cmos[0x08]).toBe(0x11);
      expect(dev.cmos[0x09]).toBe(0x22);
      expect(dev.cmos[0x0a]).toBe(0x33);
    });

    it("write pointer wraps at 0x3F", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x3f); // Set pointer to last register
      drv.writeByte(0xDE); // Write to 0x3F
      expect(dev.cmos[0x3f]).toBe(0xDE);
      drv.writeByte(0xAD); // Should wrap to 0x00
      expect(dev.cmos[0x00]).toBe(0xAD);
      expect(dev.regPointer).toBe(0x01);
    });

    it("pointer is masked to 6 bits", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0xFF); // Should mask to 0x3F
      expect(dev.regPointer).toBe(0x3f);
    });

    it("write ACKs each data byte", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      const ack1 = drv.writeByte(0x08); // pointer
      const ack2 = drv.writeByte(0x55); // data
      const ack3 = drv.writeByte(0xAA); // data
      expect(ack1).toBe(true);
      expect(ack2).toBe(true);
      expect(ack3).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Read operations
  // --------------------------------------------------------------------------
  describe("Read operations", () => {
    it("read returns data starting from register pointer", () => {
      // Write a known value first
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08); // pointer
      drv.writeByte(0x42); // write 0x42 to reg 0x08
      drv.stop();

      // Read back from register 0x08
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08); // set pointer
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const val = drv.readByte(false); // NACK = last byte
      drv.stop();
      expect(val).toBe(0x42);
    });

    it("multi-byte read auto-increments pointer", () => {
      // Write 3 bytes to SRAM
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x10); // pointer
      drv.writeByte(0xAA);
      drv.writeByte(0xBB);
      drv.writeByte(0xCC);
      drv.stop();

      // Read them back
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x10); // set pointer
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const v1 = drv.readByte(true);  // ACK
      const v2 = drv.readByte(true);  // ACK
      const v3 = drv.readByte(false); // NACK
      drv.stop();

      expect(v1).toBe(0xAA);
      expect(v2).toBe(0xBB);
      expect(v3).toBe(0xCC);
    });

    it("read pointer wraps at 0x3F", () => {
      // Write to last register and first register
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x3f);
      drv.writeByte(0xEE);
      drv.stop();

      const firstReg = dev.cmos[0x00]; // save what's there

      // Read starting at 0x3F
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x3f); // pointer
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const v1 = drv.readByte(true);  // read from 0x3F
      const v2 = drv.readByte(false); // read from 0x00 (wrapped)
      drv.stop();

      expect(v1).toBe(0xEE);
      expect(v2).toBe(firstReg);
    });

    it("NACK after read returns device to IDLE", () => {
      drv.start();
      drv.address(DS1307_ADDR, true);
      drv.readByte(false); // NACK
      expect(dev.i2cState).toBe(0); // IDLE
    });
  });

  // --------------------------------------------------------------------------
  // DS1307 RTC time registers
  // --------------------------------------------------------------------------
  describe("DS1307 RTC registers", () => {
    it("seconds register is valid BCD (0x00-0x59)", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00); // pointer to seconds
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const sec = drv.readByte(false);
      drv.stop();

      // Mask off CH bit (bit 7)
      const bcdSec = sec & 0x7f;
      expect(fromBcd(bcdSec)).toBeLessThanOrEqual(59);
    });

    it("minutes register is valid BCD (0x00-0x59)", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x01); // pointer to minutes
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const min = drv.readByte(false);
      drv.stop();

      expect(fromBcd(min & 0x7f)).toBeLessThanOrEqual(59);
    });

    it("hours register is valid BCD (0x00-0x23)", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x02); // pointer to hours
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const hrs = drv.readByte(false);
      drv.stop();

      // 24h mode: bit 6 = 0
      expect(hrs & 0x40).toBe(0);
      expect(fromBcd(hrs & 0x3f)).toBeLessThanOrEqual(23);
    });

    it("day-of-week register is 1-7", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x03);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const dow = drv.readByte(false);
      drv.stop();

      const dayVal = fromBcd(dow);
      expect(dayVal).toBeGreaterThanOrEqual(1);
      expect(dayVal).toBeLessThanOrEqual(7);
    });

    it("date register is 1-31", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x04);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const date = drv.readByte(false);
      drv.stop();

      const dateVal = fromBcd(date & 0x3f);
      expect(dateVal).toBeGreaterThanOrEqual(1);
      expect(dateVal).toBeLessThanOrEqual(31);
    });

    it("month register is 1-12", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x05);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const month = drv.readByte(false);
      drv.stop();

      const monVal = fromBcd(month & 0x1f);
      expect(monVal).toBeGreaterThanOrEqual(1);
      expect(monVal).toBeLessThanOrEqual(12);
    });

    it("year register is 0-99", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x06);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const year = drv.readByte(false);
      drv.stop();

      expect(fromBcd(year)).toBeLessThanOrEqual(99);
    });

    it("control register (0x07) is 0x00 after reset", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x07);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const ctrl = drv.readByte(false);
      drv.stop();

      expect(ctrl).toBe(0x00);
    });

    it("can write and read back seconds register", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00); // pointer to seconds
      drv.writeByte(0x30); // 30 seconds BCD
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      const sec = drv.readByte(false);
      drv.stop();

      expect(sec).toBe(0x30);
    });

    it("can read all 7 time registers sequentially", () => {
      // Set known time: 12:34:56 Monday 15/06/25
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00); // pointer to reg 0
      drv.writeByte(0x56); // seconds
      drv.writeByte(0x34); // minutes
      drv.writeByte(0x12); // hours (24h)
      drv.writeByte(0x02); // day (Monday)
      drv.writeByte(0x15); // date
      drv.writeByte(0x06); // month
      drv.writeByte(0x25); // year
      drv.stop();

      // Read them all back
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      expect(drv.readByte(true)).toBe(0x56);  // seconds
      expect(drv.readByte(true)).toBe(0x34);  // minutes
      expect(drv.readByte(true)).toBe(0x12);  // hours
      expect(drv.readByte(true)).toBe(0x02);  // day
      expect(drv.readByte(true)).toBe(0x15);  // date
      expect(drv.readByte(true)).toBe(0x06);  // month
      expect(drv.readByte(false)).toBe(0x25); // year (NACK)
      drv.stop();
    });
  });

  // --------------------------------------------------------------------------
  // SRAM region (0x08-0x3F)
  // --------------------------------------------------------------------------
  describe("SRAM (registers 0x08-0x3F)", () => {
    it("SRAM is initialized to 0 after reset", () => {
      for (let i = 0x08; i < 0x40; i++) {
        expect(dev.cmos[i]).toBe(0);
      }
    });

    it("can write and read back all 56 SRAM bytes", () => {
      // Write all SRAM bytes
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08); // pointer to SRAM start
      for (let i = 0; i < 56; i++) {
        drv.writeByte(i + 1); // values 1-56
      }
      drv.stop();

      // Read back
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, true);
      for (let i = 0; i < 55; i++) {
        expect(drv.readByte(true)).toBe(i + 1);
      }
      expect(drv.readByte(false)).toBe(56); // last byte, NACK
      drv.stop();
    });

    it("SRAM preserves data across read cycles", () => {
      // Write a pattern
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x20);
      drv.writeByte(0xCA);
      drv.writeByte(0xFE);
      drv.stop();

      // First read
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x20);
      drv.stop();
      drv.start();
      drv.address(DS1307_ADDR, true);
      expect(drv.readByte(true)).toBe(0xCA);
      expect(drv.readByte(false)).toBe(0xFE);
      drv.stop();

      // Second read — same data
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x20);
      drv.stop();
      drv.start();
      drv.address(DS1307_ADDR, true);
      expect(drv.readByte(true)).toBe(0xCA);
      expect(drv.readByte(false)).toBe(0xFE);
      drv.stop();
    });
  });

  // --------------------------------------------------------------------------
  // Register pointer behavior
  // --------------------------------------------------------------------------
  describe("Register pointer", () => {
    it("read without setting pointer starts from current position", () => {
      // Set pointer to 0x10
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x10);
      drv.writeByte(0x77);
      drv.stop();
      // Pointer is now at 0x11

      // Read without re-setting pointer
      drv.start();
      drv.address(DS1307_ADDR, true);
      const val = drv.readByte(false);
      drv.stop();
      // Should read from 0x11
      expect(val).toBe(dev.cmos[0x11]);
    });

    it("consecutive transactions maintain pointer position", () => {
      // Write to set pointer
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.writeByte(0xAA); // writes to 0x08, pointer now 0x09
      drv.writeByte(0xBB); // writes to 0x09, pointer now 0x0A
      drv.stop();

      // pointer is 0x0A
      expect(dev.regPointer).toBe(0x0a);
    });
  });

  // --------------------------------------------------------------------------
  // Repeated START (Sr) handling
  // --------------------------------------------------------------------------
  describe("Repeated START", () => {
    it("repeated START allows address change without STOP", () => {
      // Start a write to set pointer
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08); // set pointer

      // Repeated START for read (no STOP in between)
      dev.writeSdaPort(1);
      dev.writeSclPort(1);
      dev.writeSdaPort(0); // START
      dev.writeSclPort(0);

      const ack = drv.address(DS1307_ADDR, true);
      expect(ack).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  describe("Edge cases", () => {
    it("writing 0xFF SRAM value round-trips", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.writeByte(0xff);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.stop();
      drv.start();
      drv.address(DS1307_ADDR, true);
      expect(drv.readByte(false)).toBe(0xff);
      drv.stop();
    });

    it("writing 0x00 SRAM value round-trips", () => {
      // Write 0xFF first, then overwrite with 0x00
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.writeByte(0xff);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.writeByte(0x00);
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.stop();
      drv.start();
      drv.address(DS1307_ADDR, true);
      expect(drv.readByte(false)).toBe(0x00);
      drv.stop();
    });

    it("oscillator halt bit (CH) can be set and read", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00); // seconds register
      drv.writeByte(0x80); // CH=1, seconds=0
      drv.stop();

      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00);
      drv.stop();
      drv.start();
      drv.address(DS1307_ADDR, true);
      const val = drv.readByte(false);
      drv.stop();

      expect(val & 0x80).toBe(0x80); // CH bit set
      expect(val & 0x7f).toBe(0x00); // seconds = 0
    });

    it("SDA stays released after STOP", () => {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x08);
      drv.stop();
      expect(dev.readSdaPort()).toBe(0xff);
      expect(dev.readSclPort()).toBe(0xff);
    });

    it("multiple STOP conditions are harmless", () => {
      drv.stop();
      drv.stop();
      drv.stop();
      expect(dev.i2cState).toBe(0); // IDLE
    });
  });

  // --------------------------------------------------------------------------
  // DS1307 RTC clock advancement
  // --------------------------------------------------------------------------
  describe("Clock advancement", () => {
    /** Helper: set time registers directly via I2C write */
    function setTime(
      seconds: number,
      minutes: number,
      hours: number,
      dow: number,
      date: number,
      month: number,
      year: number,
      ch = false,
      is12h = false,
      pm = false
    ): void {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00); // pointer to reg 0
      drv.writeByte(toBcd(seconds) | (ch ? 0x80 : 0)); // seconds + CH
      drv.writeByte(toBcd(minutes)); // minutes
      if (is12h) {
        drv.writeByte(0x40 | (pm ? 0x20 : 0) | toBcd(hours)); // 12h mode
      } else {
        drv.writeByte(toBcd(hours)); // 24h mode
      }
      drv.writeByte(toBcd(dow));
      drv.writeByte(toBcd(date));
      drv.writeByte(toBcd(month));
      drv.writeByte(toBcd(year));
      drv.stop();
    }

    /** Helper: read time registers via I2C */
    function readTime(): {
      seconds: number;
      minutes: number;
      hours: number;
      dow: number;
      date: number;
      month: number;
      year: number;
      ch: boolean;
      is12h: boolean;
      pm: boolean;
      rawHours: number;
    } {
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x00);
      drv.stop();
      drv.start();
      drv.address(DS1307_ADDR, true);
      const secReg = drv.readByte(true);
      const minReg = drv.readByte(true);
      const hrsReg = drv.readByte(true);
      const dowReg = drv.readByte(true);
      const dateReg = drv.readByte(true);
      const monthReg = drv.readByte(true);
      const yearReg = drv.readByte(false);
      drv.stop();

      const is12h = !!(hrsReg & 0x40);
      const pm = !!(hrsReg & 0x20);
      return {
        seconds: fromBcd(secReg & 0x7f),
        minutes: fromBcd(minReg & 0x7f),
        hours: is12h ? fromBcd(hrsReg & 0x1f) : fromBcd(hrsReg & 0x3f),
        dow: fromBcd(dowReg & 0x07),
        date: fromBcd(dateReg & 0x3f),
        month: fromBcd(monthReg & 0x1f),
        year: fromBcd(yearReg),
        ch: !!(secReg & 0x80),
        is12h,
        pm,
        rawHours: hrsReg
      };
    }

    it("advances seconds by 1", () => {
      setTime(30, 15, 10, 3, 5, 6, 25);
      dev.advanceClock();
      const t = readTime();
      expect(t.seconds).toBe(31);
      expect(t.minutes).toBe(15);
      expect(t.hours).toBe(10);
    });

    it("seconds roll over from 59 to 0, minutes increment", () => {
      setTime(59, 15, 10, 3, 5, 6, 25);
      dev.advanceClock();
      const t = readTime();
      expect(t.seconds).toBe(0);
      expect(t.minutes).toBe(16);
      expect(t.hours).toBe(10);
    });

    it("minutes roll over from 59 to 0, hours increment", () => {
      setTime(59, 59, 10, 3, 5, 6, 25);
      dev.advanceClock();
      const t = readTime();
      expect(t.seconds).toBe(0);
      expect(t.minutes).toBe(0);
      expect(t.hours).toBe(11);
    });

    it("hours roll over from 23 to 0 in 24h mode, date advances", () => {
      setTime(59, 59, 23, 3, 5, 6, 25);
      dev.advanceClock();
      const t = readTime();
      expect(t.seconds).toBe(0);
      expect(t.minutes).toBe(0);
      expect(t.hours).toBe(0);
      expect(t.date).toBe(6);
      expect(t.dow).toBe(4);
    });

    it("day of week wraps from 7 to 1", () => {
      setTime(59, 59, 23, 7, 15, 3, 25);
      dev.advanceClock();
      const t = readTime();
      expect(t.dow).toBe(1);
    });

    it("date rolls over at end of 31-day month", () => {
      setTime(59, 59, 23, 5, 31, 1, 25); // Jan 31
      dev.advanceClock();
      const t = readTime();
      expect(t.date).toBe(1);
      expect(t.month).toBe(2); // February
    });

    it("date rolls over at end of 30-day month", () => {
      setTime(59, 59, 23, 2, 30, 4, 25); // April 30
      dev.advanceClock();
      const t = readTime();
      expect(t.date).toBe(1);
      expect(t.month).toBe(5); // May
    });

    it("February has 28 days in non-leap year", () => {
      setTime(59, 59, 23, 6, 28, 2, 25); // Feb 28, 2025
      dev.advanceClock();
      const t = readTime();
      expect(t.date).toBe(1);
      expect(t.month).toBe(3); // March
    });

    it("February has 29 days in leap year", () => {
      setTime(59, 59, 23, 4, 28, 2, 24); // Feb 28, 2024 (leap year)
      dev.advanceClock();
      const t = readTime();
      expect(t.date).toBe(29); // Still February
      expect(t.month).toBe(2);

      // Now set to end of Feb 29
      setTime(59, 59, 23, 5, 29, 2, 24); // Feb 29, 2024 23:59:59
      dev.advanceClock();
      const t2 = readTime();
      expect(t2.date).toBe(1);
      expect(t2.month).toBe(3); // Now March
    });

    it("month rolls over from 12 to 1, year increments", () => {
      setTime(59, 59, 23, 3, 31, 12, 25); // Dec 31, 2025
      dev.advanceClock();
      const t = readTime();
      expect(t.date).toBe(1);
      expect(t.month).toBe(1);
      expect(t.year).toBe(26);
    });

    it("year wraps from 99 to 0", () => {
      setTime(59, 59, 23, 1, 31, 12, 99); // Dec 31, 2099
      dev.advanceClock();
      const t = readTime();
      expect(t.year).toBe(0);
    });

    it("CH bit prevents clock advancement", () => {
      setTime(30, 15, 10, 3, 5, 6, 25, true); // CH=1
      dev.advanceClock();
      const t = readTime();
      expect(t.seconds).toBe(30); // unchanged
      expect(t.ch).toBe(true);
    });

    it("clearing CH bit allows clock advancement", () => {
      setTime(30, 15, 10, 3, 5, 6, 25, true); // CH=1
      dev.advanceClock();
      expect(readTime().seconds).toBe(30); // blocked

      setTime(30, 15, 10, 3, 5, 6, 25, false); // CH=0
      dev.advanceClock();
      expect(readTime().seconds).toBe(31); // advances
    });

    // --- 12-hour mode tests ---

    it("12h mode: advances normally AM", () => {
      setTime(59, 59, 10, 3, 5, 6, 25, false, true, false); // 10:59:59 AM
      dev.advanceClock();
      const t = readTime();
      expect(t.hours).toBe(11);
      expect(t.pm).toBe(false);
      expect(t.is12h).toBe(true);
    });

    it("12h mode: 11:59:59 AM → 12:00:00 PM", () => {
      setTime(59, 59, 11, 3, 5, 6, 25, false, true, false); // 11:59:59 AM
      dev.advanceClock();
      const t = readTime();
      expect(t.hours).toBe(12);
      expect(t.pm).toBe(true);
      expect(t.is12h).toBe(true);
    });

    it("12h mode: 12:59:59 PM → 1:00:00 PM", () => {
      setTime(59, 59, 12, 3, 5, 6, 25, false, true, true); // 12:59:59 PM
      dev.advanceClock();
      const t = readTime();
      expect(t.hours).toBe(1);
      expect(t.pm).toBe(true);
    });

    it("12h mode: 11:59:59 PM → 12:00:00 AM, date advances", () => {
      setTime(59, 59, 11, 3, 5, 6, 25, false, true, true); // 11:59:59 PM
      dev.advanceClock();
      const t = readTime();
      expect(t.hours).toBe(12);
      expect(t.pm).toBe(false); // AM
      expect(t.date).toBe(6); // date advanced
      expect(t.dow).toBe(4); // day of week advanced
    });

    // --- onNewFrame tests ---

    it("onNewFrame advances clock after framesPerSecond frames", () => {
      setTime(30, 15, 10, 3, 5, 6, 25);
      dev.setFrameRate(50);

      // 49 frames should not advance
      for (let i = 0; i < 49; i++) {
        dev.onNewFrame();
      }
      expect(readTime().seconds).toBe(30);

      // 50th frame advances
      dev.onNewFrame();
      expect(readTime().seconds).toBe(31);
    });

    it("onNewFrame works with 60 FPS", () => {
      setTime(0, 0, 0, 1, 1, 1, 0);
      dev.setFrameRate(60);

      for (let i = 0; i < 60; i++) {
        dev.onNewFrame();
      }
      expect(readTime().seconds).toBe(1);
    });

    it("multiple seconds advance correctly via onNewFrame", () => {
      setTime(0, 0, 0, 1, 1, 1, 0);
      dev.setFrameRate(50);

      // 5 seconds = 250 frames
      for (let i = 0; i < 250; i++) {
        dev.onNewFrame();
      }
      expect(readTime().seconds).toBe(5);
    });

    it("SRAM preserves across clock advancement", () => {
      // Write SRAM data
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x10);
      drv.writeByte(0xDE);
      drv.writeByte(0xAD);
      drv.stop();

      setTime(59, 59, 23, 1, 1, 1, 25);
      dev.advanceClock();

      // SRAM should be unchanged
      expect(dev.cmos[0x10]).toBe(0xDE);
      expect(dev.cmos[0x11]).toBe(0xAD);
    });

    it("control register (0x07) is unchanged by clock advancement", () => {
      // Set a control value
      drv.start();
      drv.address(DS1307_ADDR, false);
      drv.writeByte(0x07);
      drv.writeByte(0x10); // SQW config
      drv.stop();

      setTime(30, 15, 10, 3, 5, 6, 25);
      dev.advanceClock();
      expect(dev.cmos[0x07]).toBe(0x10);
    });
  });
});
