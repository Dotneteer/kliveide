import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import type { NexAnnotationMenuAction } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";

import { breakpointCommandSpec } from "@common/utils/breakpoint-spec";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { ONE_SHOT_GESTURE } from "@renderer/features/editor/monaco/marginBreakpointMenu";

/*
 * The live disassembly view's row menu (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.2): the
 * gutter's gestures, named and discoverable. Each item is an IDE command, so the menu adds no
 * second path to the breakpoint set. No React, so the items are tested without a view.
 */

/** The row a right-click landed on. */
export type RowMenuTarget = {
  /** The row's Z80 address. */
  address: number;
  /** What the gutter's commands name the row by: `$8000`, `05:+$0100`, `[main.asm]:12`. */
  spec: string;
  /** The breakpoint the gutter shows on the row, if any. */
  breakpoint?: BreakpointInfo;
  /** The row's listing item: what the annotation entries act on. */
  item?: DisassemblyItem;
};

/**
 * The annotation entries of a live row (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5): the
 * bank document's own, with the same shortcuts, acting on the bank or ROM page the row is in.
 */
export type AnnotationRowMenuItem = {
  id: NexAnnotationMenuAction;
  text: string;
  hint?: string;
  disabled?: boolean;
  /** Why the entry is disabled: the row's memory cannot be annotated, or no set is active. */
  tooltip?: string;
  separatorBefore?: boolean;
};

/**
 * The annotation entries for a row.
 *
 * @param destination Where the result goes: "your ROM annotations" or the set's file name; absent
 * with `disabledReason` when the row cannot be annotated
 * @param hints The shortcut each action has in a bank document (`NEX_ANNOTATION_SHORTCUTS`)
 * @param regionActions The region kinds this machine offers
 */
export function annotationRowMenuItems(args: {
  destination?: string;
  disabledReason?: string;
  rom: boolean;
  hasOperands: boolean;
  hasDefinition: boolean;
  hints: Partial<Record<NexAnnotationMenuAction, string>>;
  regionActions: { id: NexAnnotationMenuAction; text: string }[];
}): AnnotationRowMenuItem[] {
  const disabled = !!args.disabledReason;
  const suffix = args.rom ? " (your ROM annotations)" : "";
  const entry = (
    id: NexAnnotationMenuAction,
    text: string,
    extra: Partial<AnnotationRowMenuItem> = {}
  ): AnnotationRowMenuItem => ({
    id,
    text,
    hint: args.hints[id],
    ...(disabled ? { disabled: true, tooltip: args.disabledReason } : {}),
    ...extra
  });
  return [
    entry("local-label", `Label${suffix}...`, { separatorBefore: true }),
    entry("synopsis", `Synopsis Comment${suffix}...`),
    entry("comment", `End-of-Line Comment${suffix}...`),
    entry("operand-label", `Operand Label${suffix}...`, args.hasOperands ? {} : { disabled: true }),
    ...args.regionActions.map((region, index) =>
      entry(region.id, region.text, index === 0 ? { separatorBefore: true } : {})
    ),
    entry("goto-definition", "Go to Definition", {
      separatorBefore: true,
      ...(args.hasDefinition ? {} : { disabled: true })
    })
  ];
}

export type RowMenuItem = {
  id: "toggle" | "addOnce" | "makeOnce" | "keepAfterStop" | "runTo" | "edit";
  text: string;
  /** The gesture that does the same. */
  hint?: string;
  disabled?: boolean;
  separatorBefore?: boolean;
  /** The IDE command the item runs; absent for Edit, which opens the dialog. */
  command?: string;
};

const runToModifier =
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform ?? "") ? "Cmd" : "Ctrl";

/** The items for a row, in menu order. */
export function disassemblyRowMenuItems(
  target: RowMenuTarget,
  partitionLabels: Record<number, string>
): RowMenuItem[] {
  const bp = target.breakpoint;
  // --- An `ASSERTION`/`WPMEM`/`LOGPOINT` comment owns its breakpoint (S3)
  const owned = bp?.owner?.kind === "annotation";
  const spec = bp && !owned ? breakpointCommandSpec(bp, partitionLabels) : undefined;
  const items: RowMenuItem[] = [];
  if (bp && !owned) {
    items.push({ id: "toggle", text: "Remove Breakpoint", hint: "Right-Click", command: `bp-del ${spec}` });
    if (!bp.logMessage) {
      items.push(
        bp.oneShot
          ? { id: "keepAfterStop", text: "Keep After It Stops", command: `bp-set ${breakpointCommandSpec({ ...bp, oneShot: false }, partitionLabels)}` }
          : { id: "makeOnce", text: "Remove After It Stops", hint: ONE_SHOT_GESTURE, command: `bp-set ${breakpointCommandSpec({ ...bp, oneShot: true }, partitionLabels)}` }
      );
    }
  } else {
    items.push(
      { id: "toggle", text: "Add Breakpoint", hint: "Right-Click", disabled: owned, command: `bp-set ${target.spec}` },
      { id: "addOnce", text: "Add One-Shot Breakpoint", hint: ONE_SHOT_GESTURE, disabled: owned, command: `bp-set ${target.spec} -once` }
    );
  }
  items.push({
    id: "runTo",
    text: "Run to Here",
    hint: `${runToModifier}+Click`,
    separatorBefore: true,
    command: `run-to $${toHexa4(target.address)}`
  });
  items.push({ id: "edit", text: "Edit Breakpoint...", hint: "Double-Click", disabled: !bp });
  return items;
}
