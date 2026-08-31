import classnames from "classnames";
import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { BreakpointIndicator } from "./BreakpointIndicator";
import type { DisassemblyItem } from "../disassemblers/common-types";
import { toDecimal3, toDecimal5, toHexa2, toHexa4 } from "../services/ide-commands";
import styles from "./DisassemblyPanel.module.scss";

const Z80_INSTRUCTION_COLUMN_WIDTH = 240;

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
  let useWidePartitions = false;

  if (showBanks && partitionLabel && decimalView) {
    const partAsNumber = parseInt(partitionLabel, 16);
    if (!isNaN(partAsNumber)) {
      useWidePartitions = true;
      partitionLabel = toDecimal3(partAsNumber);
    }
  }

  const opCodes =
    item.opCodes?.map((opCode) => (decimalView ? toDecimal3(opCode) : toHexa2(opCode))).join(" ") ??
    "";
  const formattedLabel = item.formattedLabel;
  const labelText = formattedLabel
    ? formattedLabel.endsWith(":") ? formattedLabel : `${formattedLabel}:`
    : item.hasLabel
      ? `L${decimalView ? toDecimal5(address) : toHexa4(address)}:`
      : "";

  return {
    address,
    addressText: decimalView ? toDecimal5(address) : toHexa4(address),
    breakpointAddress: breakpoint?.resource ? getBreakpointKey(breakpoint) : address,
    breakpointPartition:
      breakpoint?.partition !== undefined ? (partitionLabels[breakpoint.partition] ?? "?") : undefined,
    execPoint: address === pausedPc,
    hasBreakpoint: !!breakpoint,
    instruction: item.instruction ?? "",
    labelText,
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
  selected?: boolean;
  selectedRange?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export const DisassemblyRow = memo(function DisassemblyRow({
  index,
  item,
  onClick,
  onContextMenu,
  onKeyDown,
  rowHeight,
  selected,
  selectedRange,
  ...viewModelParams
}: DisassemblyRowProps) {
  const isPrefixComment = item.prefixComment !== undefined;
  const viewModel = !isPrefixComment
    ? deriveDisassemblyRowViewModel({
        ...viewModelParams,
        item
      })
    : undefined;

  return (
    <div
      className={classnames(styles.item, {
        [styles.even]: index % 2 == 0,
        [styles.selectedRangeItem]: selectedRange,
        [styles.selectedItem]: selected
      })}
      data-testid={`disassembly-row-${index}`}
      data-annotation-offset={item.annotation?.bankOffset}
      data-annotation-length={item.annotation?.byteLength}
      data-annotation-region={item.annotation?.regionType}
      data-selected={selected ? "true" : undefined}
      data-selected-range={selectedRange ? "true" : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      aria-selected={selected || selectedRange || undefined}
      tabIndex={onClick || onContextMenu || onKeyDown ? 0 : undefined}
      style={{ height: rowHeight }}
    >
      {isPrefixComment ? (
        <div className={styles.synopsisCommentLine}>; {item.prefixComment}</div>
      ) : (
        <>
          <LabelSeparator />
          <BreakpointIndicator
            showType={false}
            partition={viewModel.breakpointPartition}
            address={viewModel.breakpointAddress}
            hasBreakpoint={viewModel.hasBreakpoint}
            current={viewModel.execPoint}
            disabled={viewModelParams.breakpoint?.disabled ?? false}
          />
          {viewModel.showBankLabel && viewModel.partitionLabel && (
            <div className={styles.partitionPrefix}>
              <span
                className={styles.partitionLabel}
                style={{ width: viewModel.useWidePartitions ? "3ch" : "2ch" }}
              >
                {viewModel.partitionLabel}
              </span>
              <span className={styles.partitionColon}>:</span>
            </div>
          )}
          <div
            className={styles.addressLabel}
            style={{ width: viewModelParams.decimalView ? 48 : 40 }}
          >
            {viewModel.addressText}
          </div>
          <Secondary text={viewModel.opCodes} width={viewModelParams.decimalView ? 140 : 100} />
          <Label text={viewModel.labelText} width="18ch" />
          <div className={styles.tstates}>{viewModel.tstates}</div>
          <Value text={viewModel.instruction} width={Z80_INSTRUCTION_COLUMN_WIDTH} />
          {item.hardComment && <Secondary text={"; " + item.hardComment} />}
        </>
      )}
    </div>
  );
});
