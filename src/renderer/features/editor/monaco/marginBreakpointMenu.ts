import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { isLogpoint, withoutBreakpointRuntimeState } from "@common/utils/breakpoint-filters";

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
  | "toBreakpoint";

export type MarginMenuItem = {
  id: MarginActionId;
  text: string;
  dangerous?: boolean;
  disabled?: boolean;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
};

/** The items for a target, in menu order. */
export function marginMenuItems(target: MarginTarget): MarginMenuItem[] {
  const bp = target.breakpoint;
  if (bp) {
    const logpoint = isLogpoint(bp);
    const noun = logpoint ? "Logpoint" : "Breakpoint";
    return [
      ...(logpoint ? [{ id: "editLogMessage" as const, text: "Edit Log Message..." }] : []),
      { id: "editCondition", text: "Edit Condition..." },
      { id: "editHitCount", text: "Edit Hit Count..." },
      logpoint
        ? { id: "toBreakpoint", text: "Convert to Breakpoint" }
        : { id: "toLogpoint", text: "Convert to Logpoint..." },
      { id: "toggle", text: bp.disabled ? `Enable ${noun}` : `Disable ${noun}`, separatorBefore: true },
      { id: "resetHits", text: "Reset Hit Count" },
      { id: "remove", text: `Remove ${noun}`, dangerous: true, separatorBefore: true }
    ];
  }
  return [
    { id: "add", text: "Add Breakpoint", disabled: !target.canAdd },
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
};

/**
 * Carry out a menu item.
 * @param resource The document's resource name, for a breakpoint the action creates
 */
export async function runMarginAction(
  id: MarginActionId,
  target: MarginTarget,
  resource: string,
  ports: MarginActionPorts
): Promise<void> {
  const existing = target.breakpoint;
  switch (id) {
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
    case "add":
    case "addConditional":
    case "addLogpoint": {
      if (existing || !target.canAdd) return;
      const bp: BreakpointInfo = {
        resource,
        line: target.line,
        ...(target.column !== undefined ? { column: target.column } : {}),
        exec: true
      };
      await ports.add(bp);
      await ports.resolve();
      if (id === "add") return;
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
