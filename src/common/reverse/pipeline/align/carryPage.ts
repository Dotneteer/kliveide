import type { BinaryImage } from "../image/binaryImage";
import { decodeBank } from "../preprocess/decode";
import { alignPages, translateRam, type PageAlignment } from "./alignPages";
import { carryBank, dropMisaligned, type CarryBank, type CarryLoss, type CarryMove } from "./carry";

/*
 * One page carried from an older (or newer) version of the ROM (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`
 * §4.7, P6): the bank re-anchored by `carry.ts`, the two pages aligned by `alignPages.ts`, and the RAM
 * addresses the carried text names translated through the alignment's map. Pure; the CLI's `carry`
 * command writes the result.
 */

export type CarriedPage = {
  bank: CarryBank;
  alignment: PageAlignment;
  lost: CarryLoss[];
  moved: CarryMove[];
  /** RAM addresses translated in carried text, by the new offset of the entry. */
  translated: { offset: number; swaps: string[] }[];
  /** Labels and line annotations the signatures could not place but the alignment did. */
  aligned: number;
};

/** A RAM mapping is translated in text only when the alignment saw it at least this often. */
const RAM_MIN_COUNT = 2;

/**
 * Carries `oldBank` (of `oldImage`'s page) onto `newImage`'s page. Both images give the CPU and the
 * ROM kind their own decoding uses.
 */
export async function carryPage(oldImage: BinaryImage, oldBank: CarryBank, newImage: BinaryImage): Promise<CarriedPage> {
  const [oldPage] = oldImage.banks;
  const [newPage] = newImage.banks;
  const oldLabels = oldBank.localLabels ?? [];
  const oldDecoded = await decodeBank(oldImage, oldPage.id, { regions: oldBank.regions, cuts: oldLabels.map((l) => l.value) });
  const carried = carryBank(oldBank, oldPage.bytes, newPage.bytes, {
    instructions: oldDecoded.rows.map((r) => ({ offset: r.offset, length: r.length })),
    origin: oldPage.origin
  });
  const newDecoded = await decodeBank(newImage, newPage.id, {
    regions: carried.bank.regions,
    cuts: (carried.bank.localLabels ?? []).map((l) => l.value)
  });
  const lost = [...carried.lost, ...dropMisaligned(carried.bank, new Set(newDecoded.rows.filter((r) => !r.data).map((r) => r.offset)))];

  // --- The old routines: each label up to the next one, inside its code region
  const code = (oldBank.regions ?? []).filter((r) => r.type === "disassemble");
  const starts = oldLabels.map((l) => l.value).filter((o) => code.some((r) => o >= r.start && o <= r.end)).sort((a, b) => a - b);
  const oldRoutines = starts.map((start, i) => {
    const region = code.find((r) => start >= r.start && start <= r.end)!;
    return { start, end: Math.min(region.end, (starts[i + 1] ?? Infinity) - 1) };
  });
  const alignment = alignPages({
    oldDecoded,
    newDecoded,
    oldBytes: oldPage.bytes,
    newBytes: newPage.bytes,
    anchors: carried.placed,
    oldRoutines
  });

  // --- What the signatures lost on an instruction the alignment matched goes where the alignment says
  let aligned = 0;
  const bank = carried.bank;
  const takenLabels = new Set((bank.localLabels ?? []).map((l) => l.value));
  const takenNames = new Set((bank.localLabels ?? []).map((l) => l.name));
  const oldLines = oldBank.lineAnnotations ?? {};
  const stillLost: CarryLoss[] = [];
  for (const loss of lost) {
    const to = alignment.pairs.get(loss.offset);
    if (to === undefined || loss.isNew) {
      stillLost.push(loss);
      continue;
    }
    if (loss.kind === "label" && loss.name && !takenLabels.has(to) && !takenNames.has(loss.name)) {
      (bank.localLabels ??= []).push({ name: loss.name, value: to });
      takenLabels.add(to);
      takenNames.add(loss.name);
      aligned++;
    } else if (loss.kind === "line" && oldLines[loss.offset] && !(bank.lineAnnotations ?? {})[to]) {
      (bank.lineAnnotations ??= {})[to] = { ...oldLines[loss.offset] };
      aligned++;
    } else stillLost.push(loss);
  }
  bank.localLabels?.sort((a, b) => a.value - b.value);

  // --- RAM addresses ($4000 and up: the text names page addresses below that as offsets) that moved,
  // --- seen often enough to trust
  const ramMap = alignment.ramMap.filter((m) => m.from >= 0x4000 && m.count >= RAM_MIN_COUNT);
  const translated: CarriedPage["translated"] = [];
  for (const [offset, line] of Object.entries(carried.bank.lineAnnotations ?? {})) {
    const swaps: string[] = [];
    for (const field of ["synopsis", "comment"] as const) {
      const text = line[field];
      if (text === undefined) continue;
      const result = translateRam(text, ramMap);
      line[field] = result.text;
      swaps.push(...result.swaps);
    }
    if (swaps.length) translated.push({ offset: Number(offset), swaps });
  }
  return { bank, alignment, lost: stillLost, moved: carried.moved, translated, aligned };
}
