import { BreakpointAddressInfo, BreakpointInfo } from "@abstractions/BreakpointInfo";

export function getBreakpointKey (bp: BreakpointInfo | BreakpointAddressInfo): string {
  if (bp.address !== undefined) {
    // --- Breakpoint defined with address
    return bp.partition !== undefined
      ? `${bp.partition.toString(16)}:${bp.address
          .toString(16)
          .padStart(4, "0")}`
      : `${bp.address.toString(16).padStart(4, "0")}`;
  }
  if (bp.resource && bp.line !== undefined) {
    return `[${bp.resource}]:${bp.line}`;
  }
  throw new Error("Breakpoint info does not have key information.");
}
