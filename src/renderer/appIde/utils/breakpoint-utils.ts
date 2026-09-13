import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { createEmuApi } from "@common/messaging/EmuApi";
import { MessengerBase } from "@common/messaging/MessengerBase";

export async function getBreakpoints(messenger: MessengerBase): Promise<BreakpointInfo[]> {
  // --- Get breakpoint information
  const bpResponse = await createEmuApi(messenger).listBreakpoints();
  return bpResponse?.breakpoints ?? [];
}

export async function addBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  // --- Forward the whole breakpoint. This used to rebuild it from `address`/`resource`/`line`
  // --- alone, silently dropping `partition`, `owner` and the kind flags — so anything but a plain
  // --- source breakpoint lost its identity on the way to the emulator.
  return await createEmuApi(messenger).setBreakpoint(bp);
}

export async function removeBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Forward the whole breakpoint, for the same reason as `addBreakpoint` — and one more:
  // --- removal looks the breakpoint up by `getBreakpointStorageKey`, which includes the partition.
  // --- Rebuilding it from `address`/`resource`/`line` produced a *different* key for any
  // --- partition-scoped breakpoint, so removing one silently did nothing.
  // ---
  // --- `exec` is still defaulted: it was hardcoded here, and `collectBpFlags` computes no flags at
  // --- all for a breakpoint with no kind, which would clear nothing.
  return await createEmuApi(messenger).removeBreakpoint({
    ...bp,
    exec: bp.exec ?? !(bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite)
  });
}
