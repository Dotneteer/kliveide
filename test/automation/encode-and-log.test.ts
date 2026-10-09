import { describe, expect, it } from "vitest";

import { bytesFromJson, bytesToBase64, toJsonValue } from "@main/automation/encode";
import { formatCallLine, redactSecrets, summarizeParams } from "@main/automation/log";

/*
 * The structured-clone → JSON boundary (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` T7) and the
 * Automation pane's redaction (D13, T11).
 */

describe("automation encode (T7)", () => {
  it("writes bytes as base64 and other typed arrays as numbers", () => {
    expect(toJsonValue(new Uint8Array([1, 2, 3]))).toBe("AQID");
    expect(toJsonValue(new Uint8ClampedArray([255]))).toBe("/w==");
    expect(toJsonValue(Buffer.from("hi"))).toBe("aGk=");
    expect(toJsonValue(new Uint16Array([1, 65535]))).toEqual([1, 65535]);
    expect(toJsonValue(new Uint32Array([0xffffffff]))).toEqual([4294967295]);
  });

  it("turns maps into objects and sets into arrays, and drops undefined fields", () => {
    expect(toJsonValue(new Map<unknown, unknown>([["a", 1], [2, new Uint8Array([9])]]))).toEqual({ a: 1, "2": "CQ==" });
    expect(toJsonValue(new Set([1, 2]))).toEqual([1, 2]);
    expect(toJsonValue({ a: undefined, b: 1, f: () => 1 })).toEqual({ b: 1 });
    expect(toJsonValue([undefined, 1])).toEqual([null, 1]);
  });

  it("writes what JSON cannot as null or text", () => {
    expect(toJsonValue(NaN)).toBeNull();
    expect(toJsonValue(Infinity)).toBeNull();
    expect(toJsonValue(10n)).toBe("10");
    expect(toJsonValue(new Date(0))).toBe("1970-01-01T00:00:00.000Z");
    expect(toJsonValue(new Error("boom"))).toBe("boom");
    const cyclic: any = { a: 1 };
    cyclic.self = cyclic;
    expect(toJsonValue(cyclic)).toEqual({ a: 1, self: null });
  });

  it("round-trips the shapes the methods return", () => {
    const samples = [
      // --- cpu.get's source: a CPU state with access traces
      { af: 0x1234, pc: 0x8000, iff1: true, lastMemoryReads: new Uint16Array([1]), pcPartition: undefined },
      // --- memory.read's source
      { memory: new Uint8Array(4).fill(7), partitionLabels: ["R0", "B5"], selectedBank: undefined },
      // --- a breakpoint list
      { breakpoints: [{ address: 0x8000, exec: true, owner: { kind: "project" } }], memorySegments: [[1, 2]] },
      // --- a command result with a structured value
      { success: false, value: { errors: [{ file: "a.asm", line: 1, message: "x" }] }, output: ["x"] }
    ];
    for (const sample of samples) {
      const json = JSON.parse(JSON.stringify(toJsonValue(sample)));
      expect(json).toEqual(toJsonValue(sample));
    }
    expect(toJsonValue(samples[1])).toEqual({ memory: "BwcHBw==", partitionLabels: ["R0", "B5"] });
  });

  it("reads bytes from base64 or byte arrays, strictly", () => {
    expect(Array.from(bytesFromJson("AQID")!)).toEqual([1, 2, 3]);
    expect(Array.from(bytesFromJson([0, 255])!)).toEqual([0, 255]);
    expect(bytesFromJson([256])).toBeUndefined();
    expect(bytesFromJson("not*base64")).toBeUndefined();
    expect(bytesFromJson(42)).toBeUndefined();
    expect(bytesToBase64(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });
});

describe("automation log redaction (T11)", () => {
  const token = "0123456789abcdef".repeat(4);

  it("never prints the token", () => {
    const line = summarizeParams({ token, client: "ci" });
    expect(line).not.toContain(token);
    expect(line).toContain("token: <redacted>");
    expect(summarizeParams({ nested: { token } })).not.toContain(token);
  });

  it("prints only the size of memory and picture payloads", () => {
    const data = Buffer.alloc(300, 0x41).toString("base64");
    const line = summarizeParams({ address: 0x8000, data });
    expect(line).toBe("address: 32768, data: <300 bytes>");
    expect(summarizeParams({ bytes: [1, 2, 3] })).toBe("bytes: <3 bytes>");
  });

  it("cuts long strings and keeps a line on one line", () => {
    const line = summarizeParams({ text: "x".repeat(500) + "\nsecond" });
    expect(line.length).toBeLessThan(120);
    expect(line).not.toContain("\n");
  });

  it("removes the token, and anything token-shaped, from messages", () => {
    expect(redactSecrets(`bad token ${token}`, [token])).toBe("bad token <redacted>");
    expect(redactSecrets(`other ${"f".repeat(64)}`, [token])).toBe("other <redacted>");
  });

  it("formats one line per call", () => {
    expect(formatCallLine("ci", "memory.read", { address: 1, length: 2 }, { ok: true }, 3.4)).toBe(
      "[ci] memory.read(address: 1, length: 2) → ok (3 ms)"
    );
    expect(formatCallLine("ci", "cpu.set", {}, { ok: false, error: "nope" }, 1)).toBe("[ci] cpu.set() → error: nope (1 ms)");
  });
});
