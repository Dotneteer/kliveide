import classnames from "classnames";
import { AddressLabel, PartitionPrefix } from "@renderer/controls/data";
import { isWidePartitionLabel } from "@renderer/controls/data/partitionWidth";
import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { BreakpointIndicator } from "./BreakpointIndicator";
import type { DisassemblyItem, DisassemblyOperandInfo } from "../disassemblers/common-types";
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

/**
 * Characters the label column reserves when the caller does not size it.
 *
 * Enough for a generated `L1234:` / `L65535:`, which is every label a machine disassembly produces.
 * A listing whose labels are user-named sizes its own column — see `deriveLabelWidthCh`.
 */
export const DEFAULT_LABEL_WIDTH_CH = 10;

/**
 * The text a row puts in its label column.
 *
 * Exported so a panel can size the shared column from the same rule the row renders with, rather
 * than re-deriving it and drifting — the argument `partitionWidth.ts` makes for the bank column.
 */
export function formatDisassemblyLabel(item: DisassemblyItem, decimalView: boolean): string {
  const formattedLabel = item.formattedLabel;
  if (formattedLabel) {
    return formattedLabel.endsWith(":") ? formattedLabel : `${formattedLabel}:`;
  }
  return item.hasLabel
    ? `L${decimalView ? toDecimal5(item.address) : toHexa4(item.address)}:`
    : "";
}

/**
 * Characters the label column occupies, shared by every row in the listing.
 *
 * Only a listing carrying *named* labels needs this. A generated `L1234:` always fits the default,
 * but an annotation label is whatever the user typed, and the cell is `flex: 0 0 auto` with an
 * explicit width — text longer than the cell does not widen it, it spills over the columns to its
 * right. Sized across the whole listing rather than per row, so the columns after it still line up.
 *
 * @param items Every row the listing can show
 * @param decimalView Whether the panel is showing decimal values
 */
export function deriveLabelWidthCh(
  items: readonly DisassemblyItem[],
  decimalView: boolean
): number {
  return items.reduce(
    (widest, item) => Math.max(widest, formatDisassemblyLabel(item, decimalView).length),
    DEFAULT_LABEL_WIDTH_CH
  );
}

/**
 * Splits an instruction so the operand labels a resolver substituted can be tinted separately.
 *
 * The disassembler puts a resolved label into the instruction as plain text, so by the time a row
 * sees `"ld hl,SpriteTable"` nothing marks where the name starts. `resolvedText` on each operand
 * candidate is what went in, so the name can be found again — matched left to right and each
 * candidate consumed once, which is what keeps two operands resolving to the same name from both
 * landing on the first occurrence.
 *
 * Returns plain strings and `{ label }` markers rather than elements, so the rule stays testable
 * without rendering.
 */
export type InstructionPart = string | { label: string };

export function splitInstructionOperands(
  instruction: string,
  operands: readonly DisassemblyOperandInfo[] | undefined
): InstructionPart[] {
  const names = (operands ?? [])
    .map((operand) => operand.resolvedText)
    .filter((name): name is string => !!name);
  if (names.length === 0 || !instruction) return [instruction];

  const parts: InstructionPart[] = [];
  let rest = instruction;
  for (const name of names) {
    const at = rest.indexOf(name);
    // --- The resolver ran but the name is not in the finished text: a custom disassembler rewrote
    // --- the instruction afterwards. Leave what is left alone rather than guessing.
    if (at < 0) continue;
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push({ label: name });
    rest = rest.slice(at + name.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Whether a row carries anything the *user* put there, as opposed to anything the disassembler
 * worked out. Drives the leading rail: scrolling a bank, the rail is how far the documenting got.
 */
export function isAuthoredRow(item: DisassemblyItem): boolean {
  const annotation = item.annotation;
  if (!annotation) return false;
  return (
    !!annotation.hasLineAnnotation ||
    !!annotation.hasLabel ||
    (!!annotation.regionType && annotation.regionType !== "disassemble")
  );
}

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
    labelText: formatDisassemblyLabel(item, decimalView),
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
   * Characters reserved for the label column, shared by every row in the list.
   *
   * Defaults to `DEFAULT_LABEL_WIDTH_CH`, which fits every label a machine disassembly generates.
   * Pass `deriveLabelWidthCh(items, decimalView)` for a listing whose labels are user-named.
   */
  labelWidthCh?: number;
  /**
   * Draw this row as an *annotated* listing row rather than a machine disassembly row.
   *
   * Opt-in, and off by default, because the two views have different colour tables and only the
   * `.NEX` viewer has a sidecar to annotate from — see `--color-annotation-*`. It changes nothing
   * about the row's structure: the same cells, at the same widths, in different hues, plus the
   * leading rail.
   */
  annotated?: boolean;
  selected?: boolean;
  selectedRange?: boolean;
  /**
   * Open the breakpoint editor for this row's breakpoint.
   *
   * Supplied by the panel so the whole listing shares one callback: the disassembly view has no row
   * menu of its own, so the indicator's double-click is the way in.
   */
  onEditBreakpoint?: (breakpoint: BreakpointInfo) => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
};

export const DisassemblyRow = memo(function DisassemblyRow({
  annotated = false,
  commentWidthCh,
  index,
  item,
  labelWidthCh = DEFAULT_LABEL_WIDTH_CH,
  onClick,
  onContextMenu,
  onEditBreakpoint,
  onKeyDown,
  partitionWidthCh,
  rowHeight,
  selected,
  selectedRange,
  ...viewModelParams
}: DisassemblyRowProps) {
  const breakpoint = viewModelParams.breakpoint;
  // --- Only an address-bound breakpoint is editable here. A source-bound one belongs to the
  // --- editor's glyph margin, which places and moves it by line.
  const editable = onEditBreakpoint && breakpoint && breakpoint.address !== undefined;
  // --- A synopsis row stands in for a comment above the code, not for an instruction: it has no
  // --- address, so there is no view model to derive and no instruction columns to render.
  const isPrefixComment = item.prefixComment !== undefined;
  const viewModel = !isPrefixComment
    ? deriveDisassemblyRowViewModel({
        ...viewModelParams,
        item
      })
    : undefined;

  // --- A region the user marked as data is a directive, not something the CPU runs, so it takes the
  // --- directive hue rather than the instruction one. "disassemble" is code and keeps its own.
  const isDirective =
    annotated && !!item.annotation?.regionType && item.annotation.regionType !== "disassemble";
  const instructionParts =
    annotated && !isDirective
      ? splitInstructionOperands(viewModel?.instruction ?? "", item.operandCandidates)
      : undefined;
  const showRail = annotated && isAuthoredRow(item);

  return (
    <div
      className={classnames(styles.item, {
        [styles.even]: index % 2 == 0,
        [styles.selectedRangeItem]: selectedRange,
        [styles.selectedItem]: selected,
        [styles.execPoint]: viewModel?.execPoint
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
      {/*
        * Rendered on every annotated row, lit only on the authored ones, so the columns after it sit
        * at the same x down the whole listing rather than shifting where the rail happens to appear.
        */}
      {annotated && (
        <span
          className={classnames(styles.annotationRail, { [styles.authored]: showRail })}
          data-authored={showRail ? "true" : undefined}
        />
      )}
      {isPrefixComment ? (
        <div
          className={classnames(styles.synopsisCommentLine, {
            [styles.annotationComment]: annotated
          })}
        >
          ; {item.prefixComment}
        </div>
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
            onEdit={editable ? () => onEditBreakpoint(breakpoint) : undefined}
          />
          {/*
            * Rendered whenever the listing has a bank column at all, not merely when *this* row has
            * a label, and at the column's shared width rather than this row's own. See
            * `derivePartitionWidthCh`.
            */}
          {partitionWidthCh > 0 && (
            <PartitionPrefix label={viewModel.partitionLabel} width={partitionWidthCh} />
          )}
          {/*
            * M2: `ch`, not px. Capacity is preserved from the px these replace, measured at the
            * row's own 12.8px Iosevka (1ch = 6.4px): 48 -> 8ch, 40 -> 7ch, 140 -> 22ch,
            * 100 -> 16ch, 60 -> 10ch, 160 -> 25ch. The address column is the roomiest of them —
            * 7ch holding a 4-character address — so there is slack to reclaim if these are ever
            * sized to content.
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
          {/* --- An explicit `ch` string: a bare number means px to `controls/layout`'s cells. */}
          <Label
            text={viewModel.labelText}
            width={`${labelWidthCh}ch`}
            className={annotated ? styles.annotationLabel : styles.disassemblyLabel}
          />
          <div className={styles.tstates}>{viewModel.tstates}</div>
          <Value
            text={viewModel.instruction}
            width="25ch"
            className={
              isDirective ? styles.annotationDirective : styles.disassemblyInstruction
            }
          >
            {instructionParts?.map((part, partIndex) =>
              typeof part === "string" ? (
                part
              ) : (
                <span key={partIndex} className={styles.annotationOperand}>
                  {part.label}
                </span>
              )
            )}
          </Value>
          {/*
            * Rendered on every row once any row in the listing has a comment, and at the same width
            * on all of them, so a row without one still ends where its neighbours do. Sizing it to
            * its own text is what left the stripes ragged.
            */}
          {commentWidthCh > 0 && (
            <Secondary
              text={item.hardComment ? "; " + item.hardComment : ""}
              width={`${commentWidthCh}ch`}
              className={annotated ? styles.annotationComment : undefined}
            />
          )}
        </>
      )}
    </div>
  );
});
