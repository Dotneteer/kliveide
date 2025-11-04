import type { BreakpointInfo } from "../../emu/abstractions/BreakpointInfo";
import { createEmuApi } from "../messaging/EmuApi";
import { MessengerBase } from "../messaging/MessengerBase";
import { AppState } from "../state/AppState";
import { Store } from "../state/redux-light";
import { ResolvedBreakpoint } from "../../emu/abstractions/ResolvedBreakpoint";
import { getBreakpoints } from "./breakpoint-utils";
import { isDebuggableCompilerOutput } from "./compiler-utils";
import { toHexa4 } from "./conversions";

export function getBreakpointKey(
  bp: BreakpointInfo,
  partitionMap?: Record<number, string>
): string {
  // --- Collect memory/IO breakpoint suffix
  let suffix = "";
  if (bp.memoryRead) {
    suffix = ":R";
  } else if (bp.memoryWrite) {
    suffix = ":W";
  } else if (bp.ioRead) {
    suffix = ":IR";
  } else if (bp.ioWrite) {
    suffix = ":IW";
  }
  if (bp.address !== undefined) {
    // --- Breakpoint defined with address
    if (bp.partition === undefined) {
      return `$${toHexa4(bp.address)}${suffix}`;
    }
    return partitionMap
      ? `${partitionMap[bp.partition] ?? "?"}:$${toHexa4(bp.address)}${suffix}`
      : `${bp.partition.toString(16)}:$${toHexa4(bp.address)}${suffix}`;
  } else if (bp.resource && bp.line !== undefined) {
    return `[${bp.resource}]:${bp.line}`;
  }
  throw new Error("Breakpoint info does not have key information.");
}

// --- Sends all resolved source code breakpoints to the emulator
export async function refreshSourceCodeBreakpoints(
  store: Store<AppState>,
  messenger: MessengerBase
): Promise<void> {
  const compilation = store.getState().compilation!;
  const emuApi = createEmuApi(messenger);
  const resolvedBp: ResolvedBreakpoint[] = [];
  if (compilation.result && !compilation.failed && compilation.result.errors?.length === 0) {
    if (!isDebuggableCompilerOutput(compilation.result)) {
      return;
    }

    // --- There can be source code breakpoints
    const bps = await getBreakpoints(messenger);
    for (const bp of bps) {
      if (!bp.resource) continue;
      delete bp.resolvedAddress;
      const fileIndex = compilation.result.sourceFileList.findIndex((fi) =>
        fi.filename.endsWith(bp.resource!)
      );
      if (fileIndex >= 0) {
        const lineInfo = compilation.result.listFileItems.find(
          (li) => li.fileIndex === fileIndex && li.lineNumber === bp.line // && !li.isMacroInvocation
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
    await emuApi.resetBreakpointsTo(bps);
  }

  await emuApi.resolveBreakpoints(resolvedBp);
}
