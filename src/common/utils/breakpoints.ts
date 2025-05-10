import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { createEmuApi } from "@common/messaging/EmuApi";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { isDebuggableCompilerOutput } from "@main/compiler-integration/compiler-registry";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { getBreakpoints } from "@renderer/appIde/utils/breakpoint-utils";

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
