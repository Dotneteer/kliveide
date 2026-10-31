import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * The re-anchoring core of `scripts/rom-annotations-carry.cjs` (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`
 * D8): annotated offsets of one ROM page placed in a newer page by byte signature.
 */

const require = createRequire(import.meta.url);
const { reanchor, carryBank, operandMask, dropMisaligned } = require("../../scripts/rom-annotations-carry.cjs");

/** Deterministic pseudo-random bytes (no repeats worth speaking of). */
function noise(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length);
  let x = seed;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    bytes[i] = x >>> 24;
  }
  return bytes;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

describe("reanchor", () => {
  // --- old: A(1000) B(200) C(1000); new: A, 37 inserted bytes, C (B rewritten)
  const a = noise(1000, 1);
  const b = noise(200, 2);
  const c = noise(1000, 3);
  const oldPage = concat(a, b, c);
  const newPage = concat(a, noise(37, 4), c);

  it("places offsets before and after a change, by the distance they moved", () => {
    const map = reanchor(oldPage, newPage, [10, 900, 1300, 2100]);
    expect(map.get(10)).toMatchObject({ status: "placed", to: 10 });
    expect(map.get(900)).toMatchObject({ status: "placed", to: 900 });
    expect(map.get(1300)).toMatchObject({ status: "placed", to: 1300 - 200 + 37 });
    expect(map.get(2100)).toMatchObject({ status: "placed", to: 2100 - 200 + 37 });
  });

  it("places an offset at the edge of a change by the window that ends at it", () => {
    // --- 1200 is C's first byte: the window before it is gone, the one after it is intact
    expect(reanchor(oldPage, newPage, [1200]).get(1200)).toMatchObject({ status: "placed", to: 1037 });
    // --- 999 is A's last byte: only a window ending at it (and holding the byte) finds it
    expect(reanchor(oldPage, newPage, [999]).get(999)).toMatchObject({ status: "placed", to: 999 });
  });

  it("does not place an offset whose bytes are gone", () => {
    expect(reanchor(oldPage, newPage, [1100]).get(1100)).toMatchObject({ status: "missing" });
  });

  it("does not place an offset that matches in several places, unless its neighbours agree", () => {
    // --- A block of 300 bytes that is in the new page twice
    const block = noise(300, 5);
    const before = concat(a, block, c);
    const twice = concat(a, block, block, c);
    const map = reanchor(before, twice, [1150]);
    expect(map.get(1150)?.status).toBe("ambiguous");
    expect(map.get(1150)?.candidates).toEqual(expect.arrayContaining([1150, 1450]));
    // --- With strong anchors on both sides that did not move, the candidate at that distance wins
    const shifted = concat(a, block, c, block);
    const resolved = reanchor(before, shifted, [500, 1150, 1500]);
    expect(resolved.get(500)).toMatchObject({ status: "placed", to: 500 });
    expect(resolved.get(1500)).toMatchObject({ status: "placed", to: 1500 });
    expect(resolved.get(1150)).toMatchObject({ status: "placed", to: 1150, how: "neighbours" });
  });

  it("treats the address operands of moved code as wildcards", () => {
    // --- A CALL $0800 that became CALL $0825 when its target moved
    const body = noise(40, 6);
    const oldCode = concat(noise(100, 7), new Uint8Array([0xcd, 0x00, 0x08]), body, noise(100, 8));
    const newCode = concat(noise(100, 7), new Uint8Array([0xcd, 0x25, 0x08]), body, noise(100, 8));
    const instructions = [{ offset: 100, length: 3 }];
    const mask = operandMask(oldCode, instructions, []);
    expect([...mask.subarray(100, 103)]).toEqual([0, 1, 1]);
    const lengths = new Map([[100, 3]]);
    const plain = reanchor(oldCode, newCode, [100], { lengths }).get(100);
    const masked = reanchor(oldCode, newCode, [100], { mask, lengths }).get(100);
    expect(masked).toMatchObject({ status: "placed", to: 100 });
    // --- Without it, every window holding the CALL fails, and the one ending before it does not find
    // --- the CALL's bytes at the place
    expect(plain.status).toBe("missing");
  });

  it("does not take a short unique match that is out of order with its strong neighbours", () => {
    // --- The 8 bytes at 1100 in the old page reappear, alone, far after where they belong
    const lone = oldPage.subarray(1096, 1104);
    const moved = concat(a, noise(200, 9), c, lone);
    const result = reanchor(oldPage, moved, [500, 1100, 1700]).get(1100);
    expect(result.status).not.toBe("placed");
  });
});

describe("carryBank", () => {
  const a = noise(1000, 11);
  const text = new TextEncoder().encode("Hello, world, this is a message ");
  const c = noise(1000, 12);
  const oldPage = concat(a, text, c);
  const newPage = concat(noise(16, 13), a, text, c);

  const bank = {
    offsetIndex: 0,
    regions: [
      { start: 0, end: 999, type: "disassemble" },
      { start: 1000, end: 1000 + text.length - 1, type: "bytes", decode: "text" },
      { start: 1000 + text.length, end: oldPage.length - 1, type: "disassemble" }
    ],
    localLabels: [
      { name: "START", value: 100 },
      { name: "MESSAGE", value: 1000 }
    ],
    lineAnnotations: {
      "100": { synopsis: "Starts. Calls $0200." },
      "1000": { synopsis: "The message." }
    }
  };

  it("moves labels, comments and data regions, and rebuilds the code regions around them", () => {
    const { bank: carried, lost, moved } = carryBank(bank, oldPage, newPage);
    expect(lost).toEqual([]);
    expect(carried.localLabels).toEqual([
      { name: "START", value: 116 },
      { name: "MESSAGE", value: 1016 }
    ]);
    expect(Object.keys(carried.lineAnnotations)).toEqual(["116", "1016"]);
    expect(carried.regions).toEqual([
      { start: 0, end: 1015, type: "disassemble" },
      { start: 1016, end: 1016 + text.length - 1, type: "bytes", decode: "text" },
      { start: 1016 + text.length, end: newPage.length - 1, type: "disassemble" }
    ]);
    // --- The comment names $0200, which moved to $0210: listed for review
    expect(moved).toEqual([expect.objectContaining({ offset: 116, why: "$0200 -> $0210" })]);
  });

  it("lists what it could not place, and drops labels off an instruction start", () => {
    const changed = concat(noise(16, 13), noise(1000, 14), text, c);
    const { bank: carried, lost } = carryBank(bank, oldPage, changed);
    expect(carried.localLabels.map((l: { name: string }) => l.name)).toEqual(["MESSAGE"]);
    expect(lost).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "label", name: "START", why: "missing" }),
        expect.objectContaining({ kind: "line", offset: 100 })
      ])
    );
    const misaligned = dropMisaligned({ ...carried, localLabels: [{ name: "X", value: 5 }] }, new Set([0, 4, 6]));
    expect(misaligned).toEqual([expect.objectContaining({ kind: "label", name: "X" })]);
  });
});

describe("the carried nextzxos-2.10 sidecars", () => {
  const ROMS = join(__dirname, "../../src/public/roms");
  const files = ["enNextZX", "enNxtmmc", "enNextMf", "enAltZX", "enNextLG"];

  it.each(files)("%s names the 2.08 sidecar it was carried from, and its entries are derived", (file) => {
    const raw = JSON.parse(readFileSync(join(ROMS, `zxnext/nextzxos-2.10/${file}.rom.dis`), "utf8"));
    expect(raw.carriedFrom.sidecar).toBe(`zxnext/nextzxos-2.08/${file}.rom.dis`);
    expect(new Set(Object.values(raw.provenance))).toEqual(new Set(["derived"]));
    const old = JSON.parse(readFileSync(join(ROMS, raw.carriedFrom.sidecar), "utf8"));
    expect(Object.keys(raw.banks)).toEqual(Object.keys(old.banks));
  });

  it("keeps enNextLG inheriting its set's enNextZX page 2", () => {
    const raw = JSON.parse(readFileSync(join(ROMS, "zxnext/nextzxos-2.10/enNextLG.rom.dis"), "utf8"));
    expect(raw.inherits).toEqual([{ sidecar: "zxnext/nextzxos-2.10/enNextZX.rom.dis", page: 2 }]);
  });
});
