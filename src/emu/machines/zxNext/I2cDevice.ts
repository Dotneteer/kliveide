import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { Clock28, CLOCK28_PER_SECOND } from "./Clock28";

/*
 * The Next's I2C bus (zxnext.vhd ~3224: a bit-banged master on ports $103B SCL / $113B SDA, bit 0,
 * open drain, both released by a reset; a read gives "1111111" & the line) with the board's DS1307
 * real-time clock on it (Maxim DS1307 datasheet). zxnext-i2c.c implements the same model in the WASM
 * core.
 *
 * The DS1307 is a separate, battery-backed chip: no Next reset touches its registers, its RAM or its
 * clock. It counts seconds on its own crystal; here that is the machine's 28 MHz clock (28M clocks per
 * second, the same wall-clock the app paces by).
 */

/** Convert a number to BCD encoding */
export function toBcd(value: number): number {
  return ((Math.floor(value / 10) & 0x0f) << 4) | (value % 10);
}

/** Convert BCD encoding to a number */
export function fromBcd(bcd: number): number {
  return ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
}

/** The DS1307 time registers 0-6 (seconds ... year, 24-hour mode, oscillator running) for a date. */
export function rtcRegistersFromDate(date: Date): number[] {
  return [
    toBcd(date.getSeconds()),
    toBcd(date.getMinutes()),
    toBcd(date.getHours()),
    date.getDay() + 1, // --- day of week 1-7, Sunday = 1 (the DS1307 only counts it)
    toBcd(date.getDate()),
    toBcd(date.getMonth() + 1),
    toBcd(date.getFullYear() % 100)
  ];
}

/**
 * One second of the DS1307's counter chain over registers 0-6: seconds, minutes, hours (12- or
 * 24-hour, bit 6), day of week 1-7, date, month, year 00-99 with a leap year every fourth (valid to
 * 2100). The caller has checked that the oscillator runs (CH, register 0 bit 7, is 0).
 */
export function rtcAdvanceOneSecond(r: Uint8Array | number[]): void {
  const seconds = fromBcd(r[0] & 0x7f) + 1;
  if (seconds < 60) {
    r[0] = toBcd(seconds);
    return;
  }
  r[0] = 0x00;
  const minutes = fromBcd(r[1] & 0x7f) + 1;
  if (minutes < 60) {
    r[1] = toBcd(minutes);
    return;
  }
  r[1] = 0x00;
  let newDay: boolean;
  if (r[2] & 0x40) {
    // --- 12-hour mode: 12 -> 1 -> ... -> 11 -> 12, AM/PM (bit 5) flips at 11 -> 12
    let hours = fromBcd(r[2] & 0x1f) + 1;
    let pm = (r[2] & 0x20) !== 0;
    newDay = false;
    if (hours === 12) {
      pm = !pm;
      newDay = !pm;
    } else if (hours > 12) {
      hours = 1;
    }
    r[2] = 0x40 | (pm ? 0x20 : 0) | toBcd(hours);
  } else {
    const hours = fromBcd(r[2] & 0x3f) + 1;
    newDay = hours >= 24;
    r[2] = newDay ? 0x00 : toBcd(hours);
  }
  if (!newDay) return;

  r[3] = (r[3] & 0x07) >= 7 ? 1 : (r[3] & 0x07) + 1;
  const year = fromBcd(r[6]);
  const month = fromBcd(r[5] & 0x1f);
  const monthDays = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
  const date = fromBcd(r[4] & 0x3f) + 1;
  if (date <= monthDays) {
    r[4] = toBcd(date);
    return;
  }
  r[4] = 0x01;
  if (month < 12) {
    r[5] = toBcd(month + 1);
    return;
  }
  r[5] = 0x01;
  r[6] = toBcd((year + 1) % 100);
}

/** Bus states of the DS1307's I2C slave */
const enum I2cState {
  IDLE = 0,
  ADDRESS = 1,
  ADDRESS_ACK = 2,
  DATA_WRITE = 3,
  DATA_WRITE_ACK = 4,
  DATA_READ = 5,
  DATA_READ_ACK = 6
}

/** The DS1307 answers slave address $68 ($D0 write, $D1 read). */
const DS1307_ADDRESS = 0x68;

export class I2cDevice implements IGenericDevice<IZxNextMachine> {
  // --- The master's outputs (1 = released, the pull-up keeps the line high) and the slave's SDA
  private _sclOut = true;
  private _sdaOut = true;
  private _sdaSlave = true;
  private _prevScl = true;
  private _prevSda = true;

  // --- The DS1307's I2C slave
  private _state = I2cState.IDLE;
  private _shiftReg = 0;
  private _bitCount = 0;
  private _isRead = false;
  private _addressed = false;
  private _firstWrite = true;

  // --- DS1307: 7 time registers, control, 56 bytes of RAM; the user buffer read between STARTs
  private readonly _regs = new Uint8Array(0x40);
  private readonly _user = new Uint8Array(7);
  private _regPointer = 0;
  private readonly _clock: Clock28;
  /** The 28 MHz clock when the current second started (-1: at the first use) */
  private _countdownStart = -1;

  constructor(public readonly machine: IZxNextMachine) {
    this._clock = new Clock28(machine);
    // --- The host's time; the second starts when the machine first uses the clock
    this._regs.set(rtcRegistersFromDate(new Date()));
  }

  /** A Next reset releases SCL and SDA (zxnext.vhd ~3232); the DS1307 itself keeps everything. */
  reset(): void {
    this._sclOut = true;
    this._sdaOut = true;
    this._sdaSlave = true;
    this._prevScl = true;
    this._prevSda = true;
    this._state = I2cState.IDLE;
    this._addressed = false;
  }

  dispose(): void {}

  // =========================================================================
  // Ports $103B / $113B

  writeSclPort(value: number): void {
    this._sclOut = (value & 0x01) !== 0;
    this._processI2c();
  }

  /** "1111111" & the SCL line: the DS1307 never stretches the clock. */
  readSclPort(): number {
    return 0xfe | (this._sclOut ? 1 : 0);
  }

  writeSdaPort(value: number): void {
    this._sdaOut = (value & 0x01) !== 0;
    this._processI2c();
  }

  /** "1111111" & the SDA line: low while the master or the DS1307 pulls it low. */
  readSdaPort(): number {
    return 0xfe | (this._sdaOut && this._sdaSlave ? 1 : 0);
  }

  // =========================================================================
  // DS1307 clock

  /**
   * Sets time registers 0-6 as a clock set before (the battery keeps it) and restarts the second.
   * The app sets the host's time at start-up; the test harness sets a known one.
   */
  setRtcTime(registers: ArrayLike<number>): void {
    for (let i = 0; i < 7; i++) this._regs[i] = registers[i] & 0xff;
    this._countdownStart = this._clock.now();
  }

  /** Brings the counter chain up to the machine's clock: one step per whole second elapsed. */
  private _syncClock(): void {
    if (this._countdownStart < 0) {
      this._countdownStart = this._clock.now();
      return;
    }
    const now = this._clock.now();
    if (this._regs[0] & 0x80) {
      // --- CH: the oscillator is stopped
      this._countdownStart = now;
      return;
    }
    const seconds = Math.floor((now - this._countdownStart) / CLOCK28_PER_SECOND);
    for (let i = 0; i < seconds; i++) rtcAdvanceOneSecond(this._regs);
    this._countdownStart += seconds * CLOCK28_PER_SECOND;
  }

  // =========================================================================
  // I2C protocol

  private _processI2c(): void {
    const scl = this._sclOut;
    const sda = this._sdaOut;
    const prevScl = this._prevScl;
    const prevSda = this._prevSda;
    this._prevScl = scl;
    this._prevSda = sda;

    // --- START (also a repeated START): SDA falls while SCL is high
    if (prevSda && !sda && scl && prevScl) {
      this._state = I2cState.ADDRESS;
      this._bitCount = 0;
      this._shiftReg = 0;
      this._addressed = false;
      this._sdaSlave = true;
      // --- The user buffer follows the running registers on every START
      this._syncClock();
      this._user.set(this._regs.subarray(0, 7));
      return;
    }

    // --- STOP: SDA rises while SCL is high
    if (!prevSda && sda && scl && prevScl) {
      this._state = I2cState.IDLE;
      this._addressed = false;
      this._sdaSlave = true;
      return;
    }

    if (scl && !prevScl) this._onSclRisingEdge(sda);
    if (!scl && prevScl) this._onSclFallingEdge();
  }

  /** SCL rising edge: the master's bit is valid (data, or its ACK/NACK). */
  private _onSclRisingEdge(sda: boolean): void {
    switch (this._state) {
      case I2cState.ADDRESS:
        this._shiftReg = ((this._shiftReg << 1) | (sda ? 1 : 0)) & 0xff;
        if (++this._bitCount === 8) {
          this._isRead = (this._shiftReg & 0x01) !== 0;
          this._addressed = this._shiftReg >> 1 === DS1307_ADDRESS;
          this._state = I2cState.ADDRESS_ACK;
        }
        break;

      case I2cState.ADDRESS_ACK:
        if (!this._addressed) {
          this._state = I2cState.IDLE;
        } else if (this._isRead) {
          this._state = I2cState.DATA_READ;
          this._bitCount = 0;
          this._shiftReg = this._readRegister();
        } else {
          this._state = I2cState.DATA_WRITE;
          this._bitCount = 0;
          this._shiftReg = 0;
          this._firstWrite = true;
        }
        break;

      case I2cState.DATA_WRITE:
        this._shiftReg = ((this._shiftReg << 1) | (sda ? 1 : 0)) & 0xff;
        if (++this._bitCount === 8) {
          this._writeRegister(this._shiftReg);
          this._state = I2cState.DATA_WRITE_ACK;
        }
        break;

      case I2cState.DATA_WRITE_ACK:
        this._state = I2cState.DATA_WRITE;
        this._bitCount = 0;
        this._shiftReg = 0;
        break;

      case I2cState.DATA_READ:
        if (++this._bitCount === 8) this._state = I2cState.DATA_READ_ACK;
        break;

      case I2cState.DATA_READ_ACK:
        if (!sda) {
          // --- ACK: the next byte
          this._state = I2cState.DATA_READ;
          this._bitCount = 0;
          this._shiftReg = this._readRegister();
        } else {
          // --- NACK: the master is done
          this._state = I2cState.IDLE;
          this._sdaSlave = true;
        }
        break;
    }
  }

  /** SCL falling edge: the DS1307 drives SDA for its ACK or its next data bit. */
  private _onSclFallingEdge(): void {
    switch (this._state) {
      case I2cState.ADDRESS_ACK:
        this._sdaSlave = !this._addressed;
        break;
      case I2cState.DATA_WRITE_ACK:
        this._sdaSlave = false;
        break;
      case I2cState.DATA_READ:
        this._sdaSlave = ((this._shiftReg >> (7 - this._bitCount)) & 0x01) !== 0;
        break;
      default:
        this._sdaSlave = true;
        break;
    }
  }

  /** Time registers come from the user buffer, the rest from RAM; the pointer wraps $3F -> $00. */
  private _readRegister(): number {
    const p = this._regPointer;
    this._regPointer = (p + 1) & 0x3f;
    return p < 7 ? this._user[p] : this._regs[p];
  }

  /**
   * The first byte of a write sets the register pointer, the others write and advance it. Writing
   * the seconds register restarts the second (the countdown chain).
   */
  private _writeRegister(data: number): void {
    if (this._firstWrite) {
      this._regPointer = data & 0x3f;
      this._firstWrite = false;
      return;
    }
    const p = this._regPointer;
    this._regPointer = (p + 1) & 0x3f;
    this._syncClock();
    this._regs[p] = data;
    if (p < 7) this._user[p] = data;
    if (p === 0) this._countdownStart = this._clock.now();
  }
}
