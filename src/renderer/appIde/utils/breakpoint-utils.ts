import {
  BreakpointAddressInfo,
  BreakpointInfo
} from "@abstractions/BreakpointInfo";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { MessageBase } from "@common/messaging/messages-core";
import { Store } from "@common/state/redux-light";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import {
  reportMessagingError,
  reportUnexpectedMessageType
} from "@renderer/reportError";

export async function getBreakpoints (
  messenger: MessengerBase
): Promise<BreakpointInfo[]> {
  // --- Get breakpoint information
  const bpResponse = await messenger.sendMessage({
    type: "EmuListBreakpoints"
  });
  if (bpResponse.type === "ErrorResponse") {
    reportMessagingError(
      `EmuListBreakpoints call failed: ${bpResponse.message}`
    );
  } else if (bpResponse.type !== "EmuListBreakpointsResponse") {
    reportUnexpectedMessageType(bpResponse.type);
  } else {
    return bpResponse.breakpoints;
  }
  return [];
}

export async function addBreakpoint (
  messenger: MessengerBase,
  bp: BreakpointInfo
): Promise<boolean> {
  // --- Get breakpoint information
  const response = await messenger.sendMessage({
    type: "EmuSetBreakpoint",
    address: bp.address,
    resource: bp.resource,
    line: bp.line
  });
  if (response.type === "ErrorResponse") {
    reportMessagingError(`EmuSetBreakpoint call failed: ${response.message}`);
  } else if (response.type !== "FlagResponse") {
    reportUnexpectedMessageType(response.type);
  } else {
    return response.flag;
  }
  return false;
}

export async function removeBreakpoint (
  messenger: MessengerBase,
  bp: BreakpointAddressInfo
): Promise<boolean> {
  // --- Get breakpoint information
  const response = await messenger.sendMessage({
    type: "EmuRemoveBreakpoint",
    address: bp.address,
    resource: bp.resource,
    line: bp.line
  });
  if (response.type === "ErrorResponse") {
    reportMessagingError(
      `EmuRemoveBreakpoint call failed: ${response.message}`
    );
  } else if (response.type !== "FlagResponse") {
    reportUnexpectedMessageType(response.type);
  } else {
    return response.flag;
  }
  return false;
}