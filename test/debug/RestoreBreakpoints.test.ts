import { describe, it, expect } from "vitest";

import { DebugSupport } from "@emu/machines/DebugSupport";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";

/**
 * Mirrors what `EmuMessageProcessor.restoreBreakpoints` does, so the contract that the project-open
 * flow depends on is covered: replacing the whole breakpoint set in one step must not quietly
 * re-enable breakpoints that were saved as disabled.
 *
 * `resetBreakpointsTo` rebuilds the definitions through `addBreakpoint`, which deliberately does
 * not carry the `disabled` flag over - hence the explicit re-apply.
 */
function restoreBreakpoints(debugSupport: DebugSupport, bps: BreakpointInfo[]): void {
  debugSupport.resetBreakpointsTo(bps ?? []);
  for (const bp of bps ?? []) {
    if (bp.disabled) {
      debugSupport.enableBreakpoint(bp, false);
    }
  }
}

describe("restoring a whole breakpoint set atomically", () => {
  it("installs every breakpoint and drops any previous ones", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x1000, exec: true });

    restoreBreakpoints(ds, [
      { address: 0x2000, exec: true },
      { address: 0x3000, exec: true }
    ]);

    expect(ds.breakpointDefs.size).toEqual(2);
    expect(ds.breakpointDefs.has(getBreakpointKey({ address: 0x1000 }))).toBe(false);
    expect(ds.breakpointDefs.has(getBreakpointKey({ address: 0x2000 }))).toBe(true);
    expect(ds.breakpointDefs.has(getBreakpointKey({ address: 0x3000 }))).toBe(true);
  });

  it("preserves the disabled state of restored breakpoints", () => {
    const ds = new DebugSupport();

    restoreBreakpoints(ds, [
      { address: 0x2000, exec: true },
      { address: 0x3000, exec: true, disabled: true }
    ]);

    const enabled = ds.breakpointDefs.get(getBreakpointKey({ address: 0x2000 }));
    const disabled = ds.breakpointDefs.get(getBreakpointKey({ address: 0x3000 }));

    expect(enabled?.disabled).toBeFalsy();
    // --- A breakpoint saved as disabled must come back disabled, not silently armed.
    expect(disabled?.disabled).toBe(true);
  });

  it("clears the set when restoring an empty list", () => {
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0x1000, exec: true });

    restoreBreakpoints(ds, []);

    expect(ds.breakpointDefs.size).toEqual(0);
  });
});
