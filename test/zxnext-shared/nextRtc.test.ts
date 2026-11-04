import { describe, expect, it } from "vitest";
import {
  fromBcd,
  hostWallSeconds,
  rtcAdvanceOneSecond,
  rtcRegistersFromDate,
  rtcRegistersFromSeconds,
  rtcRegistersToSeconds,
  rtcStateOf,
  rtcTargetRegisters,
  toBcd
} from "@emu/machines/zxNext/nextRtc";

/*
 * Pure functions of the DS1307 model. The bus, the chip's protocol and its clock on both cores are
 * tested through the hardware in test/zxnext-hw/i2c/i2c-rtc.test.ts (which replaced the device mocks
 * that were here).
 */

describe("DS1307 BCD helpers", () => {
  it("toBcd / fromBcd round-trip 0-99", () => {
    for (let v = 0; v < 100; v++) expect(fromBcd(toBcd(v))).toBe(v);
    expect(toBcd(59)).toBe(0x59);
    expect(fromBcd(0x23)).toBe(23);
  });

  it("rtcRegistersFromDate: 24-hour BCD time, Sunday = day 1", () => {
    // --- Sunday 2026-09-20 07:08:09
    expect(rtcRegistersFromDate(new Date(2026, 8, 20, 7, 8, 9))).toEqual([0x09, 0x08, 0x07, 0x01, 0x20, 0x09, 0x26]);
  });
});

describe("DS1307 counter chain (rtcAdvanceOneSecond)", () => {
  const step = (regs: number[]) => {
    const r = [...regs];
    rtcAdvanceOneSecond(r);
    return r;
  };

  it("counts seconds and carries into minutes and hours", () => {
    expect(step([0x05, 0x10, 0x12, 3, 0x15, 0x06, 0x26])).toEqual([0x06, 0x10, 0x12, 3, 0x15, 0x06, 0x26]);
    expect(step([0x59, 0x10, 0x12, 3, 0x15, 0x06, 0x26])).toEqual([0x00, 0x11, 0x12, 3, 0x15, 0x06, 0x26]);
    expect(step([0x59, 0x59, 0x12, 3, 0x15, 0x06, 0x26])).toEqual([0x00, 0x00, 0x13, 3, 0x15, 0x06, 0x26]);
  });

  it("12-hour mode: 12 PM -> 1 PM keeps PM; 11 AM -> 12 PM; 11 PM -> 12 AM and a new day", () => {
    expect(step([0x59, 0x59, 0x72, 3, 0x15, 0x06, 0x26])[2]).toBe(0x61);
    expect(step([0x59, 0x59, 0x51, 3, 0x15, 0x06, 0x26])[2]).toBe(0x72);
    expect(step([0x59, 0x59, 0x71, 3, 0x15, 0x06, 0x26])).toEqual([0x00, 0x00, 0x52, 4, 0x16, 0x06, 0x26]);
  });

  it("month lengths, leap years every fourth year, the century", () => {
    const endOfDay = (date: number, month: number, year: number) => step([0x59, 0x59, 0x23, 7, date, month, year]).slice(3);
    expect(endOfDay(0x31, 0x01, 0x26)).toEqual([1, 0x01, 0x02, 0x26]);
    expect(endOfDay(0x30, 0x11, 0x26)).toEqual([1, 0x01, 0x12, 0x26]);
    expect(endOfDay(0x28, 0x02, 0x28)).toEqual([1, 0x29, 0x02, 0x28]);
    expect(endOfDay(0x29, 0x02, 0x28)).toEqual([1, 0x01, 0x03, 0x28]);
    expect(endOfDay(0x28, 0x02, 0x27)).toEqual([1, 0x01, 0x03, 0x27]);
    expect(endOfDay(0x31, 0x12, 0x99)).toEqual([1, 0x01, 0x01, 0x00]);
  });
});

describe("DS1307 registers against the host's clock (`.ai/zxnext-rtc.md` D4)", () => {
  /** Wall seconds of a calendar time */
  const wall = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => (Date.UTC(y, mo - 1, d, h, mi, s) - Date.UTC(2000, 0, 1)) / 1000;
  /** Host milliseconds whose local time is the given calendar time */
  const host = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(y, mo - 1, d, h, mi, s).getTime();

  it("the host's local time as wall seconds", () => {
    expect(hostWallSeconds(host(2026, 11, 3, 10, 42, 7))).toBe(wall(2026, 11, 3, 10, 42, 7));
    expect(hostWallSeconds(host(2000, 1, 1))).toBe(0);
  });

  it("round trips across month ends, leap days and the century", () => {
    for (const w of [
      wall(2026, 1, 31, 23, 59, 59),
      wall(2028, 2, 29, 12, 0, 0),
      wall(2027, 2, 28, 23, 59, 59),
      wall(2026, 12, 31, 23, 59, 59),
      wall(2099, 12, 31, 23, 59, 59),
      0
    ]) {
      expect(rtcRegistersToSeconds(rtcRegistersFromSeconds(w, false, 0))).toBe(w);
      expect(rtcRegistersToSeconds(rtcRegistersFromSeconds(w, true, 0)), "12-hour").toBe(w);
    }
    // --- One second after the last of 2099 the chip's years wrap to 00
    expect(rtcRegistersFromSeconds(wall(2099, 12, 31, 23, 59, 59) + 1, false, 0).slice(4)).toEqual([0x01, 0x01, 0x00]);
  });

  it("12-hour registers: midnight is 12 AM, noon 12 PM", () => {
    expect(rtcRegistersFromSeconds(wall(2026, 9, 18, 0, 0, 0), true, 0)[2]).toBe(0x52);
    expect(rtcRegistersFromSeconds(wall(2026, 9, 18, 12, 0, 0), true, 0)[2]).toBe(0x72);
    expect(rtcRegistersFromSeconds(wall(2026, 9, 18, 13, 0, 0), true, 0)[2]).toBe(0x61);
    expect(rtcRegistersToSeconds([0, 0, 0x52, 6, 0x18, 0x09, 0x26])).toBe(wall(2026, 9, 18, 0));
    expect(rtcRegistersToSeconds([0, 0, 0x72, 6, 0x18, 0x09, 0x26])).toBe(wall(2026, 9, 18, 12));
  });

  it("invalid registers have no time: not BCD, out of range, 31 February", () => {
    expect(rtcRegistersToSeconds([0x5a, 0, 0, 1, 1, 1, 0])).toBeUndefined();
    expect(rtcRegistersToSeconds([0, 0, 0x24, 1, 1, 1, 0])).toBeUndefined();
    expect(rtcRegistersToSeconds([0, 0, 0, 1, 0x31, 0x02, 0x26])).toBeUndefined();
    expect(rtcRegistersToSeconds([0, 0, 0, 1, 1, 0, 0x26]), "month 0").toBeUndefined();
    expect(rtcRegistersToSeconds([0x80, 0, 0, 1, 1, 1, 0x26]), "CH is no part of the time").toBe(wall(2026, 1, 1));
  });

  it("a clock's state keeps its offset, hour mode and day numbering across a sync", () => {
    const now = host(2026, 11, 3, 10, 0, 0);
    // --- The program set Friday 18 September 2026, 12:34:56 in 12-hour mode, numbering Monday = 1
    const set = [0x56, 0x34, 0x72, 5, 0x18, 0x09, 0x26];
    const state = rtcStateOf(set, now)!;
    expect(state.hours12).toBe(true);
    expect(state.offsetSeconds).toBe(wall(2026, 9, 18, 12, 34, 56) - wall(2026, 11, 3, 10));
    expect(rtcTargetRegisters(state, now), "the same registers back").toEqual(set);
    // --- An hour and a day later on the host: 1:34 PM, and Saturday is 6 in the program's numbering
    expect(rtcTargetRegisters(state, now + 25 * 3600_000)).toEqual([0x56, 0x34, 0x61, 6, 0x19, 0x09, 0x26]);
  });

  it("an invalid time has no state", () => {
    expect(rtcStateOf([0, 0, 0, 0, 0, 0, 0], Date.now())).toBeUndefined();
  });
});
