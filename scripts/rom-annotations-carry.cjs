#!/usr/bin/env node

/*
 * Carry a Klive ROM sidecar's annotations to a newer ROM whose bytes moved
 * (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D8).
 *
 *   npm run rom:annotations:carry -- <fromSidecar> <toRom> [--page n] [--out <sidecar>]
 *                                    [--review <file>] [--force]
 *
 *   fromSidecar  a shipped sidecar, by its path under src/public/roms
 *                (`zxnext/nextzxos-2.08/enNextZX.rom.dis`) or a path to the file
 *   toRom        the ROM file it is carried to (`zxnext/nextzxos-2.10/enNextZX.rom`), likewise
 *   --page n     carry only that page (the default: every page the sidecar has a bank for); an
 *                existing output keeps its other pages
 *   --out        the sidecar written (default: `<toRom>.dis`); refused when it exists, unless --force
 *                or --page
 *   --review     the review list (default: `.rom-annotations/carry/<file>.review.txt`)
 *
 * How an entry is placed. Every annotated offset (a label, a line annotation, a data region's first
 * and last byte) is re-anchored on its own by a byte signature: a window of the old page's bytes
 * around it that occurs exactly once in the new page. Three window shapes are tried, each widened
 * from 8 to 128 bytes until it matches once (or no longer matches at all): forward from the offset,
 * centred on it, and ending at it (that one also has to find the annotated instruction's own bytes
 * at the place). In code the windows are cut at instruction boundaries, and the address operands of
 * CALL/JP/LD/PUSH nn (and of a restart's inline word) that point into the page are wildcards, since moving code changes them. An offset is:
 *
 * - placed, when every shape that matched once agrees on the place; a place found only by a window
 *   with fewer than 16 fixed bytes must also lie between its strongly placed neighbours;
 * - placed by its neighbours, when no window matched once but the strongly placed anchors on both
 *   sides moved by the same distance and one of the candidates is at that distance;
 * - otherwise not placed: missing (the bytes changed), ambiguous (several places, neighbours not
 *   agreeing), in conflict (shapes disagree) or out of order.
 *
 * The new sidecar has the placed labels, line annotations and data regions (code regions are the
 * gaps between them), labels that are not on an instruction start of the new page are dropped, and
 * every carried entry's provenance is `derived`, with `carriedFrom` naming the sidecar it came from.
 * `level` is the lower of the old one and the new page's measured level. Everything not carried, and
 * every carried comment that names a ROM address which moved, is listed in the review file.
 *
 * The re-anchoring core is exported (no TypeScript, no files) for `test/annotations/romCarry.test.ts`.
 */

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { registerTsRuntime } = require("./lib/ts-runtime.cjs");
const { basename, dirname, join, relative, resolve, sep } = require("node:path");

const PAGE = 0x4000;
const WINDOWS = [8, 12, 16, 24, 32, 48, 64, 96, 128];
const MIN_FIXED = 8;
const STRONG_FIXED = 16;

// =================================================================================================
// The re-anchoring core

/**
 * Where an instruction holds a 16-bit operand that may be an address in the page (an absolute
 * CALL/JP target, or an LD of a 16-bit value): its index, or -1.
 */
function addressOperandIndex(bytes, at, length) {
  const op = bytes[at];
  if (length === 3) {
    // --- JP cc / JP / CALL cc / CALL; LD rr,nn; LD (nn),HL / LD HL,(nn) / LD (nn),A / LD A,(nn)
    if ((op & 0xc7) === 0xc2 || op === 0xc3 || (op & 0xc7) === 0xc4 || op === 0xcd) return at + 1;
    if ((op & 0xcf) === 0x01 || op === 0x22 || op === 0x2a || op === 0x32 || op === 0x3a) return at + 1;
  }
  if (length === 4) {
    const op2 = bytes[at + 1];
    if ((op === 0xdd || op === 0xfd) && (op2 === 0x21 || op2 === 0x22 || op2 === 0x2a)) return at + 2;
    if (op === 0xed && ((op2 & 0xc7) === 0x43 || op2 === 0x8a)) return at + 2;
  }
  return -1;
}

/**
 * The bytes a signature must not insist on (1 = wildcard): the address operands of instructions that
 * point into the page (below $4000; the Next's PUSH nn too), and the words of `words` regions that do. Moving code changes
 * exactly these.
 *
 * @param bytes The page
 * @param instructions The page's decoded instructions ({ offset, length })
 * @param regions The page's regions (for `words` tables)
 */
function operandMask(bytes, instructions = [], regions = []) {
  const mask = new Uint8Array(bytes.length);
  const lengthAt = new Map(instructions.map((i) => [i.offset, i.length]));
  for (const { offset, length } of instructions) {
    // --- A restart followed by an inline word, decoded as an item of its own (the Next ROMs' calls
    // --- into another ROM)
    if (length === 1 && (bytes[offset] & 0xc7) === 0xc7 && lengthAt.get(offset + 1) === 2) {
      if ((bytes[offset + 1] | (bytes[offset + 2] << 8)) < PAGE) mask[offset + 1] = mask[offset + 2] = 1;
      continue;
    }
    const at = addressOperandIndex(bytes, offset, length);
    if (at < 0 || at + 1 >= bytes.length) continue;
    // --- The Next's PUSH nn (ED 8A) holds its word high byte first
    const bigEndian = bytes[offset] === 0xed && bytes[offset + 1] === 0x8a;
    const value = bigEndian ? (bytes[at] << 8) | bytes[at + 1] : bytes[at] | (bytes[at + 1] << 8);
    // --- A small value of LD rr,nn is a count, not an address
    const isLd = at === offset + 1 ? (bytes[offset] & 0xcf) === 0x01 : bigEndian || (bytes[offset] !== 0xed && bytes[offset + 1] === 0x21);
    if (value < PAGE && (!isLd || value >= 0x40)) mask[at] = mask[at + 1] = 1;
  }
  for (const region of regions) {
    if (region.type !== "words") continue;
    for (let at = region.start; at + 1 <= region.end && at + 1 < bytes.length; at += 2) {
      if ((bytes[at] | (bytes[at + 1] << 8)) < PAGE) mask[at] = mask[at + 1] = 1;
    }
  }
  return mask;
}

/**
 * Where a window may start or end (1 = may): at instruction starts and anywhere outside an
 * instruction. Without instructions, everywhere.
 */
function boundariesOf(size, instructions = []) {
  const boundary = new Uint8Array(size + 1).fill(1);
  for (const { offset, length } of instructions) {
    for (let i = offset + 1; i < offset + length && i < size; i++) boundary[i] = 0;
  }
  for (const { offset } of instructions) if (offset < size) boundary[offset] = 1;
  return boundary;
}

/** A 4-byte key index of a page: key -> positions. */
function indexOf(bytes) {
  const index = new Map();
  for (let i = 0; i + 4 <= bytes.length; i++) {
    const key = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    const list = index.get(key);
    if (list) list.push(i);
    else index.set(key, [i]);
  }
  return index;
}

/**
 * Re-anchor offsets of an old page in a new one.
 *
 * @param oldBytes The page the offsets are in
 * @param newBytes The page they are placed in
 * @param offsets The offsets to place
 * @param options `mask` (operandMask), `boundaries` (boundariesOf), `lengths` (offset -> the length
 *   of the instruction there, for the backward shape's check)
 * @returns offset -> { status: "placed", to, how, fixed } | { status, candidates }, status being
 *   "missing", "ambiguous", "conflict" or "order"
 */
function reanchor(oldBytes, newBytes, offsets, options = {}) {
  const size = oldBytes.length;
  const mask = options.mask ?? new Uint8Array(size);
  const boundary = options.boundaries ?? new Uint8Array(size + 1).fill(1);
  const lengths = options.lengths ?? new Map();
  const index = indexOf(newBytes);
  const snapDown = (x) => {
    x = Math.max(0, x);
    while (x > 0 && !boundary[x]) x--;
    return x;
  };
  const snapUp = (x) => {
    x = Math.min(size, x);
    while (x < size && !boundary[x]) x++;
    return x;
  };

  /** The places (window starts) where old[from, to) matches, wildcards aside; at most `limit`. */
  const matches = (from, to, limit) => {
    let fixed = 0;
    let key = -1;
    for (let i = from; i < to; i++) {
      if (mask[i]) continue;
      fixed++;
      if (key < 0 && i + 4 <= to && !mask[i + 1] && !mask[i + 2] && !mask[i + 3]) key = i;
    }
    if (fixed < MIN_FIXED) return { fixed, found: undefined };
    const found = [];
    const test = (start) => {
      if (start < 0 || start + (to - from) > newBytes.length) return;
      for (let i = from; i < to; i++) {
        if (!mask[i] && oldBytes[i] !== newBytes[start + i - from]) return;
      }
      found.push(start);
    };
    if (key >= 0) {
      const k = ((oldBytes[key] << 24) | (oldBytes[key + 1] << 16) | (oldBytes[key + 2] << 8) | oldBytes[key + 3]) >>> 0;
      for (const at of index.get(k) ?? []) {
        test(at - (key - from));
        if (found.length >= limit) break;
      }
    } else {
      for (let start = 0; start + (to - from) <= newBytes.length && found.length < limit; start++) test(start);
    }
    return { fixed, found };
  };

  /** The bytes of the item at `o` (its instruction, else one byte) are at `to` in the new page. */
  const itemAt = (o, to) => {
    const length = lengths.get(o) ?? 1;
    for (let i = 0; i < length; i++) {
      if (o + i >= size || to + i >= newBytes.length) return false;
      if (!mask[o + i] && oldBytes[o + i] !== newBytes[to + i]) return false;
    }
    return true;
  };

  const shapes = [
    (o, k) => [o, snapUp(o + k)],
    (o, k) => [snapDown(o - (k >> 1)), snapUp(o + (k >> 1))],
    (o, k) => [snapDown(o - k), o]
  ];

  const first = new Map();
  for (const o of new Set(offsets)) {
    const unique = [];
    let candidates;
    for (let s = 0; s < shapes.length; s++) {
      for (const k of WINDOWS) {
        const [from, to] = shapes[s](o, k);
        if (to <= from) break;
        const { fixed, found } = matches(from, to, 2);
        if (!found) continue; // --- too few fixed bytes yet: widen
        if (found.length === 0) break;
        if (found.length === 1) {
          const at = found[0] + (o - from);
          if (s === 2 && !itemAt(o, at)) break;
          // --- How strong the place is: the widest window of this shape that still finds it alone
          let strength = fixed;
          for (const wider of WINDOWS.filter((w) => w > k && strength < STRONG_FIXED)) {
            const [f, t] = shapes[s](o, wider);
            const more = matches(f, t, 2);
            if (!more.found || more.found.length !== 1 || more.found[0] + (o - f) !== at) break;
            strength = more.fixed;
          }
          unique.push({ to: at, fixed: strength });
          break;
        }
        // --- Ambiguous: remember every place of this window (for the neighbours) and widen
        const all = matches(from, to, 64).found.map((start) => start + (o - from));
        candidates = candidates ? candidates.filter((c) => all.includes(c)) : all;
        if (!candidates.length) candidates = all;
      }
    }
    const places = [...new Set(unique.map((u) => u.to))];
    if (places.length === 1) {
      first.set(o, { status: "placed", to: places[0], how: "signature", fixed: Math.max(...unique.map((u) => u.fixed)) });
    } else if (places.length > 1) {
      first.set(o, { status: "conflict", candidates: places });
    } else if (candidates?.length) {
      first.set(o, { status: "ambiguous", candidates });
    } else {
      first.set(o, { status: "missing", candidates: [] });
    }
  }

  // --- The strongly placed anchors, by old offset: the frame weak places and neighbours are judged in
  const strong = [...first]
    .filter(([, r]) => r.status === "placed" && r.fixed >= STRONG_FIXED)
    .map(([o, r]) => ({ o, to: r.to }))
    .sort((a, b) => a.o - b.o);
  const neighbours = (o) => {
    let lo = 0;
    let hi = strong.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strong[mid].o < o) lo = mid + 1;
      else hi = mid;
    }
    const before = lo > 0 ? strong[lo - 1] : undefined;
    const after = strong[lo]?.o === o ? strong[lo + 1] : strong[lo];
    return { before, after };
  };

  const result = new Map();
  for (const [o, r] of first) {
    if (r.status === "placed" && r.fixed < STRONG_FIXED) {
      const { before, after } = neighbours(o);
      const ordered = !before || !after || before.to >= after.to || (before.to < r.to && r.to < after.to);
      result.set(o, ordered ? r : { status: "order", candidates: [r.to] });
    } else if (r.status === "ambiguous") {
      const { before, after } = neighbours(o);
      const delta = before && after && before.to - before.o === after.to - after.o ? before.to - before.o : undefined;
      result.set(
        o,
        delta !== undefined && r.candidates.includes(o + delta)
          ? { status: "placed", to: o + delta, how: "neighbours", fixed: 0 }
          : r
      );
    } else {
      result.set(o, r);
    }
  }
  return result;
}

/**
 * Carry one bank: re-anchor its labels, line annotations and data regions in the new page.
 *
 * @param bank The old bank (the sidecar's JSON)
 * @param oldBytes, newBytes The two pages
 * @param options `instructions` (the old page's decoded instructions), passed on to `reanchor`
 * @returns { bank, placed: old offset -> new offset, lost: [{ kind, offset, name?, text?, why }], moved }
 */
function carryBank(bank, oldBytes, newBytes, options = {}) {
  const instructions = options.instructions ?? [];
  const lengths = new Map(instructions.map((i) => [i.offset, i.length]));
  const dataRegions = (bank.regions ?? []).filter((r) => r.type !== "disassemble" || r.decode);
  const labels = bank.localLabels ?? [];
  const lines = bank.lineAnnotations ?? {};
  const mentions = new Set();
  for (const text of Object.values(lines).flatMap((l) => [l.synopsis, l.comment])) {
    for (const value of addressMentions(text)) mentions.add(value);
  }
  const offsets = [
    ...labels.map((l) => l.value),
    ...Object.keys(lines).map(Number),
    ...dataRegions.flatMap((r) => [r.start, r.end]),
    ...[...mentions].filter((v) => v < oldBytes.length)
  ];
  const map = reanchor(oldBytes, newBytes, offsets, {
    mask: operandMask(oldBytes, instructions, bank.regions),
    boundaries: boundariesOf(oldBytes.length, instructions),
    lengths
  });
  const last = { old: oldBytes.length - 1, new: newBytes.length - 1 };
  const where = (o) => (o === last.old ? { status: "placed", to: last.new, how: "page end" } : map.get(o));
  const lost = [];
  const why = (r) =>
    r.status + (r.candidates?.length ? ` (${r.candidates.slice(0, 4).map(hex).join(", ")}${r.candidates.length > 4 ? ", ..." : ""})` : "");

  // --- Data regions: both ends placed, the same order, no overlap; a fill still one byte
  const regions = [];
  const carriedRegion = new Map();
  for (const region of [...dataRegions].sort((a, b) => a.start - b.start)) {
    const s = where(region.start);
    const e = where(region.end);
    const fail = (reason) => lost.push({ kind: "region", offset: region.start, text: regionText(region), why: reason });
    if (s?.status !== "placed") { fail(`start ${why(s)}`); continue; }
    if (e?.status !== "placed") { fail(`end ${hex(region.end)} ${why(e)}`); continue; }
    const placed = { ...region, start: s.to, end: e.to };
    const oldLength = region.end - region.start + 1;
    const length = placed.end - placed.start + 1;
    if (length < 1 || Math.abs(length - oldLength) > Math.max(16, oldLength >> 2)) { fail(`length ${oldLength} -> ${length}`); continue; }
    if (region.type === "words" && length % 2) { fail(`odd length ${length} for words`); continue; }
    if (region.decode === "fill" && !newBytes.subarray(placed.start, placed.end + 1).every((b) => b === newBytes[placed.start])) {
      fail("no longer one filler byte");
      continue;
    }
    if (regions.some((r) => placed.start <= r.end && r.start <= placed.end)) { fail(`overlaps another region at ${hex(placed.start)}`); continue; }
    if (length !== oldLength) lost.push({ kind: "resized", offset: region.start, text: regionText(region), why: `carried, ${oldLength} -> ${length} bytes: check its comment` });
    regions.push(placed);
    carriedRegion.set(region, placed);
  }
  regions.sort((a, b) => a.start - b.start);
  const allRegions = [];
  let next = 0;
  for (const region of regions) {
    if (region.start > next) allRegions.push({ start: next, end: region.start - 1, type: "disassemble" });
    allRegions.push(region);
    next = region.end + 1;
  }
  if (next < newBytes.length) allRegions.push({ start: next, end: newBytes.length - 1, type: "disassemble" });

  // --- Labels and line annotations. One in an old data region goes only where that region went; one
  // --- in code does not go into a data region
  const oldRegionOf = (o) => dataRegions.find((r) => o >= r.start && o <= r.end);
  const newRegionOf = (o) => regions.find((r) => o >= r.start && o <= r.end);
  const misfit = (o, to) => {
    const before = oldRegionOf(o);
    if (!before) return newRegionOf(to) ? `lands in the data region at ${hex(newRegionOf(to).start)}` : undefined;
    const after = carriedRegion.get(before);
    if (!after) return `its data region (${regionText(before)}) was not carried`;
    return to >= after.start && to <= after.end ? undefined : `leaves its data region (${regionText(before)})`;
  };
  /** Whether the data region an old offset is in holds other bytes now (its text may be stale). */
  const dataChanged = (o) => {
    const before = oldRegionOf(o);
    const after = before && carriedRegion.get(before);
    if (!after) return false;
    if (after.end - after.start !== before.end - before.start) return true;
    for (let i = 0; i <= before.end - before.start; i++) {
      if (oldBytes[before.start + i] !== newBytes[after.start + i]) return true;
    }
    return false;
  };
  const placed = new Map();
  const newLabels = [];
  const takenLabel = new Set();
  for (const label of [...labels].sort((a, b) => a.value - b.value)) {
    const r = where(label.value);
    if (r?.status !== "placed") { lost.push({ kind: "label", offset: label.value, name: label.name, why: why(r) }); continue; }
    const labelMisfit = misfit(label.value, r.to);
    if (labelMisfit) { lost.push({ kind: "label", offset: label.value, name: label.name, why: labelMisfit }); continue; }
    if (takenLabel.has(r.to)) { lost.push({ kind: "label", offset: label.value, name: label.name, why: `another label is at ${hex(r.to)}` }); continue; }
    takenLabel.add(r.to);
    placed.set(label.value, r.to);
    newLabels.push({ name: label.name, value: r.to });
  }
  const newLines = {};
  const moved = [];
  for (const offset of Object.keys(lines).map(Number).sort((a, b) => a - b)) {
    const r = where(offset);
    const text = lines[offset].synopsis ?? lines[offset].comment;
    if (r?.status !== "placed") { lost.push({ kind: "line", offset, text, why: why(r) }); continue; }
    const lineMisfit = misfit(offset, r.to);
    if (lineMisfit) { lost.push({ kind: "line", offset, text, why: lineMisfit }); continue; }
    if (newLines[r.to]) { lost.push({ kind: "line", offset, text, why: `another line annotation is at ${hex(r.to)}` }); continue; }
    placed.set(offset, r.to);
    newLines[r.to] = lines[offset];
    if (dataChanged(offset)) {
      moved.push({ offset: r.to, from: offset, text, why: "the data under it changed: check its text" });
    }
    // --- A ROM address the text names that moved, or could not be placed, is for review
    const stale = [...new Set([lines[offset].synopsis, lines[offset].comment].flatMap(addressMentions))].filter((v) => {
      if (v >= oldBytes.length) return false;
      const m = where(v);
      return m?.status !== "placed" || m.to !== v;
    });
    if (stale.length) {
      moved.push({
        offset: r.to,
        from: offset,
        text,
        why: stale.map((v) => { const m = where(v); return `$${hex4(v)} -> ${m?.status === "placed" ? `$${hex4(m.to)}` : m?.status ?? "?"}`; }).join(", ")
      });
    }
  }

  const out = {};
  for (const [key, value] of Object.entries(bank)) {
    if (!["regions", "localLabels", "lineAnnotations"].includes(key)) out[key] = value;
  }
  out.regions = allRegions;
  if (bank.localLabels) out.localLabels = newLabels;
  if (bank.lineAnnotations) out.lineAnnotations = newLines;
  return { bank: out, placed, lost, moved };
}

/**
 * Drop the labels and code line annotations that are not on an instruction start of the new page
 * (labels must be, §5.1; a comment elsewhere would never be shown).
 *
 * @param bank The carried bank
 * @param starts The new page's instruction starts (a Set)
 */
function dropMisaligned(bank, starts) {
  const code = (bank.regions ?? []).filter((r) => r.type === "disassemble" && !r.decode);
  const inCode = (o) => code.some((r) => o >= r.start && o <= r.end);
  const lost = [];
  bank.localLabels = (bank.localLabels ?? []).filter((label) => {
    if (!inCode(label.value) || starts.has(label.value)) return true;
    lost.push({ kind: "label", offset: label.value, name: label.name, why: "not on an instruction start in the new page", isNew: true });
    return false;
  });
  for (const offset of Object.keys(bank.lineAnnotations ?? {}).map(Number)) {
    if (!inCode(offset) || starts.has(offset)) continue;
    const line = bank.lineAnnotations[offset];
    lost.push({ kind: "line", offset, text: line.synopsis ?? line.comment, why: "not on an instruction start in the new page", isNew: true });
    delete bank.lineAnnotations[offset];
  }
  return lost;
}

/** The ROM addresses ($0000-$3FFF, four hex digits) a comment names. */
function addressMentions(text) {
  if (!text) return [];
  return [...text.matchAll(/\$([0-9A-Fa-f]{4})(?![0-9A-Fa-f])/g)].map((m) => parseInt(m[1], 16)).filter((v) => v < PAGE);
}

const hex4 = (v) => v.toString(16).toUpperCase().padStart(4, "0");
const hex = (v) => (v === undefined ? "?" : `$${hex4(v)}`);
const regionText = (r) => `${r.type}${r.decode ? `/${r.decode}` : ""} ${hex(r.start)}-${hex(r.end)}`;

module.exports = { addressOperandIndex, operandMask, boundariesOf, reanchor, carryBank, dropMisaligned, addressMentions };

// =================================================================================================
// The command line

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

async function main() {
  const root = resolve(__dirname, "..");
  const ROMS = join(root, "src/public/roms");
  registerTsRuntime(root);
  const tools = require(join(root, "src/common/roms/romAnnotationTools.ts"));
  const identity = require(join(root, "src/common/roms/romIdentity.ts"));
  const sidecarPaths = require(join(root, "src/common/roms/romSidecarPaths.ts"));
  const { romDecoderFor } = require(join(root, "src/renderer/appIde/annotations/romDecoder.ts"));
  const { withInheritedEntries } = require(join(root, "src/renderer/appIde/annotations/romInheritance.ts"));
  const { parseAnnotations } = require(join(root, "src/renderer/appIde/annotations/programAnnotations.ts"));

  const args = process.argv.slice(2);
  const option = (name) => {
    const at = args.indexOf(name);
    if (at < 0) return undefined;
    const value = args[at + 1];
    args.splice(at, 2);
    return value;
  };
  const flag = (name) => {
    const at = args.indexOf(name);
    if (at >= 0) args.splice(at, 1);
    return at >= 0;
  };
  const onlyPage = option("--page");
  const outArg = option("--out");
  const reviewArg = option("--review");
  const force = flag("--force");
  const [fromArg, toArg] = args;
  if (!fromArg || !toArg) {
    console.error("Usage: npm run rom:annotations:carry -- <fromSidecar> <toRom> [--page n] [--out f] [--review f] [--force]");
    process.exit(2);
  }

  // --- Names relative to src/public/roms (or paths)
  const underRoms = (name) => {
    const path = existsSync(name) ? resolve(name) : join(ROMS, sidecarPaths.canonicalShippedSidecar(name));
    return { path, rel: path.startsWith(ROMS + sep) ? relative(ROMS, path).split(sep).join("/") : undefined };
  };
  const from = underRoms(fromArg);
  const toRom = underRoms(toArg);
  const out = outArg ? resolve(outArg) : `${toRom.path}.dis`;
  const outRel = out.startsWith(ROMS + sep) ? relative(ROMS, out).split(sep).join("/") : undefined;
  const old = JSON.parse(readFileSync(from.path, "utf8"));
  const oldRom = new Uint8Array(readFileSync(from.path.replace(/\.dis$/i, "")));
  const newRom = new Uint8Array(readFileSync(toRom.path));
  const pageOf = (bytes, page) => bytes.subarray(page * PAGE, Math.min(bytes.length, (page + 1) * PAGE));
  const pages = Object.keys(old.banks ?? {}).filter((p) => onlyPage === undefined || p === String(Number(onlyPage)));
  if (!pages.length) throw new Error(`${fromArg} has no bank for page ${onlyPage}`);
  if (existsSync(out) && !force && onlyPage === undefined) {
    throw new Error(`${out} exists. Pass --force to replace it, or --page n to replace one page.`);
  }

  const kindOf = (bytes) => identity.knownRomPageKind(identity.romPageIdentity(bytes));
  const decodeAll = async (bank, bytes) => {
    const decode = romDecoderFor(kindOf(bytes));
    const code = (bank.regions ?? []).filter((r) => r.type === "disassemble");
    const cuts = [...new Set((bank.localLabels ?? []).map((l) => l.value))].sort((a, b) => a - b);
    const instructions = [];
    for (const region of code) {
      const end = Math.min(region.end, bytes.length - 1);
      const runs = [region.start, ...cuts.filter((o) => o > region.start && o <= end)];
      for (let i = 0; i < runs.length; i++) {
        instructions.push(...(await decode(bytes, runs[i], i + 1 < runs.length ? runs[i + 1] - 1 : end)));
      }
    }
    return instructions;
  };

  const target = existsSync(out) && onlyPage !== undefined ? JSON.parse(readFileSync(out, "utf8")) : undefined;
  const sidecar = target ?? {};
  for (const [key, value] of Object.entries(old)) {
    if (!["banks", "pages", "provenance", "level", "inherits", "source"].includes(key) && !(key in sidecar)) sidecar[key] = value;
  }
  sidecar.source = { ...(old.source ?? {}), fileName: basename(toRom.path) };
  sidecar.pages = { ...(sidecar.pages ?? {}) };
  sidecar.banks = { ...(sidecar.banks ?? {}) };
  sidecar.provenance = { ...(sidecar.provenance ?? {}) };
  if (old.inherits) {
    // --- An inherited sidecar of the old ROM's folder is the new ROM's folder's file of that name
    const oldDir = dirname(from.rel ?? "");
    const newDir = dirname(toRom.rel ?? "");
    sidecar.inherits = old.inherits.map((entry) => {
      const canonical = sidecarPaths.canonicalShippedSidecar(entry.sidecar);
      const moved = dirname(canonical) === oldDir ? [newDir, basename(canonical)].filter((p) => p !== ".").join("/") : canonical;
      return { ...entry, sidecar: existsSync(join(ROMS, moved)) ? moved : canonical };
    });
  }
  sidecar.carriedFrom = {
    sidecar: from.rel ?? basename(from.path),
    method: "byte signature (scripts/rom-annotations-carry.cjs)"
  };

  const report = [];
  const summary = [];
  for (const page of pages) {
    const n = Number(page);
    const oldBank = old.banks[page];
    const oldBytes = pageOf(oldRom, n);
    const newBytes = pageOf(newRom, n);
    const { bank, lost, moved } = carryBank(oldBank, oldBytes, newBytes, { instructions: await decodeAll(oldBank, oldBytes) });
    const starts = new Set((await decodeAll(bank, newBytes)).map((i) => i.offset));
    lost.push(...dropMisaligned(bank, starts));

    // --- Provenance: every carried entry is derived from the old sidecar
    for (const key of Object.keys(sidecar.provenance)) if (key.startsWith(`${page}:`)) delete sidecar.provenance[key];
    sidecar.banks[page] = bank;
    for (const key of tools.provenanceKeysOf({ banks: { [page]: bank } })) sidecar.provenance[key] = "derived";
    sidecar.pages[page] = { ...(old.pages?.[page] ?? {}), crc32: identity.romCrc32(newBytes) };

    const oldLines = Object.keys(oldBank.lineAnnotations ?? {}).length;
    const oldLabels = (oldBank.localLabels ?? []).length;
    const oldRegions = (oldBank.regions ?? []).filter((r) => r.type !== "disassemble" || r.decode).length;
    const newRegions = bank.regions.filter((r) => r.type !== "disassemble" || r.decode).length;
    const lostOf = (kind) => lost.filter((l) => l.kind === kind);
    summary.push({
      page,
      labels: [bank.localLabels?.length ?? 0, oldLabels],
      lines: [Object.keys(bank.lineAnnotations ?? {}).length, oldLines],
      regions: [newRegions, oldRegions],
      moved: moved.length,
      resized: lostOf("resized").length
    });
    report.push(`== Page ${page} (${old.pages?.[page]?.crc32} -> ${sidecar.pages[page].crc32})`);
    report.push(
      `   labels ${bank.localLabels?.length ?? 0}/${oldLabels}, line annotations ${Object.keys(bank.lineAnnotations ?? {}).length}/${oldLines}, ` +
        `data regions ${newRegions}/${oldRegions} carried`
    );
    for (const [kind, title] of [
      ["label", "Labels not carried"],
      ["line", "Line annotations not carried"],
      ["region", "Data regions not carried (their bytes are code regions now)"],
      ["resized", "Data regions carried with another length"]
    ]) {
      const items = lostOf(kind);
      if (!items.length) continue;
      report.push("", `-- ${title} (${items.length})`);
      for (const item of items) {
        const what = item.name ?? (item.text ? item.text.replace(/\s+/g, " ").slice(0, 90) : "");
        report.push(`${hex(item.offset)}  ${what}\n        ${item.isNew ? "at the new offset: " : ""}${item.why}`);
      }
    }
    if (moved.length) {
      report.push("", `-- Carried comments to check: a ROM address they name moved or was not placed, or their data changed (${moved.length})`);
      for (const item of moved) {
        report.push(`${hex(item.offset)} (was ${hex(item.from)})  ${item.text.replace(/\s+/g, " ").slice(0, 90)}\n        ${item.why}`);
      }
    }
    report.push("");
  }
  for (const key of Object.keys(sidecar.provenance)) if (!sidecar.banks[key.split(":")[0]]) delete sidecar.provenance[key];

  // --- The level: the lower of the old file's and the new pages' measured one (inherited entries in)
  let measured = 2;
  const parsed = parseAnnotations(JSON.stringify(sidecar));
  if (!parsed.annotations) throw new Error(`The carried sidecar does not parse: ${JSON.stringify(parsed.diagnostics)}`);
  const { annotations } = await withInheritedEntries(parsed.annotations, (p) => pageOf(newRom, p), async (name, p) => ({
    annotations: parseAnnotations(readFileSync(join(ROMS, sidecarPaths.canonicalShippedSidecar(name)), "utf8")).annotations,
    bytes: pageOf(new Uint8Array(readFileSync(join(ROMS, sidecarPaths.canonicalShippedSidecar(name).replace(/\.dis$/, "")))), p)
  }));
  for (const page of Object.keys(sidecar.banks)) {
    const bytes = pageOf(newRom, Number(page));
    const level = await tools.measureRomLevel(annotations.banks[page], bytes, romDecoderFor(kindOf(bytes)));
    measured = Math.min(measured, level.level);
    report.push(
      `Page ${page} measured: level ${level.level}, ${level.unlabelledTargets.length} unlabelled target(s), ` +
        `${level.labelsWithoutSynopsis.length} label(s) without a synopsis, ${level.misplacedLabels.length} misplaced`
    );
  }
  sidecar.level = Math.min(old.level ?? 0, measured);
  writeFileSync(out, tools.formatRomSidecar(sidecar));

  const review =
    reviewArg ? resolve(reviewArg) : join(root, ".rom-annotations/carry", `${(outRel ?? basename(out)).replace(/\//g, "_")}.review.txt`);
  mkdirSync(dirname(review), { recursive: true });
  const header = [
    `Carried by scripts/rom-annotations-carry.cjs (byte signature), for hand review.`,
    `From: ${sidecar.carriedFrom.sidecar}`,
    `To:   ${outRel ?? out}  (level ${sidecar.level})`,
    ""
  ];
  writeFileSync(review, [...header, ...report].join("\n") + "\n");

  console.log(`Wrote ${outRel ?? out} (level ${sidecar.level}); review list: ${relative(root, review)}`);
  for (const s of summary) {
    console.log(
      `  page ${s.page}: labels ${s.labels[0]}/${s.labels[1]}, line annotations ${s.lines[0]}/${s.lines[1]}, ` +
        `data regions ${s.regions[0]}/${s.regions[1]} (${s.resized} resized), ${s.moved} carried comment(s) to check`
    );
  }
}
