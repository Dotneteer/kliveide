import { MemorySectionType } from "@abstractions/MemorySection";
import type { AnnotationRegion } from "@renderer/appIde/annotations/programAnnotations";
import { prepareRomDisassembler } from "@renderer/appIde/annotations/romDecoder";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { imageBank, type BinaryImage } from "./image/binaryImage";

/*
 * A bank of an image listed through Klive's own disassembler (the provenance rule's source, D4),
 * with the image's CPU (D2) and the custom decoding its ROM kind selects. This is the pipeline's
 * `listing` command: the fallback when a routine card is not enough, which `rom-pipeline.cjs`
 * records as a signal for improving the preprocessor (D11).
 */

export type ListingLine = {
  /** Offset within the bank. */
  offset: number;
  /** The CPU address (origin + offset). */
  address: number;
  bytes: number[];
  /** The instruction or data directive. */
  text: string;
  /** The custom decoder's comment (an EXOS call's name, a report code). */
  comment?: string;
};

/** The regions a listing is shaped by: a sidecar bank's, or the whole bank as code when absent. */
export type ListingRegion = Pick<AnnotationRegion, "start" | "end" | "type">;

/** Lists `from`..`to` (bank offsets, inclusive) of one bank. */
export async function listImageBank(
  image: BinaryImage,
  bankId: string,
  from: number,
  to: number,
  regions?: readonly ListingRegion[]
): Promise<ListingLine[]> {
  const bank = imageBank(image, bankId);
  const last = bank.bytes.length - 1;
  if (from < 0 || to > last || from > to) {
    throw new Error(`Range ${hex4(from)}-${hex4(to)} is outside bank ${bankId} ($0000-${hex4(last)})`);
  }
  const { origin } = bank;
  const memory = new Uint8Array(origin + bank.bytes.length);
  memory.set(bank.bytes, origin);
  const sections = (regions?.length ? regions : [{ start: 0, end: last, type: "disassemble" as const }])
    .filter((r) => r.start <= last)
    .map((r) => new MemorySection(origin + r.start, origin + Math.min(r.end, last), sectionType(r.type)));
  const disassembler = new Z80Disassembler(sections, memory, undefined, {
    allowExtendedSet: image.cpu === "z80n"
  });
  prepareRomDisassembler(disassembler, image.romKind);
  const output = await disassembler.disassemble(origin, origin + last);
  return (output?.outputItems ?? [])
    .filter((item) => !item.isPrefixItem)
    .map((item) => ({
      offset: item.address - origin,
      address: item.address,
      bytes: item.opCodes ?? [],
      text: item.instruction ?? "",
      ...(item.hardComment ? { comment: item.hardComment } : {})
    }))
    .filter((line) => line.offset >= from && line.offset <= to);
}

/** One listing line as text: `OFFS @ADDR BYTES INSTRUCTION ; comment` (the address only off $0000). */
export function formatListingLine(line: ListingLine, origin: number): string {
  const bytes = line.bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  const at = origin ? `@${hex4(line.address).slice(1)} ` : "";
  const comment = line.comment ? `  ; ${line.comment}` : "";
  return `${hex4(line.offset).slice(1)} ${at}${bytes.padEnd(12)} ${line.text}${comment}`;
}

function sectionType(type: AnnotationRegion["type"]): MemorySectionType {
  switch (type) {
    case "disassemble":
      return MemorySectionType.Disassemble;
    case "words":
      return MemorySectionType.WordArray;
    case "skip":
      return MemorySectionType.Skip;
    default:
      return MemorySectionType.ByteArray;
  }
}

function hex4(value: number): string {
  return `$${value.toString(16).padStart(4, "0").toUpperCase()}`;
}
