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

