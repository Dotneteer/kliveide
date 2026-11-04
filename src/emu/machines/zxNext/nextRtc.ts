/*
 * The DS1307 real-time clock's register arithmetic: BCD and the one-second counter chain.
 *
 * Neutral: shared by the TypeScript `I2cDevice`, the WASM machine (which seeds the core's clock with the
 * host time) and the tests. zxnext-i2c.c implements the same counter in the WASM core.
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


// ==========================================================================================
// The clock against the host's clock (`dev/ai/zxnext-rtc.md` D4)
//
// Times are *wall seconds*: seconds since 2000-01-01 00:00:00 of a calendar with no time zone, so the
// registers and the host's local time compare directly (the DS1307 knows no zone either). A host that
// changes its zone or its daylight saving moves the clock with it, as its own clock moves.

/** What a kept or followed clock needs besides the host's time */
export type RtcClockState = {
  /** The clock's time minus the host's, in whole seconds */
  offsetSeconds: number;
  /** The program's day-of-week numbering against Sunday = 1, as 0-6 */
  dayOffset: number;
  /** The hours register is in 12-hour mode (bit 6) */
  hours12: boolean;
};

const WALL_EPOCH_MS = Date.UTC(2000, 0, 1);

/** The host's local time as wall seconds */
export function hostWallSeconds(hostMs: number): number {
  const d = new Date(hostMs);
  const wall = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  return Math.floor((wall - WALL_EPOCH_MS) / 1000);
}

/** A BCD field's value, or undefined when it is not BCD or out of range */
function bcdField(value: number, min: number, max: number): number | undefined {
  if ((value & 0x0f) > 9 || ((value >> 4) & 0x0f) > 9) return undefined;
  const v = fromBcd(value);
  return v >= min && v <= max ? v : undefined;
}

/** The 24-hour hour of the hours register (either mode), or undefined when it is invalid */
function hourOf(reg: number): number | undefined {
  if (reg & 0x40) {
    const h = bcdField(reg & 0x1f, 1, 12);
    return h === undefined ? undefined : (h % 12) + (reg & 0x20 ? 12 : 0);
  }
  return bcdField(reg & 0x3f, 0, 23);
}

/** Sunday = 1 ... Saturday = 7, for wall seconds */
function computedDay(wall: number): number {
  return new Date(WALL_EPOCH_MS + wall * 1000).getUTCDay() + 1;
}

/**
 * Registers 0-6 as wall seconds (years 2000-2099), or undefined when they hold no valid date and time
 * (a program may write anything). The CH bit and the day of week do not take part.
 */
export function rtcRegistersToSeconds(regs: ArrayLike<number>): number | undefined {
  const seconds = bcdField(regs[0] & 0x7f, 0, 59);
  const minutes = bcdField(regs[1] & 0x7f, 0, 59);
  const hours = hourOf(regs[2]);
  const year = bcdField(regs[6], 0, 99);
  const month = bcdField(regs[5] & 0x1f, 1, 12);
  const date = bcdField(regs[4] & 0x3f, 1, 31);
  if ([seconds, minutes, hours, year, month, date].some((v) => v === undefined)) return undefined;
  const ms = Date.UTC(2000 + year!, month! - 1, date!, hours!, minutes!, seconds!);
  // --- 31 February is no date: Date.UTC would roll it into March
  if (new Date(ms).getUTCDate() !== date) return undefined;
  return Math.floor((ms - WALL_EPOCH_MS) / 1000);
}

/**
 * Registers 0-6 for wall seconds, in the given hour mode and day numbering. The years wrap at 2100 as
 * the chip's do; CH is clear.
 */
export function rtcRegistersFromSeconds(wall: number, hours12: boolean, dayOffset: number): number[] {
  const d = new Date(WALL_EPOCH_MS + wall * 1000);
  const h = d.getUTCHours();
  const hours = hours12 ? 0x40 | (h >= 12 ? 0x20 : 0) | toBcd(h % 12 === 0 ? 12 : h % 12) : toBcd(h);
  const day = ((((d.getUTCDay() + dayOffset) % 7) + 7) % 7) + 1;
  return [
    toBcd(d.getUTCSeconds()),
    toBcd(d.getUTCMinutes()),
    hours,
    day,
    toBcd(d.getUTCDate()),
    toBcd(d.getUTCMonth() + 1),
    toBcd(d.getUTCFullYear() % 100)
  ];
}

/** The clock state of registers 0-6 against the host's time, or undefined for an invalid time */
export function rtcStateOf(regs: ArrayLike<number>, hostMs: number): RtcClockState | undefined {
  const wall = rtcRegistersToSeconds(regs);
  if (wall === undefined) return undefined;
  const day = regs[3] & 0x07;
  return {
    offsetSeconds: wall - hostWallSeconds(hostMs),
    dayOffset: day >= 1 ? (((day - computedDay(wall)) % 7) + 7) % 7 : 0,
    hours12: (regs[2] & 0x40) !== 0
  };
}

/** Registers 0-6 a clock in this state shows at the host's time */
export function rtcTargetRegisters(state: RtcClockState, hostMs: number): number[] {
  return rtcRegistersFromSeconds(hostWallSeconds(hostMs) + state.offsetSeconds, state.hours12, state.dayOffset);
}
