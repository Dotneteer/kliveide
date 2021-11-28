import {
  BinaryBreakpoint,
  BreakpointDefinition,
  SourceCodeBreakpoint,
} from "@abstractions/code-runner-service";
import { dispatch, getState } from "@core/service-registry";
import { setResolvedBreakpointsAction } from "@core/state/debugger-reducer";
import { isDebuggableCompilerOutput } from "./compiler-registry";

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
 * Enables the specified breakpoint
 * @param breakpoints Breakpoints array
 * @param bp Breakpoint to enable
 * @returns A shallow clone of the breakpoints array after the operation
 */
export function makeReachableBreakpoint(
  breakpoints: BreakpointDefinition[],
  bp: BreakpointDefinition
): BreakpointDefinition[] {
  const def = findBreakpoint(breakpoints, bp);
  if (def && def.type === "source") {
    delete def.unreachable;
  }
  return breakpoints.slice(0);
}

/**
 * Removes all source-related breakpoints
 * @param breakpoints Breakpoints array
 * @returns A shallow clone of the remaining binary breakpoints
 */
export function removeSourceBreakpoints(
  breakpoints: BreakpointDefinition[]
): BreakpointDefinition[] {
  return breakpoints.filter((bp) => bp.type === "binary");
}

/**
 * Enables all breakpoints
 * @param breakpoints Breakpoints array
 * @param bp Breakpoint to enable
 * @returns A shallow clone of the breakpoints array after the operation
 */
export function makeReachableAllBreakpoints(
  breakpoints: BreakpointDefinition[]
): BreakpointDefinition[] {
  breakpoints.forEach((bp) => {
    if (bp.type === "source") {
      delete bp.unreachable;
    }
  });
  return breakpoints.slice(0);
}

/**
 * Disables the specified breakpoint
 * @param breakpoints Breakpoints array
 * @param bp Breakpoint to disable
 * @returns A shallow clone of the breakpoints array after the operation
 */
export function disableBreakpoint(
  breakpoints: BreakpointDefinition[],
  bp: BreakpointDefinition
): BreakpointDefinition[] {
  const def = findBreakpoint(breakpoints, bp);
  if (def && def.type === "source") {
    def.unreachable = true;
  }
  return breakpoints.slice(0);
}

/**
 * Removes a breakpoint from the array of existing breakpoints
 * @param breakpoints Breakpoints array
 * @param bp Breakpoint to remove
 * @returns A shallow clone of the breakpoints array after the operation
 */
export function findBreakpoint(
  breakpoints: BreakpointDefinition[],
  bp: BreakpointDefinition
): BreakpointDefinition | undefined {
  let def: BreakpointDefinition | null = null;
  if (bp.type === "source") {
    def = breakpoints.find(
      (p) =>
        (p as SourceCodeBreakpoint).line === bp.line &&
        (p as SourceCodeBreakpoint).resource === bp.resource
    );
  } else {
    def = breakpoints.find(
      (p) =>
        (p as BinaryBreakpoint).location === bp.location &&
        (p as BinaryBreakpoint).partition === bp.partition
    );
  }
  return def;
}

/**
 * Scrolls down breakpoints
 * @param breakpoints Array of breakpoints
 * @param resource Breakpoint file
 * @param lineNo Line number
 */
export function scrollBreakpoints(
  breakpoints: BreakpointDefinition[],
  def: BreakpointDefinition,
  shift: number
): BreakpointDefinition[] {
  const result: BreakpointDefinition[] = [];
  breakpoints.forEach((bp) => {
    if (
      bp.type === "source" &&
      def.type === "source" &&
      bp.resource === def.resource &&
      bp.line >= def.line
    ) {
      result.push({
        type: "source",
        resource: bp.resource,
        line: bp.line + shift,
      });
    } else {
      result.push(bp);
    }
  });
  return result;
}

/**
 * Normalizes source code breakpoint. Removes the ones that overflow the
 * file and also deletes duplicates.
 * @param breakpoints
 * @param lineCount
 * @returns
 */
export function normalizeBreakpoints(
  breakpoints: BreakpointDefinition[],
  resource: string,
  lineCount: number
): BreakpointDefinition[] {
  const mapped = new Map<string, boolean>();
  const result: BreakpointDefinition[] = [];
  breakpoints.forEach((bp) => {
    if (bp.type === "binary") {
      result.push(bp);
    } else if (
      bp.resource === resource &&
      bp.line <= lineCount &&
      !mapped.has(`${resource}|${bp.line}`)
    ) {
      result.push({
        type: "source",
        resource: bp.resource,
        line: bp.line,
      });
      mapped.set(`${resource}|${bp.line}`, true);
    }
  });
  return result;
}

/**
 * Resolves source code breakpoints
 */
export function resolveBreakpoints(): BreakpointDefinition[] {
  const state = getState();
  const breakpoints = state?.debugger?.breakpoints ?? [];
  const resolved: BreakpointDefinition[] = [];

  // --- Get the active compilation result
  const compilationResult = state?.compilation?.result;

  if (
    compilationResult &&
    compilationResult.errors.length === 0 &&
    isDebuggableCompilerOutput(compilationResult)
  ) {
    breakpoints.forEach((bp) => {
      // --- Nothing to do with binary breakpoints
      if (bp.type !== "source") return;

      // --- In case of a successful compilation, test if the breakpoint is allowed
      const fileIndex = compilationResult.sourceFileList.findIndex((fi) =>
        fi.filename.endsWith(bp.resource)
      );
      if (fileIndex >= 0) {
        // --- We have address information for this source code file
        const bpInfo = compilationResult.listFileItems.find(
          (li) => li.fileIndex === fileIndex && li.lineNumber === bp.line
        );
        if (bpInfo) {
          bp.location = bpInfo.address;
          resolved.push({ ...bp });
        } else {
          bp.unreachable = true;
        }
      }
    });
  }
  dispatch(setResolvedBreakpointsAction(resolved));
  return breakpoints.sort(compareBreakpoints);
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
