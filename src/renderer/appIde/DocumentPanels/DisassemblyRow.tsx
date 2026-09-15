import classnames from "classnames";
import { AddressLabel, PartitionPrefix } from "@renderer/controls/data";
import { isWidePartitionLabel } from "@renderer/controls/data/partitionWidth";
import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { getBreakpointAddressSpec } from "@common/utils/breakpoints";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Label } from "@renderer/controls/layout/Label";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { Value } from "@renderer/controls/layout/Value";
import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { BreakpointIndicator } from "./BreakpointIndicator";
import { isBinaryBreakpoint } from "@renderer/appIde/utils/breakpoint-form";
import { formatBranchReadout, isCall, type BranchVerdict } from "./branchVerdict";
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
  /**
   * The bank and offset this row belongs to, when the listing is of a 16K bank rather than of the
   * 64K map.
   *
   * Only used when the row has **no** breakpoint yet, to decide what an unarmed gutter would create.
   * `BreakpointIndicator` builds its `bp-set` from `breakpointAddress`, and the fallback there is
   * the row's Z80 address — which in a bank listing arms a breakpoint at wherever the bank happens
   * to be paged, not at an offset in the bank. The bank gutter then never finds it, because it looks
   * up by offset: the breakpoint exists, shows in the sidebar, and is invisible on the row that made
   * it.
   *
   * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.20.
   */
  bankScope?: { bank: number; bankOffset: number };
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
  bankScope,
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
    /*
     * A breakpoint that is not bound to a plain address is named by its *address spec*; an
     * address-bound one shows its raw address.
     *
     * That covers two cases. A source-bound breakpoint reads `[file]:12`, as it always did. And a
     * **bank-relative** one reads `05:+$0100` — which matters beyond display, because
     * `BreakpointIndicator` builds its `bp-set` / `bp-del` / `bp-en` command from this very string.
     * Passing the row's address instead would arm a breakpoint at a Z80 address rather than at an
     * offset in the bank the row belongs to.
     *
     * The address *spec*, not the display key: the key ends in `:W` for a memory-write breakpoint,
     * and the commands take the kind as an option rather than as part of the address, so the key
     * produced `bp-del 05:+$0100:W -w` — which parses as nothing. The address-bound case never hit
     * this only because it passes a number rather than a key.
     */
    breakpointAddress:
      breakpoint?.resource || breakpoint?.bankOffset !== undefined
        ? getBreakpointAddressSpec(breakpoint, partitionLabels)
        : bankScope
          ? // --- No breakpoint here yet, and this is a bank listing: name the site the gutter would
            // --- create as an offset in the bank, not as the address the bank currently sits at.
            getBreakpointAddressSpec(
              { bank: bankScope.bank, bankOffset: bankScope.bankOffset } as BreakpointInfo,
              partitionLabels
            )
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

/**
 * The gutter glyph for a verdict, and the token that paints it.
 *
 * Six states. Five are directions — where control goes — and the sixth says control comes *back*:
 *
 * | State | Glyph | Meaning |
 * |---|---|---|
 * | not taken   | straight vertical   | carries on into the next row |
 * | call / rst  | out-and-back hook   | leaves and returns; `RST n` is `CALL n` in one byte |
 * | back        | arrow up            | jumps to an address at or below this one - a loop closing |
 * | forward     | arrow down          | jumps ahead - a skip |
 * | return      | arrow left          | leaves through the stack |
 * | unknown     | dashed arrow right  | leaves, but the destination cannot be obtained |
 *
 * The two tests are ordered deliberately. **Not-taken is checked first**, because a conditional
 * call that will not be taken carries on to the next instruction like any other fall-through and
 * must not be drawn as a call. **The call test then beats direction**, because a call is a call
 * whichever way its target lies: drawing `rst $08` as "arrow up" put it in the same visual class as
 * a loop closing, which is what it is not.
 *
 * The dashes on `unknown` are the whole idea there: the arrow still says the flow leaves here, and
 * the broken line says we cannot tell you where. A `?` was considered and rejected - it is
 * illegible at this size. See `BranchVerdict.unobtainable`.
 */
export function branchGlyphFor(verdict: BranchVerdict): { iconName: string; fill: string } {
  const taken = "--color-disassembly-branch-taken";
  if (verdict.direction === "none") {
    return { iconName: "branch-through", fill: "--color-disassembly-branch-fallthrough" };
  }
  if (isCall(verdict.kind)) {
    return { iconName: "branch-call", fill: taken };
  }
  switch (verdict.direction) {
    case "back":
      return { iconName: "branch-back", fill: taken };
    case "forward":
      return { iconName: "branch-forward", fill: taken };
    case "return":
      return { iconName: "branch-return", fill: taken };
    case "unknown":
    default:
      return { iconName: "branch-unknown", fill: taken };
  }
}

/**
 * The execution-point readout, in both of its renderings.
 *
 * Both are always in the DOM; a container query on `.disassemblyWrapper` shows one and hides the
 * other, so the swap costs no JavaScript, no `ResizeObserver` and no re-render on resize. See
 * `.branchReadoutLong` in the stylesheet for why the threshold is in `ch`.
 *
 * The tooltip carries the long form unconditionally. In a wide panel that merely repeats what is
 * already on screen, which is harmless; in a narrow one it is the only place the full sentence
 * exists. Bound to the readout rather than to the row — the row has no other tooltip, so there is
 * no risk of the two-boxes-for-one-pointer problem the shared primitives warn about, and the
 * readout is its own comfortable hit area.
 */
function BranchReadout({
  verdict,
  decimalView
}: {
  verdict: BranchVerdict;
  decimalView: boolean;
}) {
  const ref = useTooltipRef();
  const { long, short } = formatBranchReadout(verdict, decimalView);
  return (
    <span
      ref={ref}
      className={classnames(styles.branchReadout, { [styles.notTaken]: !verdict.taken })}
      data-testid="branch-readout"
    >
      {/*
        * Head and detail are painted differently on purpose: the outcome - the verb and the
        * address - is what the eye should land on, and the evidence behind it is supporting text.
        * Colouring the whole string as the outcome made a green sentence of it.
        */}
      <span className={styles.branchReadoutLong} data-readout="long">
        <span className={styles.branchOutcome}>{long.head}</span>
        {long.detail && `  ·  ${long.detail}`}
      </span>
      <span className={styles.branchReadoutShort} data-readout="short">
        <span className={styles.branchOutcome}>{short.head}</span>
        {short.detail && `  ${short.detail}`}
      </span>
      <TooltipFactory refElement={ref.current} placement="bottom" offsetY={4} content={long.text} />
    </span>
  );
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
  /**
   * Reserve the branch gutter on this row.
   *
   * A property of the *listing*, not of the row: when the panel is showing verdicts at all, every
   * row reserves the cell so the columns after it line up, and a row with no verdict simply leaves
   * it empty. False - the machine is not started, so there is nothing to predict - omits the cell
   * entirely and the row has exactly the geometry it always had.
   */
  showBranchGutter?: boolean;
  /**
   * This row's live branch verdict, when it branches and the machine can supply one.
   *
   * Undefined on a non-branching row, and on every row when `showBranchGutter` is false.
   */
  verdict?: BranchVerdict;
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
  showBranchGutter = false,
  verdict,
  ...viewModelParams
}: DisassemblyRowProps) {
  const breakpoint = viewModelParams.breakpoint;
  // --- Address-bound and bank-relative breakpoints are both editable: the dialog authors either
  // --- shape. A source-bound one is not — it belongs to the editor's glyph margin, which places
  // --- and moves it by line. `isBinaryBreakpoint` is the same gate the dialog's opener uses, so
  // --- the row cannot offer an edit the dialog would refuse.
  const editable = onEditBreakpoint && breakpoint && isBinaryBreakpoint(breakpoint);
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
  /*
   * A synopsis paragraph is set off from the code by space at its outer edges only.
   *
   * The note is stored as one comment per line and rendered as one row per line, so the *block* is
   * a run of rows rather than a single element. `synopsisEdge` (set where those rows are built, in
   * `nexAnnotatedDisassembly`) says which end each row is, so the space lands above the first line
   * and below the last and never between them — a gap on every line would read as three separate
   * notes rather than one. A one-line synopsis is `"only"` and takes both.
   */
  const synopsisEdge = isPrefixComment ? item.annotation?.synopsisEdge : undefined;
  const spacedSynopsis = synopsisEdge === "first" || synopsisEdge === "last" || synopsisEdge === "only";

  return (
    <div
      className={classnames(styles.item, {
        [styles.even]: index % 2 == 0,
        [styles.selectedRangeItem]: selectedRange,
        [styles.selectedItem]: selected,
        [styles.execPoint]: viewModel?.execPoint,
        [styles.synopsisBlockFirst]: synopsisEdge === "first" || synopsisEdge === "only",
        [styles.synopsisBlockLast]: synopsisEdge === "last" || synopsisEdge === "only"
      })}
      data-testid={`disassembly-row-${index}`}
      data-annotation-offset={item.annotation?.bankOffset}
      data-annotation-length={item.annotation?.byteLength}
      data-annotation-region={item.annotation?.regionType}
      data-selected={selected ? "true" : undefined}
      data-selected-range={selectedRange ? "true" : undefined}
      data-synopsis-edge={synopsisEdge}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      aria-selected={selected || selectedRange || undefined}
      tabIndex={onClick || onContextMenu || onKeyDown ? 0 : undefined}
      /*
       * The edge rows of a synopsis block are the one kind of row the stylesheet sizes.
       *
       * They are taller than a listing row by the gap that sets the note off from the code, and the
       * app sets `box-sizing: border-box` universally (`assets/styles/index.css`) — so the gap has
       * to be *added to* the declared height, not just padded into it, or it is taken out of the
       * text's own box and nothing moves. The arithmetic lives with the gap it depends on, in
       * `.synopsisBlockFirst` / `.synopsisBlockLast`; an inline height here would beat those rules
       * and is therefore withheld. `--row-size-disassembly` and this prop are the same number from
       * the same `getRowSizes`, so the rows still line up.
       */
      style={spacedSynopsis ? undefined : { height: rowHeight }}
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
          {/*
            * The kind flags are passed, not merely displayed.
            *
            * `BreakpointIndicator` builds its `bp-set` / `bp-del` / `bp-en` commands from these,
            * so a gutter showing a memory breakpoint while claiming it is an execution one issued
            * `bp-del $8000` for a breakpoint whose key is `$8000 R` — no match, nothing removed,
            * and a dot that could not be clicked away. Watchpoints on a NEX bank made that
            * reachable; the live view could hit it too.
            *
            * `showType` stays off: the gutter is one 16px cell, and a second glyph beside it would
            * change every row's geometry. The kind is named in the indicator's tooltip instead, and
            * `selectRowBreakpoint` prefers an execution breakpoint when a row has both, so the
            * common case is the one the column is about.
            */}
          <BreakpointIndicator
            showType={false}
            partition={viewModel.breakpointPartition}
            address={viewModel.breakpointAddress}
            hasBreakpoint={viewModel.hasBreakpoint}
            current={viewModel.execPoint}
            disabled={viewModelParams.breakpoint?.disabled ?? false}
            memoryRead={breakpoint?.memoryRead}
            memoryWrite={breakpoint?.memoryWrite}
            ioRead={breakpoint?.ioRead}
            ioWrite={breakpoint?.ioWrite}
            ioMask={breakpoint?.ioMask}
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
          {/*
            * Rendered on every row once the listing has verdicts at all, empty where the row does
            * not branch - see `showBranchGutter`. The dimming that separates a speculative verdict
            * from the certain one at PC lives in the stylesheet, keyed off `.execPoint`, so it is
            * not restated per row here.
            */}
          {showBranchGutter && (
            <span
              className={styles.branchGutter}
              data-branch={verdict?.direction}
              /*
               * The glyph actually chosen, not just the direction it came from.
               *
               * `data-branch` alone cannot say which mark is on screen now that a call is drawn by
               * kind rather than by direction. Exposing the resolved name keeps a test, and the
               * screenshot recipe, able to ask what the row really shows instead of re-deriving it.
               */
              data-branch-glyph={verdict ? branchGlyphFor(verdict).iconName : undefined}
            >
              {verdict && (
                <Icon
                  iconName={branchGlyphFor(verdict).iconName}
                  fill={branchGlyphFor(verdict).fill}
                  width={12}
                  height={12}
                />
              )}
            </span>
          )}
          <Value
            text={viewModel.instruction}
            width="25ch"
            className={
              isDirective ? styles.annotationDirective : styles.disassemblyInstruction
            }
          >
            {/*
              * One wrapper around every part, rather than the parts as direct children.
              *
              * The cell is `display: flex` (`DataValue`), so direct children would make each run
              * its own *anonymous flex item* — a block box, which drops the white space at the end
              * of its line. That is what rendered `jp Start` as `jpStart`: the space belongs to the
              * `"jp "` run that precedes the tinted operand. Inside one wrapper the runs share a
              * single inline formatting context, so the space between them is ordinary inter-word
              * space and survives.
              */}
            {instructionParts && (
              <span className={styles.instructionRun}>
                {instructionParts.map((part, partIndex) =>
                  typeof part === "string" ? (
                    part
                  ) : (
                    <span key={partIndex} className={styles.annotationOperand}>
                      {part.label}
                    </span>
                  )
                )}
              </span>
            )}
          </Value>
          {/*
            * The execution-point readout. Only at PC, where the verdict is fact rather than a guess
            * about flags that have not happened yet — every other row is carried by the quiet
            * gutter glyph alone.
            */}
          {showBranchGutter && verdict && viewModel.execPoint && (
            <BranchReadout verdict={verdict} decimalView={viewModelParams.decimalView} />
          )}
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
