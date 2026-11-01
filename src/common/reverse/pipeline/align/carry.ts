/*
 * Carrying a ROM sidecar's annotations to another version of the ROM (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`
 * §4.7, P6), moved here from `scripts/rom-annotations-carry.cjs` (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D8),
 * which keeps its command line on top of it.
 *
 * Every annotated offset is re-anchored on its own by a byte signature: a window of the old page's bytes
 * around it that occurs exactly once in the new page, with the address operands that point into the page
 * as wildcards (moving code changes exactly those). `origin` is where the page runs: on the Enterprise
 * ($C000) a page's own addresses are $C000-$FFFF, not $0000-$3FFF. The rules are in `reanchor`'s and
 * `carryBank`'s comments.
 */

const PAGE = 0x4000;
const WINDOWS = [8, 12, 16, 24, 32, 48, 64, 96, 128];
const MIN_FIXED = 8;
const STRONG_FIXED = 16;

export type Instruction = { offset: number; length: number };
export type CarryRegion = { start: number; end: number; type: string; decode?: string; [key: string]: unknown };
export type CarryLabel = { name: string; value: number };
export type CarryLine = { synopsis?: string; comment?: string };
export type CarryBank = {
  regions?: CarryRegion[];
  localLabels?: CarryLabel[];
  lineAnnotations?: Record<string, CarryLine>;
  [key: string]: unknown;
};

type PlacedAt = { status: "placed"; to: number; how: string; fixed: number };
export type Placement = PlacedAt | { status: "missing" | "ambiguous" | "conflict" | "order"; candidates: number[] };

export type ReanchorOptions = { mask?: Uint8Array; boundaries?: Uint8Array; lengths?: Map<number, number> };

export type CarryLoss = { kind: string; offset: number; name?: string; text?: string; why: string; isNew?: boolean };
export type CarryMove = { offset: number; from: number; text?: string; why: string };
export type CarryResult = { bank: CarryBank; placed: Map<number, number>; lost: CarryLoss[]; moved: CarryMove[] };

/**
 * Where an instruction holds a 16-bit operand that may be an address in the page (an absolute
 * CALL/JP target, or an LD of a 16-bit value): its index, or -1.
 */
export function addressOperandIndex(bytes: Uint8Array, at: number, length: number): number {
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
export function operandMask(
  bytes: Uint8Array,
  instructions: readonly Instruction[] = [],
  regions: readonly CarryRegion[] = [],
  origin = 0
): Uint8Array {
  // --- A page is 16K wherever it runs (an 8K ROM is still listed in a 16K page)
  const inPage = (value: number) => value >= origin && value < origin + PAGE;
  const mask = new Uint8Array(bytes.length);
  const lengthAt = new Map(instructions.map((i) => [i.offset, i.length]));
  for (const { offset, length } of instructions) {
    // --- A restart followed by an inline word, decoded as an item of its own (the Next ROMs' calls
    // --- into another ROM)
    if (length === 1 && (bytes[offset] & 0xc7) === 0xc7 && lengthAt.get(offset + 1) === 2) {
      if (inPage(bytes[offset + 1] | (bytes[offset + 2] << 8))) mask[offset + 1] = mask[offset + 2] = 1;
      continue;
    }
    const at = addressOperandIndex(bytes, offset, length);
    if (at < 0 || at + 1 >= bytes.length) continue;
    // --- The Next's PUSH nn (ED 8A) holds its word high byte first
    const bigEndian = bytes[offset] === 0xed && bytes[offset + 1] === 0x8a;
    const value = bigEndian ? (bytes[at] << 8) | bytes[at + 1] : bytes[at] | (bytes[at + 1] << 8);
    // --- A small value of LD rr,nn is a count, not an address
    const isLd = at === offset + 1 ? (bytes[offset] & 0xcf) === 0x01 : bigEndian || (bytes[offset] !== 0xed && bytes[offset + 1] === 0x21);
    if (inPage(value) && (!isLd || value - origin >= 0x40)) mask[at] = mask[at + 1] = 1;
  }
  for (const region of regions) {
    if (region.type !== "words") continue;
    for (let at = region.start; at + 1 <= region.end && at + 1 < bytes.length; at += 2) {
      if (inPage(bytes[at] | (bytes[at + 1] << 8))) mask[at] = mask[at + 1] = 1;
    }
  }
  return mask;
}

/**
 * Where a window may start or end (1 = may): at instruction starts and anywhere outside an
 * instruction. Without instructions, everywhere.
 */
export function boundariesOf(size: number, instructions: readonly Instruction[] = []): Uint8Array {
  const boundary = new Uint8Array(size + 1).fill(1);
  for (const { offset, length } of instructions) {
    for (let i = offset + 1; i < offset + length && i < size; i++) boundary[i] = 0;
  }
  for (const { offset } of instructions) if (offset < size) boundary[offset] = 1;
  return boundary;
}

/** A 4-byte key index of a page: key -> positions. */
function indexOf(bytes: Uint8Array): Map<number, number[]> {
  const index = new Map<number, number[]>();
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
export function reanchor(
  oldBytes: Uint8Array,
  newBytes: Uint8Array,
  offsets: Iterable<number>,
  options: ReanchorOptions = {}
): Map<number, Placement> {
  const size = oldBytes.length;
  const mask = options.mask ?? new Uint8Array(size);
  const boundary = options.boundaries ?? new Uint8Array(size + 1).fill(1);
  const lengths = options.lengths ?? new Map<number, number>();
  const index = indexOf(newBytes);
  const snapDown = (x: number) => {
    x = Math.max(0, x);
    while (x > 0 && !boundary[x]) x--;
    return x;
  };
  const snapUp = (x: number) => {
    x = Math.min(size, x);
    while (x < size && !boundary[x]) x++;
    return x;
  };

  /** The places (window starts) where old[from, to) matches, wildcards aside; at most `limit`. */
  const matches = (from: number, to: number, limit: number): { fixed: number; found: number[] | undefined } => {
    let fixed = 0;
    let key = -1;
    for (let i = from; i < to; i++) {
      if (mask[i]) continue;
      fixed++;
      if (key < 0 && i + 4 <= to && !mask[i + 1] && !mask[i + 2] && !mask[i + 3]) key = i;
    }
    if (fixed < MIN_FIXED) return { fixed, found: undefined };
    const found: number[] = [];
    const test = (start: number) => {
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
  const itemAt = (o: number, to: number) => {
    const length = lengths.get(o) ?? 1;
    for (let i = 0; i < length; i++) {
      if (o + i >= size || to + i >= newBytes.length) return false;
      if (!mask[o + i] && oldBytes[o + i] !== newBytes[to + i]) return false;
    }
    return true;
  };

  const shapes: ((o: number, k: number) => [number, number])[] = [
    (o, k) => [o, snapUp(o + k)],
    (o, k) => [snapDown(o - (k >> 1)), snapUp(o + (k >> 1))],
    (o, k) => [snapDown(o - k), o]
  ];

  const first = new Map<number, Placement>();
  for (const o of new Set(offsets)) {
    const unique: { to: number; fixed: number }[] = [];
    let candidates: number[] | undefined;
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
        const all = matches(from, to, 64).found!.map((start) => start + (o - from));
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
    .map(([o, r]) => ({ o, to: (r as PlacedAt).to }))
    .sort((a, b) => a.o - b.o);
  const neighbours = (o: number) => {
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

  const result = new Map<number, Placement>();
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
export function carryBank(
  bank: CarryBank,
  oldBytes: Uint8Array,
  newBytes: Uint8Array,
  options: { instructions?: readonly Instruction[]; origin?: number } = {}
): CarryResult {
  const instructions = options.instructions ?? [];
  const lengths = new Map(instructions.map((i) => [i.offset, i.length]));
  const dataRegions = (bank.regions ?? []).filter((r) => r.type !== "disassemble" || r.decode);
  const labels = bank.localLabels ?? [];
  const lines: Record<string, CarryLine> = bank.lineAnnotations ?? {};
  const mentions = new Set<number>();
  for (const text of Object.values(lines).flatMap((l) => [l.synopsis, l.comment])) {
    for (const value of addressMentions(text, oldBytes.length)) mentions.add(value);
  }
  const offsets = [
    ...labels.map((l) => l.value),
    ...Object.keys(lines).map(Number),
    ...dataRegions.flatMap((r) => [r.start, r.end]),
    ...[...mentions].filter((v) => v < oldBytes.length)
  ];
  const map = reanchor(oldBytes, newBytes, offsets, {
    mask: operandMask(oldBytes, instructions, bank.regions, options.origin ?? 0),
    boundaries: boundariesOf(oldBytes.length, instructions),
    lengths
  });
  const last = { old: oldBytes.length - 1, new: newBytes.length - 1 };
  const where = (o: number): Placement | undefined =>
    o === last.old ? { status: "placed", to: last.new, how: "page end", fixed: 0 } : map.get(o);
  const lost: CarryLoss[] = [];
  const why = (r: Placement | undefined) =>
    !r ? "?" :
    r.status + (r.status !== "placed" && r.candidates?.length ? ` (${r.candidates.slice(0, 4).map(hex).join(", ")}${r.candidates.length > 4 ? ", ..." : ""})` : "");

  // --- Data regions: both ends placed, the same order, no overlap; a fill still one byte
  const regions: CarryRegion[] = [];
  const carriedRegion = new Map<CarryRegion, CarryRegion>();
  for (const region of [...dataRegions].sort((a, b) => a.start - b.start)) {
    const s = where(region.start);
    const e = where(region.end);
    const fail = (reason: string) => lost.push({ kind: "region", offset: region.start, text: regionText(region), why: reason });
    if (s?.status !== "placed") { fail(`start ${why(s)}`); continue; }
    if (e?.status !== "placed") { fail(`end ${hex(region.end)} ${why(e)}`); continue; }
    const placed = { ...region, start: s.to, end: (e as PlacedAt).to };
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
  const allRegions: CarryRegion[] = [];
  let next = 0;
  for (const region of regions) {
    if (region.start > next) allRegions.push({ start: next, end: region.start - 1, type: "disassemble" });
    allRegions.push(region);
    next = region.end + 1;
  }
  if (next < newBytes.length) allRegions.push({ start: next, end: newBytes.length - 1, type: "disassemble" });

  // --- Labels and line annotations. One in an old data region goes only where that region went; one
  // --- in code does not go into a data region
  const oldRegionOf = (o: number) => dataRegions.find((r) => o >= r.start && o <= r.end);
  const newRegionOf = (o: number) => regions.find((r) => o >= r.start && o <= r.end);
  const misfit = (o: number, to: number) => {
    const before = oldRegionOf(o);
    if (!before) return newRegionOf(to) ? `lands in the data region at ${hex(newRegionOf(to)!.start)}` : undefined;
    const after = carriedRegion.get(before);
    if (!after) return `its data region (${regionText(before)}) was not carried`;
    return to >= after.start && to <= after.end ? undefined : `leaves its data region (${regionText(before)})`;
  };
  /** Whether the data region an old offset is in holds other bytes now (its text may be stale). */
  const dataChanged = (o: number) => {
    const before = oldRegionOf(o);
    const after = before && carriedRegion.get(before);
    if (!after) return false;
    if (after.end - after.start !== before.end - before.start) return true;
    for (let i = 0; i <= before.end - before.start; i++) {
      if (oldBytes[before.start + i] !== newBytes[after.start + i]) return true;
    }
    return false;
  };
  const placed = new Map<number, number>();
  const newLabels: CarryLabel[] = [];
  const takenLabel = new Set<number>();
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
  const newLines: Record<string, CarryLine> = {};
  const moved: CarryMove[] = [];
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
    const stale = [
      ...new Set([lines[offset].synopsis, lines[offset].comment].flatMap((t) => addressMentions(t, oldBytes.length)))
    ].filter((v) => {
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

  const out: CarryBank = {};
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
export function dropMisaligned(bank: CarryBank, starts: ReadonlySet<number>): CarryLoss[] {
  const code = (bank.regions ?? []).filter((r) => r.type === "disassemble" && !r.decode);
  const inCode = (o: number) => code.some((r) => o >= r.start && o <= r.end);
  const lost: CarryLoss[] = [];
  bank.localLabels = (bank.localLabels ?? []).filter((label) => {
    if (!inCode(label.value) || starts.has(label.value)) return true;
    lost.push({ kind: "label", offset: label.value, name: label.name, why: "not on an instruction start in the new page", isNew: true });
    return false;
  });
  for (const offset of Object.keys(bank.lineAnnotations ?? {}).map(Number)) {
    if (!inCode(offset) || starts.has(offset)) continue;
    const line = bank.lineAnnotations![offset];
    lost.push({ kind: "line", offset, text: line.synopsis ?? line.comment, why: "not on an instruction start in the new page", isNew: true });
    delete bank.lineAnnotations![offset];
  }
  return lost;
}

/** The ROM addresses ($0000-$3FFF, four hex digits) a comment names. */
export function addressMentions(text: string | undefined, size = PAGE): number[] {
  if (!text) return [];
  return [...text.matchAll(/\$([0-9A-Fa-f]{4})(?![0-9A-Fa-f])/g)].map((m) => parseInt(m[1], 16)).filter((v) => v < size);
}

const hex4 = (v: number) => v.toString(16).toUpperCase().padStart(4, "0");
const hex = (v: number | undefined) => (v === undefined ? "?" : `$${hex4(v)}`);
const regionText = (r: CarryRegion) => `${r.type}${r.decode ? `/${r.decode}` : ""} ${hex(r.start)}-${hex(r.end)}`;
