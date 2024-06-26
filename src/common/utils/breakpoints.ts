import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { getBreakpoints } from "@renderer/appIde/utils/breakpoint-utils";
import { reportMessagingError } from "@renderer/reportError";

export function getBreakpointKey (bp: BreakpointInfo): string {
  // --- Collect memory/IO breakpoint suffix
  let suffix = "";
  if (bp.memoryRead) {
    suffix = ":MR";
  } else if (bp.memoryWrite) {
    suffix = ":MW";
  } else if (bp.ioRead) {
    suffix = ":IOR";
  } else if (bp.ioWrite) {
    suffix = ":IOW";
  }
  if (bp.address !== undefined) {
    // --- Breakpoint defined with address
    if (bp.partition === undefined) {
      return `$${bp.address.toString(16).padStart(4, "0")}${suffix}`;
    }
    return bp.partition < 0
      ? `R${(-(bp.partition + 1)).toString(16)}:$${bp.address
          .toString(16)
          .padStart(4, "0")}${suffix}`
      : `${bp.partition.toString(16)}:$${bp.address.toString(16)}${suffix}`;
  } else if (bp.resource && bp.line !== undefined) {
    return `[${bp.resource}]:${bp.line}`;
  }
  throw new Error("Breakpoint info does not have key information.");
}

// --- Sends all resolved source code breakpoints to the emulator
export async function refreshSourceCodeBreakpoints (
  store: Store<AppState>,
  messenger: MessengerBase
): Promise<void> {
  const compilation = store.getState().compilation!;
  const resolvedBp: ResolvedBreakpoint[] = [];
  if (
    compilation.result &&
    !compilation.failed &&
    compilation.result.errors?.length === 0
  ) {
    if (!isDebuggableCompilerOutput(compilation.result)) {
      return;
    }

    // --- There can be source code breakpoints
    const bps = await getBreakpoints(messenger);
    for (const bp of bps) {
      if (!bp.resource) continue;
      const fileIndex = compilation.result.sourceFileList.findIndex(fi =>
        fi.filename.endsWith(bp.resource!)
      );
      if (fileIndex >= 0) {
        const lineInfo = compilation.result.listFileItems.find(
          li => li.fileIndex === fileIndex && li.lineNumber === bp.line
        );
        if (lineInfo) {
          resolvedBp.push({
            resource: bp.resource,
            line: bp.line!,
            address: lineInfo.address
          });
        }
      }
    }
  }
  const response = await messenger.sendMessage({
    type: "EmuResolveBreakpoints",
    breakpoints: resolvedBp
  });
  if (response.type === "ErrorResponse") {
    reportMessagingError(
      `EmuResolveBreakpoint call failed: ${response.message}`
    );
  }
}
