import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { createEmuApi } from "@common/messaging/EmuApi";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { getBreakpoints } from "@renderer/appIde/utils/breakpoint-utils";
import { isDebuggableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";

/**
 * A breakpoint's key, in two forms.
 *
 * A breakpoint has no id — its identity *is* its key, derived from address, partition and type. But
 * the two things that key is used for want different strings, and conflating them is what let
 * `bp-list` print breakpoints in a notation its own sibling commands would not accept back:
 *
 *   - **Storage.** `DebugSupport` keys its `breakpointDefs` map by this, and the renderer compares
 *     breakpoints by it. It must be stable, so it names a partition by its *index* — a machine's
 *     labels can change with its configuration, and a stored key that moved with them would lose
 *     track of the breakpoint it names.
 *   - **Display.** What a user reads and types back. It names a partition by its *label*, which is
 *     what `bp-set` accepts.
 *
 * The label map is therefore a required parameter of the display form: forgetting it is now a
 * compile error rather than a silent fall back to the other notation.
 *
 * See `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §8, decision 4.
 */

/** The `:R`/`:W`/`:IR`/`:IW` suffix that distinguishes a watchpoint from an execution breakpoint. */
function breakpointKindSuffix(bp: BreakpointInfo): string {
  if (bp.memoryRead) return ":R";
  if (bp.memoryWrite) return ":W";
  if (bp.ioRead) return ":IR";
  if (bp.ioWrite) return ":IW";
  return "";
}

/**
 * @param bp The breakpoint to name
 * @param partitionText How to render a partition index, or `undefined` when there is no partition
 */
function buildBreakpointKey(
  bp: BreakpointInfo,
  partitionText: (partition: number) => string
): string {
  const suffix = breakpointKindSuffix(bp);
  if (bp.address !== undefined) {
    // --- Breakpoint defined with address
    if (bp.partition === undefined) {
      return `$${toHexa4(bp.address)}${suffix}`;
    }
    return `${partitionText(bp.partition)}:$${toHexa4(bp.address)}${suffix}`;
  } else if (bp.resource && bp.line !== undefined) {
    return `[${bp.resource}]:${bp.line}`;
  }
  throw new Error("Breakpoint info does not have key information.");
}

/**
 * The breakpoint's stable identity, for map keys and comparisons. **Never shown to a user** — it
 * names a partition by index (`-1:$8000`), which is not a notation any command accepts.
 */
export function getBreakpointStorageKey(bp: BreakpointInfo): string {
  return buildBreakpointKey(bp, (partition) => partition.toString(16));
}

/**
 * The breakpoint as a user reads and types it (`R0:$8000`).
 *
 * @param partitionLabels The machine's `getPartitionLabels()` map. Required: a display key built
 *   without it would silently come out in the storage notation, which is the bug this split exists
 *   to prevent.
 */
export function getBreakpointDisplayKey(
  bp: BreakpointInfo,
  partitionLabels: Record<number, string>
): string {
  return buildBreakpointKey(bp, (partition) => partitionLabels?.[partition] ?? "?");
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
