import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { isLogpoint, withoutBreakpointRuntimeState } from "@common/utils/breakpoint-filters";
import { commentKindOf } from "@common/utils/source-annotations";

/*
 * The editor's breakpoint-margin context menu (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2):
 * which items a right-click offers, and what each does. No React and no Monaco, so the decisions -
 * and the one flow with a second step, "Add Conditional Breakpoint... -> Cancel removes it" - are
 * tested without mounting an editor. `MonacoEditor` supplies the target and the ports.
 */

/** What was right-clicked: a line in the glyph margin, or an inline statement marker. */
export type MarginTarget = {
  line: number;
  /** The statement's 0-based start column, for a statement marker (column breakpoint). */
  column?: number;
  /** The breakpoint already there, if any. */
  breakpoint?: BreakpointInfo;
  /** False where the line cannot hold a breakpoint (a comment, a blank line). */
  canAdd: boolean;
  /**
   * The breakpoints a `LOGPOINT`, `ASSERTION` or `WPMEM` comment on the line made (S12, Q6): every
   * definition, one per macro expansion and access kind. They get their own menu while no user
   * breakpoint is here.
   */
  comments?: BreakpointInfo[];
};

export type MarginActionId =
  | "editCondition"
  | "editHitCount"
  | "toggle"
  | "resetHits"
  | "remove"
  | "add"
  | "addConditional"
  // --- Logpoints (`.plans/LOGPOINTS_PLAN.md` §4.5)
  | "addLogpoint"
  | "toLogpoint"
  | "editLogMessage"
  | "toBreakpoint"
  // --- One-shots (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.2)
  | "addOnce"
  | "makeOnce"
  | "keepAfterStop"
  // --- `ASSERTION` / `WPMEM` comments (S12)
  | "toggleComment"
  | "showInDisassembly";

export type MarginMenuItem = {
  id: MarginActionId;
  text: string;
  dangerous?: boolean;
  disabled?: boolean;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
  /** The gesture that does the same, shown beside the text ("Shift+Click"). */
  hint?: string;
  /** For "Show in Disassembly": which address (a macro may expand a comment several times). */
  address?: number;
};

/** The modifier gesture that makes a one-shot in both gutters (O1). */
export const ONE_SHOT_GESTURE = "Shift+Click";

/**
 * What Shift+click on a breakpoint place does (O1): add a one-shot where there is none, turn a
 * regular breakpoint into a one-shot, remove a one-shot. The same rule in the editor's margin, its
 * statement markers and the disassembly gutter.
 *
 * @param existing The breakpoint already at the place, if any
 * @param place The breakpoint to create when there is none (its place only)
 * @returns What to set, or `remove` with the breakpoint to remove
 */
export function oneShotToggle(
  existing: BreakpointInfo | undefined,
  place: BreakpointInfo
): { set: BreakpointInfo } | { remove: BreakpointInfo } {
  if (!existing) return { set: asOneShot(place) };
  if (existing.oneShot) return { remove: existing };
  return { set: asOneShot(withoutBreakpointRuntimeState(existing)) };
}

/** The breakpoint as a one-shot: same key, session-owned, never saved (O2). */
export function asOneShot(bp: BreakpointInfo): BreakpointInfo {
  return { ...bp, oneShot: true, owner: { kind: "session" } };
}

/** "Keep after it stops": the same breakpoint, regular and project-owned again (O2). */
export function asRegular(bp: BreakpointInfo): BreakpointInfo {
  const { oneShot: _once, owner, ...rest } = withoutBreakpointRuntimeState(bp);
  return owner && owner.kind !== "session" ? { ...rest, owner } : rest;
}

/** `$800D`. */
function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

/** The items for a target, in menu order. */
export function marginMenuItems(target: MarginTarget): MarginMenuItem[] {
  const bp = target.breakpoint;
  if (!bp && target.comments?.length) {
    // --- A comment's breakpoints: no Remove (S3) - remove the comment, or switch the kind off
    const kind = commentKindOf(target.comments[0]) ?? "comment";
    const allDisabled = target.comments.every((c) => c.disabled);
    const addresses = [
      ...new Set(
        target.comments
          .filter((c) => c.exec)
          .map((c) => c.address)
          .filter((a): a is number => a !== undefined)
      )
    ];
    return [
      {
        id: "toggleComment",
        text: allDisabled ? `Enable ${kind}` : `Disable ${kind}`,
        hint: "Click"
      },
      ...addresses.map((address, i) => ({
        id: "showInDisassembly" as const,
        text: addresses.length > 1 ? `Show in Disassembly (${hex4(address)})` : "Show in Disassembly",
        address,
        separatorBefore: i === 0
      }))
    ];
  }
  if (bp) {
    const logpoint = isLogpoint(bp);
    const noun = logpoint ? "Logpoint" : "Breakpoint";
    const items: MarginMenuItem[] = [
      ...(logpoint ? [{ id: "editLogMessage" as const, text: "Edit Log Message..." }] : []),
      { id: "editCondition", text: "Edit Condition..." },
      { id: "editHitCount", text: "Edit Hit Count..." },
      logpoint
        ? { id: "toBreakpoint", text: "Convert to Breakpoint" }
        : { id: "toLogpoint", text: "Convert to Logpoint..." }
    ];
    // --- A logpoint never stops, so it is never a one-shot
    if (!logpoint) {
      items.push(
        bp.oneShot
          ? { id: "keepAfterStop", text: "Keep After It Stops", separatorBefore: true }
          : { id: "makeOnce", text: "Remove After It Stops", separatorBefore: true, hint: ONE_SHOT_GESTURE }
      );
    }
    return [
      ...items,
      { id: "toggle", text: bp.disabled ? `Enable ${noun}` : `Disable ${noun}`, separatorBefore: logpoint },
      { id: "resetHits", text: "Reset Hit Count" },
      { id: "remove", text: `Remove ${noun}`, dangerous: true, separatorBefore: true }
    ];
  }
  return [
    { id: "add", text: "Add Breakpoint", disabled: !target.canAdd },
    { id: "addOnce", text: "Add One-Shot Breakpoint", disabled: !target.canAdd, hint: ONE_SHOT_GESTURE },
    { id: "addConditional", text: "Add Conditional Breakpoint...", disabled: !target.canAdd },
    { id: "addLogpoint", text: "Add Logpoint...", disabled: !target.canAdd }
  ];
}

/** What the actions need from the world. */
export type MarginActionPorts = {
  add(bp: BreakpointInfo): Promise<void>;
  remove(bp: BreakpointInfo): Promise<void>;
  enable(bp: BreakpointInfo, enabled: boolean): Promise<void>;
  resetHits(bp: BreakpointInfo): Promise<void>;
  /** Re-resolve source breakpoints against the last build, so a new one is armed (and listed). */
  resolve(): Promise<void>;
  /**
   * Open the breakpoint dialog on a breakpoint; true when the user saved. `"logMessage"` opens it
   * with the action set to log.
   */
  edit(bp: BreakpointInfo, focus: "condition" | "hitCount" | "logMessage"): Promise<boolean>;
  /** Enable or disable a comment's breakpoints for the session (S3). */
  setCommentsEnabled?(bps: BreakpointInfo[], enabled: boolean): Promise<void>;
  /** Reveal an address in the live disassembly view (§4.8). */
  showInDisassembly?(address: number): Promise<void>;
};

/**
 * Carry out a menu item.
 * @param resource The document's resource name, for a breakpoint the action creates
 */
export async function runMarginAction(
  id: MarginActionId,
  target: MarginTarget,
  resource: string,
  ports: MarginActionPorts,
  address?: number
): Promise<void> {
  const existing = target.breakpoint;
  switch (id) {
    case "toggleComment":
      if (target.comments?.length) {
        await ports.setCommentsEnabled?.(
          target.comments,
          target.comments.every((c) => c.disabled)
        );
      }
      return;
    case "showInDisassembly":
      if (address !== undefined) await ports.showInDisassembly?.(address);
      return;
    case "editCondition":
    case "editHitCount":
      if (existing) await ports.edit(existing, id === "editCondition" ? "condition" : "hitCount");
      return;
    case "toggle":
      if (existing) await ports.enable(existing, !!existing.disabled);
      return;
    case "resetHits":
      if (existing) await ports.resetHits(existing);
      return;
    case "remove":
      if (existing) await ports.remove(existing);
      return;
    case "editLogMessage":
    case "toLogpoint":
      // --- Cancel leaves it as it was: converting happens only on Save
      if (existing) await ports.edit(existing, "logMessage");
      return;
    case "toBreakpoint":
      // --- `setBreakpoint` replaces the definition under its key; without a template it stops (L2)
      if (existing) {
        const { logMessage: _m, logDialect: _d, ...stopping } = withoutBreakpointRuntimeState(existing);
        await ports.add(stopping);
      }
      return;
    case "makeOnce":
      if (existing) await ports.add(asOneShot(withoutBreakpointRuntimeState(existing)));
      return;
    case "keepAfterStop":
      if (existing) await ports.add(asRegular(existing));
      return;
    case "add":
    case "addOnce":
    case "addConditional":
    case "addLogpoint": {
      if (existing || !target.canAdd) return;
      const place: BreakpointInfo = {
        resource,
        line: target.line,
        ...(target.column !== undefined ? { column: target.column } : {}),
        exec: true
      };
      const bp = id === "addOnce" ? asOneShot(place) : place;
      await ports.add(bp);
      await ports.resolve();
      if (id === "add" || id === "addOnce") return;
      // --- The breakpoint exists while its condition is being written, so the dialog edits it in
      // --- source mode like any other; Cancel means "I did not want this breakpoint" and takes it
      // --- away again.
      if (!(await ports.edit(bp, id === "addLogpoint" ? "logMessage" : "condition"))) {
        await ports.remove(bp);
      }
      return;
    }
  }
}
