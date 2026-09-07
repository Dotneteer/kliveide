import classnames from "classnames";
import { AddressLabel, PartitionPrefix } from "@renderer/controls/data";
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
      />
      {viewModel.showBankLabel && viewModel.partitionLabel && (
        <PartitionPrefix label={viewModel.partitionLabel} wide={viewModel.useWidePartitions} />
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
      {item.hardComment && <Secondary text={"; " + item.hardComment} />}
    </div>
  );
});
