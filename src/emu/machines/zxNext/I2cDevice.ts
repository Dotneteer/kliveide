import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

/**
 * I2C bus protocol states
 */
const enum I2cState {
  /** Idle — waiting for START condition */
  IDLE = 0,
  /** Receiving address byte (7-bit address + R/W bit) */
  ADDRESS = 1,
  /** Master waiting for slave ACK after address */
  ADDRESS_ACK = 2,
  /** Receiving data byte from master (write) */
  DATA_WRITE = 3,
  /** Master waiting for slave ACK after data write */
  DATA_WRITE_ACK = 4,
  /** Slave sending data byte to master (read) */
  DATA_READ = 5,
  /** Slave waiting for master ACK/NACK after data read */
  DATA_READ_ACK = 6
}

/**
 * DS1307 RTC register layout:
 * 0x00: Seconds (BCD, bit 7 = CH oscillator halt)
 * 0x01: Minutes (BCD)
 * 0x02: Hours (BCD, bit 6 = 12/24, bit 5 = AM/PM or tens)
 * 0x03: Day of week (1-7)
 * 0x04: Date (BCD, 1-31)
 * 0x05: Month (BCD, 1-12)
 * 0x06: Year (BCD, 0-99)
 * 0x07: Control (SQW output)
 * 0x08-0x3F: SRAM (56 bytes)
 */

/**
 * Convert a number to BCD encoding
 */
export function toBcd(value: number): number {
  return ((Math.floor(value / 10) & 0x0f) << 4) | (value % 10);
}

/**
 * Convert BCD encoding to a number
 */
export function fromBcd(bcd: number): number {
  return ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
}

/**
 * I2C Bus device with integrated DS1307 RTC slave.
 *
 * The FPGA implements I2C as pure bit-banged SCL/SDA lines via ports
 * 0x103B and 0x113B. This device:
 * - Tracks SCL and SDA line states (open-drain, active low)
 * - Detects START condition (SDA falls while SCL high)
 * - Detects STOP condition (SDA rises while SCL high)
 * - On SCL rising edge: shifts in/out data bits
 * - Decodes I2C address 0x68 (DS1307, 0xD0 >> 1)
 * - Provides DS1307 register read/write with BCD time + 56 bytes SRAM
 *
 * The DS1307 uses a register pointer that auto-increments on each
 * byte read/write, wrapping within 0x00-0x3F.
 */
export class I2cDevice implements IGenericDevice<IZxNextMachine> {
  // --- I2C line state
  private _sclOut = true;  // SCL output from CPU (1 = released/high)
  private _sdaOut = true;  // SDA output from CPU (1 = released/high)
  private _sdaSlave = true; // SDA driven by slave (for ACK and read data)

  // --- Previous SCL/SDA for edge detection
  private _prevScl = true;
  private _prevSda = true;

  // --- I2C protocol state
  private _state: I2cState = I2cState.IDLE;
  private _shiftReg = 0;    // 8-bit shift register for current byte
  private _bitCount = 0;    // bits shifted so far (0-7)
  private _isRead = false;  // R/W bit from address byte
  private _addressed = false; // true if our device was addressed

  // --- DS1307 register file (64 bytes: 7 time + 1 control + 56 SRAM)
  private _cmos = new Uint8Array(0x40);
  private _regPointer = 0;  // auto-incrementing register pointer

  // --- DS1307 I2C address (0x68 = 0xD0 >> 1)
  private static readonly DS1307_ADDRESS = 0x68;

  // --- First write byte after address sets register pointer
  private _firstWrite = true;

  // --- Frame counter for 1 Hz RTC tick (DS1307 runs at 32.768 kHz / 32768 = 1 Hz)
  private _frameCounter = 0;

  // --- Number of frames per second (PAL ≈ 50, NTSC ≈ 60)
  private _framesPerSecond = 50;

  constructor(public readonly machine: IZxNextMachine) {
    this._initRtcFromHostClock();
  }

  reset(): void {
    this._sclOut = true;
    this._sdaOut = true;
    this._sdaSlave = true;
    this._prevScl = true;
    this._prevSda = true;
    this._state = I2cState.IDLE;
    this._shiftReg = 0;
    this._bitCount = 0;
    this._isRead = false;
    this._addressed = false;
    this._firstWrite = true;
    this._frameCounter = 0;
    this._regPointer = 0;
    this._initRtcFromHostClock();
  }

  // =========================================================================
  // Port interface (called from port handlers)
  // =========================================================================

  /**
   * Write to SCL port (0x103B). Bit 0 controls SCL line.
   * FPGA: on rising_edge(i_CLK_28), if port_103b_wr then i2c_scl_o <= cpu_do(0)
   */
  writeSclPort(value: number): void {
    const newScl = !!(value & 0x01);
    this._sclOut = newScl;
    this._processI2c();
  }

  /**
   * Read SCL port (0x103B). Returns 0xFE | SCL line state.
   * FPGA: port_103b_dat <= "1111111" & (i_I2C_SCL_n and pi_i2c1_scl)
   * In emulation without external I2C, SCL reads back what we wrote.
   */
  readSclPort(): number {
    return 0xfe | (this._sclOut ? 1 : 0);
  }

  /**
   * Write to SDA port (0x113B). Bit 0 controls SDA line.
   * FPGA: on rising_edge(i_CLK_28), if port_113b_wr then i2c_sda_o <= cpu_do(0)
   */
  writeSdaPort(value: number): void {
    const newSda = !!(value & 0x01);
    this._sdaOut = newSda;
    this._processI2c();
  }

  /**
   * Read SDA port (0x113B). Returns 0xFE | SDA line state.
   * SDA is the AND of master output and slave output (open-drain).
   * FPGA: port_113b_dat <= "1111111" & (i_I2C_SDA_n and pi_i2c1_sda)
   * MAME: 0xfe | (m_i2c_sda_data & 1) where sda_data is updated by slave callback
   */
  readSdaPort(): number {
    // Open-drain: SDA line is low if either master or slave pulls it low
    const sdaLine = this._sdaOut && this._sdaSlave;
    return 0xfe | (sdaLine ? 1 : 0);
  }

  // =========================================================================
  // DS1307 RTC clock advancement
  // =========================================================================

  /**
   * Set the frame rate for RTC tick calculation.
   * @param fps Frames per second (50 for PAL, 60 for NTSC)
   */
  setFrameRate(fps: number): void {
    this._framesPerSecond = fps;
  }

  /**
   * Called at the start of each machine frame. Counts frames and advances
   * the DS1307 clock by one second when enough frames have elapsed.
   * MAME equivalent: timer_callback → advance_seconds → rtc_clock_updated
   */
  onNewFrame(): void {
    this._frameCounter++;
    if (this._frameCounter >= this._framesPerSecond) {
      this._frameCounter = 0;
      this.advanceClock();
    }
  }

  /**
   * Advance the DS1307 clock by one second.
   * Respects the CH (Clock Halt) bit in register 0x00 bit 7.
   * Handles BCD carry through seconds → minutes → hours → date → month → year.
   * Supports both 12-hour and 24-hour modes (register 0x02 bit 6).
   */
  advanceClock(): void {
    // --- Check CH (Clock Halt) bit: if set, oscillator is stopped
    if (this._cmos[0x00] & 0x80) {
      return;
    }

    // --- Decode current time from BCD
    let seconds = fromBcd(this._cmos[0x00] & 0x7f);
    let minutes = fromBcd(this._cmos[0x01] & 0x7f);
    const is12Hour = !!(this._cmos[0x02] & 0x40);
    let hours: number;
    let isPm = false;

    if (is12Hour) {
      isPm = !!(this._cmos[0x02] & 0x20);
      hours = fromBcd(this._cmos[0x02] & 0x1f);
    } else {
      hours = fromBcd(this._cmos[0x02] & 0x3f);
    }

    let dayOfWeek = fromBcd(this._cmos[0x03] & 0x07);
    let date = fromBcd(this._cmos[0x04] & 0x3f);
    let month = fromBcd(this._cmos[0x05] & 0x1f);
    let year = fromBcd(this._cmos[0x06]);

    // --- Advance seconds
    seconds++;
    if (seconds >= 60) {
      seconds = 0;
      minutes++;
      if (minutes >= 60) {
        minutes = 0;

        if (is12Hour) {
          // --- 12-hour mode: 12→1→2→...→11→12→1→...
          hours++;
          if (hours === 12) {
            // Toggle AM/PM at 12
            isPm = !isPm;
            if (!isPm) {
              // AM after PM means new day
              this._advanceDate(dayOfWeek, date, month, year);
              dayOfWeek = fromBcd(this._cmos[0x03] & 0x07);
              date = fromBcd(this._cmos[0x04] & 0x3f);
              month = fromBcd(this._cmos[0x05] & 0x1f);
              year = fromBcd(this._cmos[0x06]);
            }
          } else if (hours > 12) {
            hours = 1;
          }
        } else {
          // --- 24-hour mode
          hours++;
          if (hours >= 24) {
            hours = 0;
            this._advanceDate(dayOfWeek, date, month, year);
            dayOfWeek = fromBcd(this._cmos[0x03] & 0x07);
            date = fromBcd(this._cmos[0x04] & 0x3f);
            month = fromBcd(this._cmos[0x05] & 0x1f);
            year = fromBcd(this._cmos[0x06]);
          }
        }

        // --- Encode hours
        if (is12Hour) {
          this._cmos[0x02] = 0x40 | (isPm ? 0x20 : 0) | toBcd(hours);
        } else {
          this._cmos[0x02] = toBcd(hours);
        }
      }
      this._cmos[0x01] = toBcd(minutes);
    }
    this._cmos[0x00] = toBcd(seconds); // CH bit was 0 (checked above)
  }

  /**
   * Advance date/day-of-week/month/year by one day.
   * Writes directly to CMOS registers.
   */
  private _advanceDate(dayOfWeek: number, date: number, month: number, year: number): void {
    // --- Advance day of week (1-7, wraps 7→1)
    dayOfWeek = dayOfWeek >= 7 ? 1 : dayOfWeek + 1;
    this._cmos[0x03] = toBcd(dayOfWeek);

    // --- Days in month (simplified, no leap year for 2-digit year)
    const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // Leap year check: year is 2-digit, assume 2000-based
    if (month === 2 && ((year % 4 === 0 && year % 100 !== 0) || year === 0)) {
      daysInMonth[2] = 29;
    }

    date++;
    if (date > (daysInMonth[month] || 31)) {
      date = 1;
      month++;
      if (month > 12) {
        month = 1;
        year = (year + 1) % 100;
        this._cmos[0x06] = toBcd(year);
      }
      this._cmos[0x05] = toBcd(month);
    }
    this._cmos[0x04] = toBcd(date);
  }

  // =========================================================================
  // DS1307 RTC register access
  // =========================================================================

  /**
   * Get the current DS1307 register file (for testing/inspection)
   */
  get cmos(): Uint8Array {
    return this._cmos;
  }

  /**
   * Get the current register pointer
   */
  get regPointer(): number {
    return this._regPointer;
  }

  /**
   * Get the I2C protocol state (for testing)
   */
  get i2cState(): I2cState {
    return this._state;
  }

  /**
   * Get SCL output state
   */
  get sclOut(): boolean {
    return this._sclOut;
  }

  /**
   * Get SDA output state (from master)
   */
  get sdaOut(): boolean {
    return this._sdaOut;
  }

  /**
   * Get effective SDA line (AND of master + slave)
   */
  get sdaLine(): boolean {
    return this._sdaOut && this._sdaSlave;
  }

  // =========================================================================
  // I2C Protocol Engine
  // =========================================================================

  /**
   * Process I2C protocol after any SCL/SDA change.
   * Detects START/STOP conditions, shifts data, generates ACK.
   */
  private _processI2c(): void {
    const scl = this._sclOut;
    const sda = this._sdaOut;
    const prevScl = this._prevScl;
    const prevSda = this._prevSda;

    // Detect START condition: SDA falls while SCL is high
    if (prevSda && !sda && scl) {
      this._state = I2cState.ADDRESS;
      this._bitCount = 0;
      this._shiftReg = 0;
      this._addressed = false;
      this._sdaSlave = true; // release SDA
      this._prevScl = scl;
      this._prevSda = sda;
      return;
    }

    // Detect STOP condition: SDA rises while SCL is high
    if (!prevSda && sda && scl) {
      this._state = I2cState.IDLE;
      this._addressed = false;
      this._sdaSlave = true; // release SDA
      this._prevScl = scl;
      this._prevSda = sda;
      return;
    }

    // On SCL rising edge: process data
    if (scl && !prevScl) {
      this._onSclRisingEdge(sda);
    }

    // On SCL falling edge: prepare next bit for read
    if (!scl && prevScl) {
      this._onSclFallingEdge();
    }

    this._prevScl = scl;
    this._prevSda = sda;
  }

  /**
   * SCL rising edge: sample SDA for incoming data, or process ACK/NACK
   */
  private _onSclRisingEdge(sda: boolean): void {
    switch (this._state) {
      case I2cState.ADDRESS:
        // Shift in address bit (MSB first)
        this._shiftReg = ((this._shiftReg << 1) | (sda ? 1 : 0)) & 0xff;
        this._bitCount++;
        if (this._bitCount === 8) {
          // Full address byte received: bits 7-1 = address, bit 0 = R/W
          const address = (this._shiftReg >> 1) & 0x7f;
          this._isRead = !!(this._shiftReg & 0x01);
          this._addressed = address === I2cDevice.DS1307_ADDRESS;
          this._state = I2cState.ADDRESS_ACK;
        }
        break;

      case I2cState.ADDRESS_ACK:
        // Master reads our ACK (slave should have pulled SDA low on falling edge)
        if (this._addressed) {
          if (this._isRead) {
            this._state = I2cState.DATA_READ;
            this._bitCount = 0;
            this._shiftReg = this._readDs1307Register();
          } else {
            this._state = I2cState.DATA_WRITE;
            this._bitCount = 0;
            this._shiftReg = 0;
            this._firstWrite = true;
          }
        } else {
          this._state = I2cState.IDLE;
        }
        break;

      case I2cState.DATA_WRITE:
        // Shift in data bit from master
        this._shiftReg = ((this._shiftReg << 1) | (sda ? 1 : 0)) & 0xff;
        this._bitCount++;
        if (this._bitCount === 8) {
          this._writeDs1307Register(this._shiftReg);
          this._state = I2cState.DATA_WRITE_ACK;
        }
        break;

      case I2cState.DATA_WRITE_ACK:
        // Master reads our ACK; prepare for next byte
        this._state = I2cState.DATA_WRITE;
        this._bitCount = 0;
        this._shiftReg = 0;
        break;

      case I2cState.DATA_READ:
        // Master clocks a bit of our data out (we set SDA on falling edge)
        this._bitCount++;
        if (this._bitCount === 8) {
          this._state = I2cState.DATA_READ_ACK;
        }
        break;

      case I2cState.DATA_READ_ACK:
        // Master sends ACK (SDA low) or NACK (SDA high)
        if (!sda) {
          // ACK — master wants more data
          this._state = I2cState.DATA_READ;
          this._bitCount = 0;
          this._shiftReg = this._readDs1307Register();
        } else {
          // NACK — master done reading
          this._state = I2cState.IDLE;
          this._sdaSlave = true;
        }
        break;
    }
  }

  /**
   * SCL falling edge: drive SDA for ACK or read data bits
   */
  private _onSclFallingEdge(): void {
    switch (this._state) {
      case I2cState.ADDRESS_ACK:
        // Slave drives ACK (SDA low) if addressed
        this._sdaSlave = !this._addressed;
        break;

      case I2cState.DATA_WRITE_ACK:
        // Slave drives ACK (SDA low)
        this._sdaSlave = false;
        break;

      case I2cState.DATA_READ:
        // Slave drives next data bit (MSB first)
        this._sdaSlave = !!((this._shiftReg >> (7 - this._bitCount)) & 0x01);
        break;

      case I2cState.DATA_READ_ACK:
        // Release SDA for master ACK/NACK
        this._sdaSlave = true;
        break;

      default:
        // Release SDA
        this._sdaSlave = true;
        break;
    }
  }

  // =========================================================================
  // DS1307 Register File
  // =========================================================================

  /**
   * Read a byte from the DS1307 at the current register pointer,
   * then auto-increment the pointer (wrapping at 0x3F).
   */
  private _readDs1307Register(): number {
    const value = this._cmos[this._regPointer & 0x3f];
    this._regPointer = (this._regPointer + 1) & 0x3f;
    return value;
  }

  /**
   * Write a byte to the DS1307 at the current register pointer,
   * then auto-increment the pointer (wrapping at 0x3F).
   *
   * DS1307 protocol: first write byte after address sets the register pointer,
   * subsequent bytes are data written to successive registers.
   */
  private _writeDs1307Register(data: number): void {
    if (this._firstWrite) {
      // First byte after address is the register pointer
      this._regPointer = data & 0x3f;
      this._firstWrite = false;
    } else {
      this._cmos[this._regPointer & 0x3f] = data;
      this._regPointer = (this._regPointer + 1) & 0x3f;
    }
  }

  /**
   * Initialize the DS1307 register file from the host system clock.
   */
  private _initRtcFromHostClock(): void {
    this._cmos.fill(0);
    this._firstWrite = true;
    const now = new Date();
    this._cmos[0x00] = toBcd(now.getSeconds());         // seconds (CH=0, oscillator running)
    this._cmos[0x01] = toBcd(now.getMinutes());         // minutes
    this._cmos[0x02] = toBcd(now.getHours());           // hours (24h mode, bit 6 = 0)
    this._cmos[0x03] = toBcd(now.getDay() + 1);         // day of week (1-7, Sunday=1)
    this._cmos[0x04] = toBcd(now.getDate());             // date
    this._cmos[0x05] = toBcd(now.getMonth() + 1);       // month (1-12)
    this._cmos[0x06] = toBcd(now.getFullYear() % 100);   // year
    this._cmos[0x07] = 0x00;                             // control: SQW off
  }
}
