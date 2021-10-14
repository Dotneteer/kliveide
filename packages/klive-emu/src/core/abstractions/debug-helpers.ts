import {
  BinaryBreakpoint,
  BreakpointDefinition,
  SourceCodeBreakpoint,
} from "@abstractions/code-runner-service";

/**
 * Adds a new breakpoint to the array of existing breakpoints
 * @param breakpoints Breakpoints array
 * @param bp Breakpoint to add
 * @returns A shallow clone of the breakpoints array after the operation
 */
export function addBreakpoint(
  breakpoints: BreakpointDefinition[],
  bp: BreakpointDefinition
): BreakpointDefinition[] {
  if (bp.type == "source") {
    if (
      breakpoints.findIndex(
        (p) =>
          (p as SourceCodeBreakpoint).line === bp.line &&
          (p as SourceCodeBreakpoint).resource === bp.resource
      ) < 0
    ) {
      breakpoints.push(bp);
    }
  } else {
    if (
      breakpoints.findIndex(
        (p) =>
          (p as BinaryBreakpoint).location === bp.location &&
          (p as BinaryBreakpoint).partition === bp.partition
      ) < 0
    ) {
      breakpoints.push(bp);
    }
  }
  return breakpoints.slice(0);
}

/**
 * Removes a breakpoint from the array of existing breakpoints
 * @param breakpoints Breakpoints array
 * @param bp Breakpoint to remove
 * @returns A shallow clone of the breakpoints array after the operation
 */
export function removeBreakpoint(
  breakpoints: BreakpointDefinition[],
  bp: BreakpointDefinition
): BreakpointDefinition[] {
  let index = -1;
  if (bp.type === "source") {
    index = breakpoints.findIndex(
      (p) =>
        (p as SourceCodeBreakpoint).line === bp.line &&
        (p as SourceCodeBreakpoint).resource === bp.resource
    );
  } else {
    index = breakpoints.findIndex(
      (p) =>
        (p as BinaryBreakpoint).location === bp.location &&
        (p as BinaryBreakpoint).partition === bp.partition
    );
  }
  if (index >= 0) {
    breakpoints.splice(index, 1);
  }
  return breakpoints.slice(0);
}

/**
 * Comparison function for breakpoint definitions
 * @param a First breakpoint
 * @param b Second breakpoint
 * @returns Comparison value
 */
export function compareBreakpoints(
  a: BreakpointDefinition,
  b: BreakpointDefinition
): number {
  if (a.type === "binary" && b.type === "source") {
    return 1;
  }
  if (a.type === "binary" && b.type === "binary") {
    return a.location - b.location;
  }
  if (a.type === "source" && b.type === "binary") {
    return -1;
  }
  if (a.type === "source" && b.type === "source") {
    return a.resource > b.resource
      ? 1
      : a.resource < b.resource
      ? -1
      : a.line - b.line;
  }
}
