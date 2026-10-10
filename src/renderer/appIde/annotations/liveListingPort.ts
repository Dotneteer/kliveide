import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import type { AnnotationMachine, BankSpace, SlotPaging } from "@common/annotations/bankSpace";
import type { ActiveAnnotationSet } from "./activeAnnotationSet";
import type { RomPartitionInfo } from "./romAnnotationLoader";

/*
 * The live Disassembly view's rows, in the terms the annotation editor works in
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5).
 *
 * The editor's controller edits one bank of one sidecar, with rows numbered by bank offset. A live
 * row is a Z80 address under the current paging. This turns one into the other:
 *
 * - a row in a RAM bank goes to the **active annotation set**, at that bank and offset;
 * - a row in a ROM page goes to the page's **user layer** — the user's own ROM annotations, never
 *   the shipped sidecar (Q6);
 * - a row nowhere annotatable (a Timex DOCK chunk, a machine without a bank space) or with no set
 *   active gets a reason instead, which the menu shows on its disabled entries.
 *
 * Pure: the whole decision is tested without a view.
 */

export type LiveRowTarget = {
  kind: "bank" | "rom";
  /** The sidecar the edit goes to. */
  annotationPath: string;
  /** The bank (or the page within the ROM sidecar) the edit goes to. */
  bank: number;
  /** The row's offset within it. */
  offset: number;
  /** The address offset 0 of the bank is listed at here: a row's offset is its address minus this. */
  disassOffset: number;
  /** How to create the sidecar or the bank when the first edit finds neither. */
  create: { machine: AnnotationMachine; offsetIndex: 0 | 1 | 2 | 3; crc32?: string; romName?: string };
  /** Where the result is written, for the menu: "your ROM annotations", or the file's name. */
  destination: string;
};

export type LiveRowTargetContext = {
  bankSpace: BankSpace | undefined;
  slots: SlotPaging;
  activeSet: ActiveAnnotationSet | undefined;
  romPartition: (partition: number) => RomPartitionInfo | undefined;
};

/** Why a live row cannot be annotated, or where its annotations go. */
export function liveRowTarget(
  address: number,
  context: LiveRowTargetContext
): LiveRowTarget | { disabledReason: string } {
  const { bankSpace, activeSet } = context;
  if (!bankSpace) return { disabledReason: "This machine's memory cannot be annotated." };
  const site = bankSpace.siteAt(address & 0xffff, context.slots);
  if (!site) return { disabledReason: "This memory (a DOCK or EXROM chunk) cannot be annotated." };

  if (site.kind === "rom") {
    const rom = context.romPartition(site.partition);
    if (!rom) return { disabledReason: "This ROM page has not been identified yet." };
    return {
      kind: "rom",
      annotationPath: rom.userPath,
      bank: rom.userPage,
      offset: site.offset,
      disassOffset: (address - site.offset) & 0xffff,
      create: {
        machine: "rom",
        offsetIndex: 0,
        crc32: rom.source.crc32,
        romName: fileNameOf(rom.source.path)
      },
      destination: "your ROM annotations"
    };
  }

  if (!activeSet) {
    return { disabledReason: "No annotation set is active: use ann-new, or open a project." };
  }
  return {
    kind: "bank",
    annotationPath: activeSet.path,
    bank: site.bank,
    offset: site.offset,
    disassOffset: (address - site.offset) & 0xffff,
    create: { machine: activeSet.machine, offsetIndex: bankSpace.defaultOffsetIndex(site.bank) },
    destination: fileNameOf(activeSet.path) ?? activeSet.path
  };
}

/**
 * The rows the editor sees for a target: the listing's rows of the same bank piece, so a range
 * selection and the region dialogs' previews work as in a bank document. A row belongs to the piece
 * when it maps to the same bank (or ROM page) at the same listing offset.
 *
 * The editor reads a row's place in the bank from its annotation metadata, which a row of the plain
 * listing (one in a bank with no annotations yet) does not carry: such rows are given it here, as
 * copies, so the listing's own items are never changed.
 */
export function rowsOfTarget(
  items: readonly DisassemblyItem[],
  target: LiveRowTarget,
  context: LiveRowTargetContext
): DisassemblyItem[] {
  const rows: DisassemblyItem[] = [];
  for (const item of items) {
    if (item.isPrefixItem) continue;
    const other = liveRowTarget(item.address, context);
    if (
      !("annotationPath" in other) ||
      other.annotationPath !== target.annotationPath ||
      other.bank !== target.bank ||
      other.disassOffset !== target.disassOffset
    ) {
      continue;
    }
    rows.push(
      item.annotation
        ? item
        : {
            ...item,
            annotation: {
              bankOffset: other.offset,
              byteLength: item.opCodes?.length || 1,
              regionType: "disassemble"
            }
          }
    );
  }
  return rows;
}

function fileNameOf(path: string | undefined): string | undefined {
  return path?.split(/[\\/]/).pop();
}
