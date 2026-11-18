import { describe, it, expect } from "vitest";

import { findPattern, parseFindPattern } from "@common/utils/memoryFind";

describe("parseFindPattern", () => {
  it("reads hex bytes with wildcards", () => {
    expect(parseFindPattern("21 00 58")).toEqual([0x21, 0x00, 0x58]);
    expect(parseFindPattern("21 ?? 58")).toEqual([0x21, null, 0x58]);
    expect(parseFindPattern("$21,0x00 %1011000")).toEqual([0x21, 0x00, 0x58]);
  });

  it("reads decimal bytes in decimal mode", () => {
    expect(parseFindPattern("33 0 88", true)).toEqual([33, 0, 88]);
    expect(parseFindPattern("256", true)).toBeUndefined();
  });

  it("reads quoted text as character codes", () => {
    expect(parseFindPattern('"HI"')).toEqual([0x48, 0x49]);
    expect(parseFindPattern("'A'")).toEqual([0x41]);
  });

  it("leaves a label to the caller", () => {
    expect(parseFindPattern("main_loop")).toBeUndefined();
    expect(parseFindPattern("?? ??")).toBeUndefined();
    expect(parseFindPattern("")).toBeUndefined();
  });
});

describe("findPattern", () => {
  const data = [0x21, 0x00, 0x58, 0x21, 0x10, 0x58, 0x00];

  it("finds every start, wildcards included", () => {
    expect(findPattern(data, [0x21, null, 0x58]).offsets).toEqual([0, 3]);
    expect(findPattern(data, [0x58, 0x00]).offsets).toEqual([5]);
  });

  it("stops at the limit and says so", () => {
    expect(findPattern(data, [0x21, null, 0x58], 1)).toEqual({ offsets: [0], truncated: true });
    expect(findPattern(data, [0x99])).toEqual({ offsets: [], truncated: false });
  });
});
