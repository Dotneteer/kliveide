import { describe, expect, it } from "vitest";
import { expectSameBytes, firstByteDifference } from "./expectBytes";

describe("expectSameBytes", () => {
  it("passes for equal bytes, whatever the view's offset in its buffer", () => {
    const buffer = new Uint8Array([9, 1, 2, 3]);
    expect(() => expectSameBytes(buffer.subarray(1), new Uint8Array([1, 2, 3]))).not.toThrow();
    expect(firstByteDifference(new Uint32Array([5, 6]), new Uint32Array([5, 6]))).toBe(-1);
  });

  it("fails with the first differing offset", () => {
    expect(firstByteDifference(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]))).toBe(1);
    expect(() => expectSameBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 9, 3]), "the image")).toThrow(
      /the image differ at byte offset 1 \(0x1\): \$02 instead of \$09/
    );
  });

  it("fails when only the lengths differ", () => {
    expect(firstByteDifference(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(2);
    expect(() => expectSameBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toThrow(/lengths 2 and 3/);
  });
});
