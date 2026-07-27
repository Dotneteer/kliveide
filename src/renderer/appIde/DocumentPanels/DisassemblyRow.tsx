import classnames from "classnames";
import { memo } from "react";
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

  return {
    address,
    addressText: decimalView ? toDecimal5(address) : toHexa4(address),
    breakpointAddress: breakpoint?.resource ? getBreakpointKey(breakpoint) : address,
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
};

export const DisassemblyRow = memo(function DisassemblyRow({
  index,
  item,
  rowHeight,
  ...viewModelParams
}: DisassemblyRowProps) {
  const viewModel = deriveDisassemblyRowViewModel({
    ...viewModelParams,
    item
  });

  return (
    <div
      className={classnames(styles.item, {
        [styles.even]: index % 2 == 0
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
      />
      {viewModel.showBankLabel && (
        <>
          <LabelSeparator />
          <Label text={viewModel.partitionLabel} width={viewModel.useWidePartitions ? 26 : 18} />
          <Label text=":" width={6} />
        </>
      )}
      <LabelSeparator />
      <Label text={viewModel.addressText} width={viewModelParams.decimalView ? 48 : 40} />
      <Secondary text={viewModel.opCodes} width={viewModelParams.decimalView ? 140 : 100} />
      <Label text={viewModel.labelText} width={60} />
      <div className={styles.tstates}>{viewModel.tstates}</div>
      <Value text={viewModel.instruction} width={160} />
      {item.hardComment && <Secondary text={"; " + item.hardComment} />}
    </div>
  );
});
