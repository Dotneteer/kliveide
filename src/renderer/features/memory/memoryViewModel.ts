import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { MemoryInfo } from "@common/messaging/EmuApi";
import type { DropdownOption } from "@renderer/controls/Dropdown";

export type DumpViewMode = "8x1" | "8x2" | "16x1";

export type BankedMemoryPanelViewState = {
  topIndex?: number;
  isFullView?: boolean;
  currentSegment?: number;
  decimalView?: boolean;
  twoColumns?: boolean;
  viewMode?: string;
  charDump?: boolean;
  bankLabel?: boolean;
};

export type CachedRefreshState = {
  isFullView: boolean;
  currentSegment: number;
  decimalView: boolean;
};

export const viewModeOptions: DropdownOption[] = [
  { value: "8x1", label: "8B / 1 col" },
  { value: "8x2", label: "8B / 2 col" },
  { value: "16x1", label: "16B / 1 col" }
];

export function resolveViewMode(viewMode?: string, twoColumns?: boolean): DumpViewMode {
  if (viewMode === "8x1" || viewMode === "8x2" || viewMode === "16x1") {
    return viewMode;
  }
  return twoColumns === false ? "8x1" : "8x2";
}

export function getBytesPerRow(viewMode: DumpViewMode): 8 | 16 {
  return viewMode === "8x1" ? 8 : 16;
}

export function getByteCount(viewMode: DumpViewMode): 8 | 16 {
  return viewMode === "16x1" ? 16 : 8;
}

export function usesTwoColumns(viewMode: DumpViewMode): boolean {
  return viewMode === "8x2";
}

export function createRowAddresses(length: number, rowBytes: number): number[] {
  const items: number[] = [];
  for (let addr = 0; addr < length; addr += rowBytes) {
    items.push(addr);
  }
  return items;
}

export function convertTopIndexForViewMode(
  topIndex: number,
  previousViewMode: DumpViewMode,
  nextViewMode: DumpViewMode
): number {
  const previousBytesPerRow = getBytesPerRow(previousViewMode);
  const nextBytesPerRow = getBytesPerRow(nextViewMode);
  if (previousBytesPerRow === nextBytesPerRow) {
    return topIndex;
  }
  return nextBytesPerRow === 16 ? Math.floor(topIndex / 2) : topIndex * 2;
}

export function createSegmentOptions(
  labels: Record<number, string>,
  ramBankValue: number
): DropdownOption[] {
  if (ramBankValue > 8) {
    return [];
  }

  return Object.keys(labels)
    .map((label) => parseInt(label, 10))
    .sort((a, b) => (a < 0 && b < 0 ? b - a : a - b))
    .map((key) => {
      if (key < 0) {
        return { value: key.toString(), label: `ROM ${-key - 1}` };
      }
      return { value: key.toString(), label: `BANK ${key}` };
    });
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
