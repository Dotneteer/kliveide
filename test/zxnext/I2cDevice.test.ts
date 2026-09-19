import { describe, expect, it } from "vitest";
import { fromBcd, rtcAdvanceOneSecond, rtcRegistersFromDate, toBcd } from "@emu/machines/zxNext/I2cDevice";

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
