import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { createEmuAltApi } from "@common/messaging/EmuApiAlt";
import { MessengerBase } from "@common/messaging/MessengerBase";

export async function getBreakpoints(messenger: MessengerBase): Promise<BreakpointInfo[]> {
  // --- Get breakpoint information
  const bpResponse = await createEmuAltApi(messenger).listBreakpoints();
  return bpResponse.breakpoints;
}

export async function addBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  return await createEmuAltApi(messenger).setBreakpoint({
    address: bp.address,
    resource: bp.resource,
    line: bp.line
  });
}

export async function removeBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  return await createEmuAltApi(messenger).removeBreakpoint({
    address: bp.address,
    resource: bp.resource,
    line: bp.line,
    exec: true
  });
}
