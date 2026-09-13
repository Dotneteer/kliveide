import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { EmuApi } from "@common/messaging/EmuApi";

import { getBreakpointStorageKey } from "@common/utils/breakpoints";

/**
 * What the breakpoint dialog hands back.
 *
 * `replaces` is the breakpoint the user opened the dialog on, absent when adding. The dialog itself
 * calls no API; turning this into emulator calls is `applyBreakpointEdit`'s job, so every caller
 * (the panel, the disassembly view) gets the same semantics.
 */
export type BreakpointDialogResult = {
  breakpoint: BreakpointInfo;
  replaces?: BreakpointInfo;
};

/**
 * Install the result of a breakpoint dialog.
 *
 * Two shapes, because a breakpoint has no id — its identity *is* its key, so an edit that changes
 * the address, the partition or the type is a different breakpoint and the old one has to go.
 *
 * - **Nothing to move** (adding, or an edit that only touched `disabled`/`ioMask`): `setBreakpoint`,
 *   then `enableBreakpoint` when it should start disabled. The second call is not optional, for a
 *   subtle reason: `DebugSupport.addBreakpoint` gets the breakpoint *flags* right (`collectBpFlags`
 *   reads `disabled`), but rebuilds the stored *definition* field by field without copying
 *   `disabled` across. So the emulator would stop correctly while `listBreakpoints` — and therefore
 *   the panel — reported the breakpoint as armed. `enableBreakpoint` is what writes the definition.
 * - **The key moved**: read the set, swap the one entry, and push the whole set back through
 *   `restoreBreakpoints`, which performs the replacement inside a single synchronous handler.
 *   Removing and re-adding instead would leave a window in which a gutter toggle or a script could
 *   be lost — the reason `restoreBreakpoints` exists. It re-applies `disabled` itself, so no
 *   follow-up call is needed on this path.
 */
export async function applyBreakpointEdit(
  emuApi: EmuApi,
  result: BreakpointDialogResult
): Promise<void> {
  const { breakpoint, replaces } = result;
  const newKey = getBreakpointStorageKey(breakpoint);
  const oldKey = replaces ? getBreakpointStorageKey(replaces) : undefined;

  if (oldKey !== undefined && oldKey !== newKey) {
    const current = await emuApi.listBreakpoints();
    const next = (current?.breakpoints ?? [])
      .filter((bp) => getBreakpointStorageKey(bp) !== oldKey && getBreakpointStorageKey(bp) !== newKey)
      .concat(breakpoint);
    await emuApi.restoreBreakpoints(next);
    return;
  }

  await emuApi.setBreakpoint(breakpoint);
  if (breakpoint.disabled) {
    await emuApi.enableBreakpoint(breakpoint, false);
  }
}
