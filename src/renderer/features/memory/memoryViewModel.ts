import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import type { DropdownOption } from "@renderer/controls/Dropdown";
import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";

/**
 * Bytes per row (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` D7): 8, 16 or 32. The old two-column
 * `8x2` layout is retired; a persisted `8x2` opens as 16-byte rows.
 */
export type DumpViewMode = "8x1" | "16x1" | "32x1";

export type BankedMemoryPanelViewState = {
  topIndex?: number;
  isFullView?: boolean;
  currentSegment?: number;
  decimalView?: boolean;
  twoColumns?: boolean;
  viewMode?: string;
  charDump?: boolean;
  bankLabel?: boolean;
  /** The label gutter: the row's first label and the registers pointing into it (§5.1) */
  labelGutter?: boolean;
  /** The inspector column is shown (D2) */
  inspector?: boolean;
  /** The register the view follows, or empty */
  follow?: string;
};

export type CachedRefreshState = {
  isFullView: boolean;
  currentSegment: number;
  decimalView: boolean;
};

export function resolveViewMode(viewMode?: string, twoColumns?: boolean): DumpViewMode {
  if (viewMode === "8x1" || viewMode === "16x1" || viewMode === "32x1") {
    return viewMode;
  }
  // --- The retired two-column layout (and a state from before view modes) shows 16-byte rows
  if (viewMode === "8x2") return "16x1";
  return twoColumns === false ? "8x1" : "16x1";
}

export function getBytesPerRow(viewMode: DumpViewMode): 8 | 16 | 32 {
  return viewMode === "8x1" ? 8 : viewMode === "32x1" ? 32 : 16;
}

/** The bytes one dump section shows: the whole row */
export function getByteCount(viewMode: DumpViewMode): 8 | 16 | 32 {
  return getBytesPerRow(viewMode);
}

export function createRowAddresses(length: number, rowBytes: number): number[] {
  const items: number[] = [];
  for (let addr = 0; addr < length; addr += rowBytes) {
    items.push(addr);
  }
  return items;
}

/** The row that keeps the same first byte in view when the row width changes */
export function convertTopIndexForViewMode(
  topIndex: number,
  previousViewMode: DumpViewMode,
  nextViewMode: DumpViewMode
): number {
  const previousBytesPerRow = getBytesPerRow(previousViewMode);
  const nextBytesPerRow = getBytesPerRow(nextViewMode);
  return Math.floor((topIndex * previousBytesPerRow) / nextBytesPerRow);
}

/**
 * The list-shaped partition chooser's options.
 *
 * The label is the machine's own — `R0`, `B3` — not a name invented here. This function used to be
 * handed the label map and ignore it, formatting `ROM 0` / `BANK 0` from the index, which is why
 * the memory view called a partition something no other view, and no command, agreed with. The
 * invented name survives as the *description*, which is presentation and does not have to match
 * anything.
 *
 * @param labels The machine's `getPartitionLabels()`
 * @param ramBankValue How many RAM banks the machine has; past eight the matrix picker takes over
 * @param descriptions The machine's `getPartitionDescriptions()`, if it supplies any
 */
export function createSegmentOptions(
  labels: Record<number, string>,
  ramBankValue: number,
  descriptions: Record<number, string> = {}
): DropdownOption[] {
  if (ramBankValue > 8) {
    return [];
  }

  return derivePartitionOptions(labels, descriptions).map((option) => ({
    value: option.index.toString(),
    label: option.label,
    description: option.description
  }));
}

/**
 * One partition, as a chooser needs it.
 *
 * `label` is the identity — what a key contains, what a bank column shows, what `bp-set` accepts.
 * `description` is the long form a chooser can spell out beside it. Keeping them separate is the
 * whole point: the memory view used to *label* a ZX Next partition `ALTR0` while the breakpoints
 * panel called it `X0`, because the long name had been used as a name rather than as a gloss.
 */
export type PartitionOption = {
  index: number;
  label: string;
  description?: string;
  /**
   * The caption this partition's block carries, shared by every option in the block.
   *
   * A chooser prints it once above the run rather than on each chip, which is what keeps sixteen
   * DivMMC RAM banks to one row of two-character labels instead of sixteen spelled-out names.
   */
  caption?: string;
  /**
   * Which block of a chooser this belongs in.
   *
   * Derived from the sign of the index, which is how every machine here distinguishes them: ROM and
   * other special pages are numbered downwards from -1, RAM banks upwards from 0. How a picker lays
   * the two groups out is its own business.
   */
  group: "special" | "bank";
};

/**
 * Turn a machine's label and description maps into the list a chooser renders.
 *
 * Sorted the way the two groups read: special pages first, nearest to zero first (`R0` before
 * `R1`), then banks ascending. That is the order `createSegmentOptions` already produced, kept so
 * the list-shaped picker does not reshuffle when it starts using this.
 */
export function derivePartitionOptions(
  labels: Record<number, string>,
  descriptions: Record<number, string> = {},
  groups: Record<number, string> = {}
): PartitionOption[] {
  return Object.keys(labels ?? {})
    .map((key) => parseInt(key, 10))
    .sort((a, b) => (a < 0 && b < 0 ? b - a : a - b))
    .map((index) => ({
      index,
      label: labels[index],
      description: descriptions?.[index],
      caption: groups?.[index],
      group: index < 0 ? ("special" as const) : ("bank" as const)
    }));
}

/**
 * Split options into consecutive runs sharing a caption.
 *
 * Consecutive, not grouped-by-value: the order `derivePartitionOptions` produces is the order a
 * chooser draws, so a caption that reappeared later would be a second block rather than a
 * continuation of the first.
 */
export function toCaptionedBlocks(
  options: PartitionOption[]
): { caption?: string; options: PartitionOption[] }[] {
  const blocks: { caption?: string; options: PartitionOption[] }[] = [];
  for (const option of options) {
    const current = blocks[blocks.length - 1];
    if (current && current.caption === option.caption) {
      current.options.push(option);
    } else {
      blocks.push({ caption: option.caption, options: [option] });
    }
  }
  return blocks;
}

/**
 * How this machine lets you choose a memory partition.
 *
 * Pure and synchronous: everything here comes from the machine registry plus a partition-label map
 * the caller already has. `useMemoryMachineSetup` calls it for the Memory view, and
 * `useBreakpointDialog` calls it when the breakpoint dialog opens — so the two cannot decide
 * differently whether a machine has banks, or offer different choosers for the same one.
 *
 * Keeping it synchronous is what lets the dialog build its own answer at open time instead of
 * reading a hook's state that may not have settled yet.
 */
export function derivePartitionSetup(
  machineId: string | undefined,
  labels: Record<number, string>,
  descriptions: Record<number, string> = {},
  groups: Record<number, string> = {}
): {
  banksView: boolean;
  displayBankMatrix: boolean;
  segmentOptions: DropdownOption[];
  partitionOptions: PartitionOption[];
} {
  const machine = machineRegistry.find((mi) => mi.machineId === machineId);
  const romPagesValue = machine?.features?.[MF_ROM] ?? 0;
  const ramBankValue = machine?.features?.[MF_BANK] ?? 0;

  return {
    banksView: romPagesValue > 0 || ramBankValue > 0,
    // --- Past eight banks a list stops being a chooser; the ZX Next has 247.
    displayBankMatrix: ramBankValue > 8 || romPagesValue > 8,
    segmentOptions: createSegmentOptions(labels, ramBankValue, descriptions),
    partitionOptions: derivePartitionOptions(labels, descriptions, groups)
  };
}

export function getDefaultSegment(romPagesValue: number): number {
  return romPagesValue ? -1 : 0;
}

export function resolveMemoryPartition(
  refreshState: Pick<CachedRefreshState, "isFullView" | "currentSegment">
): number | undefined {
  if (refreshState.isFullView) {
    return undefined;
  }

  const partition = refreshState.currentSegment;
  return Number.isNaN(partition) ? -1 : partition;
}

export function buildPointedRegisterHints(
  response: Pick<
    MemoryInfo,
    "bc" | "de" | "hl" | "bc_" | "de_" | "hl_" | "pc" | "sp" | "ix" | "iy" | "ir" | "wz"
  >,
  machineState: MachineControllerState | undefined
): Record<number, string> {
  if (
    machineState !== MachineControllerState.Paused &&
    machineState !== MachineControllerState.Stopped
  ) {
    return {};
  }

  const pointed: Record<number, string> = {};
  const extend = (regName: string, regValue: number): void => {
    if (pointed[regValue]) {
      pointed[regValue] += ", " + regName;
    } else {
      pointed[regValue] = regName;
    }
  };

  extend("BC", response.bc);
  extend("DE", response.de);
  extend("HL", response.hl);
  extend("BC'", response.bc_);
  extend("DE'", response.de_);
  extend("HL'", response.hl_);
  extend("PC", response.pc);
  extend("SP", response.sp);
  extend("IX", response.ix);
  extend("IY", response.iy);
  extend("IR", response.ir);
  extend("WZ", response.wz);

  return pointed;
}
