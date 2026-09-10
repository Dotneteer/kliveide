import classnames from "classnames";
import { AddressLabel, PartitionPrefix } from "@renderer/controls/data";
import { isWidePartitionLabel } from "@renderer/controls/data/partitionWidth";
import { memo } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { BreakpointIndicator } from "./BreakpointIndicator";
import type { DisassemblyItem } from "../disassemblers/common-types";
import { toDecimal3, toDecimal5, toHexa2, toHexa4 } from "../services/ide-commands";
import styles from "./DisassemblyPanel.module.scss";

export type DisassemblyRowViewModel = {
  address: number;
  addressText: string;
  breakpointAddress: number | string;
  breakpointPartition?: string;
  execPoint: boolean;
  hasBreakpoint: boolean;
  instruction: string;
  labelText: string;
  opCodes: string;
  partitionLabel: string;
  showBankLabel: boolean;
  tstates: string;
  useWidePartitions: boolean;
};

export type DisassemblyRowViewModelParams = {
  bankLabel: boolean;
  breakpoint?: BreakpointInfo;
  currentSegment: number;
  decimalView: boolean;
  isFullView: boolean;
  item: DisassemblyItem;
  mem64kLabels: string[];
  partitionLabels: Record<number, string>;
  pausedPc: number;
  showBanks: boolean;
};

export function deriveDisassemblyRowViewModel({
  bankLabel,
  breakpoint,
  currentSegment,
  decimalView,
  isFullView,
  item,
  mem64kLabels,
  partitionLabels,
  pausedPc,
  showBanks
}: DisassemblyRowViewModelParams): DisassemblyRowViewModel {
  const address = item.address;
  let partitionLabel = isFullView
    ? (mem64kLabels[address >> 13] ?? "")
    : (partitionLabels[currentSegment] ?? "");
  const useWidePartitions = isWidePartitionLabel(partitionLabel, decimalView, showBanks);

  if (useWidePartitions) {
    partitionLabel = toDecimal3(parseInt(partitionLabel, 16));
  }

  const opCodes =
    item.opCodes?.map((opCode) => (decimalView ? toDecimal3(opCode) : toHexa2(opCode))).join(" ") ??
    "";

  return {
    address,
    addressText: decimalView ? toDecimal5(address) : toHexa4(address),
    // --- Only a source-bound breakpoint is named by its key here; an address-bound one shows its
    // --- raw address. The label map matters for neither, but the display form requires it.
    breakpointAddress: breakpoint?.resource
      ? getBreakpointDisplayKey(breakpoint, partitionLabels)
      : address,
    breakpointPartition:
      breakpoint?.partition !== undefined ? (partitionLabels[breakpoint.partition] ?? "?") : undefined,
    execPoint: address === pausedPc,
    hasBreakpoint: !!breakpoint,
    instruction: item.instruction ?? "",
    labelText: item.hasLabel ? `L${decimalView ? toDecimal5(address) : toHexa4(address)}:` : "",
    opCodes,
    partitionLabel,
    showBankLabel: bankLabel && showBanks,
    tstates: item.tstates ? `${item.tstates}${item.tstates2 ? `/${item.tstates2}` : ""}` : "",
    useWidePartitions
  };
}

type DisassemblyRowProps = DisassemblyRowViewModelParams & {
  index: number;
  rowHeight: number;
  /**
   * Characters reserved for the hard-comment column, shared by every row in the list.
   *
   * Uniform across rows so their backgrounds all end at the same x; see the derivation in
   * `DisassemblyPanel`. 0 means no row in the listing has a comment, and the cell is omitted
   * entirely rather than rendered empty.
   */
  commentWidthCh: number;
  /**
   * Characters reserved for the bank-label column, shared by every row in the list.
   *
   * Uniform for the same reason as `commentWidthCh`; 0 means the listing has no bank column and
   * the cell is omitted entirely. Derived by `derivePartitionWidthCh`.
   */
  partitionWidthCh: number;
  /**
   * Open the breakpoint editor for this row's breakpoint.
   *
   * Supplied by the panel so the whole listing shares one callback: the disassembly view has no row
   * menu of its own, so the indicator's double-click is the way in.
   */
  onEditBreakpoint?: (breakpoint: BreakpointInfo) => void;
};

export const DisassemblyRow = memo(function DisassemblyRow({
  commentWidthCh,
  index,
  item,
  onEditBreakpoint,
  partitionWidthCh,
  rowHeight,
  ...viewModelParams
}: DisassemblyRowProps) {
  const breakpoint = viewModelParams.breakpoint;
  // --- Only an address-bound breakpoint is editable here. A source-bound one belongs to the
  // --- editor's glyph margin, which places and moves it by line.
  const editable = onEditBreakpoint && breakpoint && breakpoint.address !== undefined;
  const viewModel = deriveDisassemblyRowViewModel({
    ...viewModelParams,
    item
  });

  return (
    <div
      className={classnames(styles.item, {
        [styles.even]: index % 2 == 0,
        [styles.execPoint]: viewModel.execPoint
      })}
      style={{ height: rowHeight }}
    >
      <LabelSeparator />
      <BreakpointIndicator
        showType={false}
        partition={viewModel.breakpointPartition}
        address={viewModel.breakpointAddress}
        hasBreakpoint={viewModel.hasBreakpoint}
        current={viewModel.execPoint}
        disabled={viewModelParams.breakpoint?.disabled ?? false}
        onEdit={editable ? () => onEditBreakpoint(breakpoint) : undefined}
      />
      {/*
        * Rendered whenever the listing has a bank column at all, not merely when *this* row has a
        * label, and at the column's shared width rather than this row's own. See
        * `derivePartitionWidthCh`.
        */}
      {partitionWidthCh > 0 && (
        <PartitionPrefix label={viewModel.partitionLabel} width={partitionWidthCh} />
      )}
      {/*
        * M2: `ch`, not px. Capacity is preserved from the px these replace, measured at the row's
        * own 12.8px Iosevka (1ch = 6.4px): 48 -> 8ch, 40 -> 7ch, 140 -> 22ch, 100 -> 16ch,
        * 60 -> 10ch, 160 -> 25ch. The address column is the roomiest of them — 7ch holding a
        * 4-character address — so there is slack to reclaim if these are ever sized to content.
        */}
      <AddressLabel
        text={viewModel.addressText}
        width={viewModelParams.decimalView ? 8 : 7}
        className={styles.disassemblyAddress}
      />
      <Secondary
        text={viewModel.opCodes}
        width={viewModelParams.decimalView ? "22ch" : "16ch"}
        className={styles.disassemblyOpcodes}
      />
      <Label text={viewModel.labelText} width="10ch" className={styles.disassemblyLabel} />
      <div className={styles.tstates}>{viewModel.tstates}</div>
      <Value text={viewModel.instruction} width="25ch" className={styles.disassemblyInstruction} />
      {/*
        * Rendered on every row once any row in the listing has a comment, and at the same width on
        * all of them, so a row without one still ends where its neighbours do. Sizing it to its own
        * text is what left the stripes ragged.
        */}
      {commentWidthCh > 0 && (
        <Secondary
          text={item.hardComment ? "; " + item.hardComment : ""}
          width={`${commentWidthCh}ch`}
        />
      )}
    </div>
  );
});
