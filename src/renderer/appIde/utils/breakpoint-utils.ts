import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { createEmulatorApi } from "@common/messaging/EmuApi";
import { MessengerBase } from "@common/messaging/MessengerBase";

export async function getBreakpoints(messenger: MessengerBase): Promise<BreakpointInfo[]> {
  // --- Get breakpoint information
  const bpResponse = await createEmulatorApi(messenger).listBreakpoints();
  return bpResponse.breakpoints;
}

export async function addBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  const response = await createEmulatorApi(messenger).setBreakpoint({
    address: bp.address,
    resource: bp.resource,
    line: bp.line
  });
  return response.flag;
}

export async function removeBreakpoint(
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  const response = await createEmulatorApi(messenger).removeBreakpoint({
    address: bp.address,
    resource: bp.resource,
    line: bp.line,
    exec: true
  });
  return response.flag;
}
