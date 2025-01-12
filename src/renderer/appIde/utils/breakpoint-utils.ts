import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { createEmuApi } from "@common/messaging/EmuApi";
import { MessengerBase } from "@common/messaging/MessengerBase";

export async function getBreakpoints(messenger: MessengerBase): Promise<BreakpointInfo[]> {
  // --- Get breakpoint information
  const bpResponse = await createEmuApi(messenger).listBreakpoints();
  return bpResponse.breakpoints;
}

export async function addBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  return await createEmuApi(messenger).setBreakpoint({
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
  return await createEmuApi(messenger).removeBreakpoint({
    address: bp.address,
    resource: bp.resource,
    line: bp.line,
    exec: true
  });
}
