import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { createEmuApi } from "@common/messaging/EmuApi";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { getBreakpoints } from "@renderer/appIde/utils/breakpoint-utils";
import { resolvedPartitionFor } from "./source-breakpoint-partition";
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

/**
 * A 16K bank in a key, as plain two-digit hex.
 *
 * Never through `getPartitionLabels()`: a NEX bank is 16K and a Next partition is an 8K page, so the
 * label map describes a different quantity. Routing a bank through it is how the two index spaces
 * got confused in the first place (§4.1, §4.7), and it is why the bank-relative and label-anchored
 * keys need no label map at all.
 */
function labelBankText(bank: number): string {
  return toHexa2(bank).toUpperCase();
}

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

  /*
   * A label-anchored breakpoint is named by its label, and named **first**.
   *
   * Its identity is the label, not wherever resolution has put it: keying it by the resolved bank
   * site would change its key every time a rebuild moved the code, which is the one thing this
   * shape exists not to do. So this branch comes before the address and bank branches, and reads
   * only the *stated* fields — never `resolvedBank`/`resolvedBankOffset`.
   *
   * File-qualified, like a source breakpoint's, because `05:DrawSprite` means different offsets in
   * different sidecars (§4.4). The bank is present for a bank's **local** label and absent for a
   * **global** one, whose value is a 16-bit address.
   */
  if (bp.label && bp.labelFile) {
    const bankPart = bp.bank === undefined ? "" : `${labelBankText(bp.bank)}:`;
    return `[${bp.labelFile}]:${bankPart}${bp.label}${suffix}`;
  }

  if (bp.address !== undefined) {
    // --- Breakpoint defined with address
    if (bp.partition === undefined) {
      return `$${toHexa4(bp.address)}${suffix}`;
    }
    return `${partitionText(bp.partition)}:$${toHexa4(bp.address)}${suffix}`;
  } else if (bp.bank !== undefined && bp.bankOffset !== undefined) {
    // --- Stated fields only, for the same reason the label branch above uses them: a resolved site
    // --- must not become part of the key.
    // --- Bank-relative: an offset inside a ZX Spectrum Next 16K bank, wherever that bank is paged.
    //
    // --- The `+` is what separates this from the absolute `<partition>:<address>` form, and it is
    // --- safe because no address literal can begin with one (`$`, a digit, or `%`).
    //
    // --- The bank is rendered as a plain 2-digit hex number rather than through the partition label
    // --- map, because it is a **16K bank**, not a partition index — the map describes 8K pages.
    // --- Routing it through the labels is how the two index spaces got confused before.
    return `${labelBankText(bp.bank)}:+$${toHexa4(bp.bankOffset)}${suffix}`;
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

/**
 * The `<address-spec>` part of a breakpoint's display key — the half a `bp-*` command accepts.
 *
 * A third form, and the reason it has to exist: the display key ends in `:R`/`:W`/`:IR`/`:IW` for a
 * watchpoint, while the commands take the kind as an *option* (`-r`, `-w`, `-i`, `-o`) and would
 * not parse that suffix as part of an address. Anything that builds a command from a breakpoint
 * therefore needs the spec, not the key.
 *
 * The disassembly gutter is the case that found this. It passes the display key for the shapes that
 * have no plain address — source-bound and bank-relative — and `BreakpointIndicator` builds
 * `bp-set` / `bp-del` / `bp-en` from whatever it is handed, so a memory-write breakpoint on a NEX
 * bank produced `bp-del 05:+$0100:W -w`: unparseable, nothing removed, and a dot the user could not
 * click away.
 *
 * @param bp The breakpoint to name
 * @param partitionLabels The machine's `getPartitionLabels()` map, as for the display key
 */
export function getBreakpointAddressSpec(
  bp: BreakpointInfo,
  partitionLabels: Record<number, string>
): string {
  // --- Built from a copy with the kind flags cleared, rather than by trimming the suffix off the
  // --- finished key: a `:W` is also just two characters, and a future address notation that ended
  // --- in one would make string surgery silently wrong.
  return buildBreakpointKey(
    {
      ...bp,
      memoryRead: undefined,
      memoryWrite: undefined,
      ioRead: undefined,
      ioWrite: undefined
    },
    (partition) => partitionLabels?.[partition] ?? "?"
  );
}

/*
 * The ownership/scope helpers live in `breakpoint-scope.ts`, which imports nothing but the
 * `BreakpointInfo` types. This module cannot host them: it reaches into `@renderer/...` for
 * `toHexa4` and `getBreakpoints`, and the main process needs the scope helpers when it filters a
 * project save. Re-exported here so renderer callers can keep importing from one place.
 */
export {
  breakpointMatchesScope,
  ownerForScope,
  withScopeOwner
} from "./breakpoint-scope";

// --- Sends all resolved source code breakpoints to the emulator
export async function refreshSourceCodeBreakpoints(
  store: Store<AppState>,
  messenger: MessengerBase
): Promise<void> {
  const compilation = store.getState().compilation!;
  // --- The partition convention differs by machine: an 8K page on the Next, a 16K bank elsewhere.
  const machineId = store.getState().emulatorState?.machineId;
  const emuApi = createEmuApi(messenger);
  const resolvedBp: ResolvedBreakpoint[] = [];
  // --- Warnings are listed with the errors but do not fail the compilation
  if (compilation.result && !compilation.failed && !compilation.result.errors?.some((e) => !e.isWarning)) {
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
          /*
           * The segment the line was assembled into, which is what says whether it is banked.
           *
           * `segmentIndex` has always been on the list-file item and `bank`/`bankOffset` have
           * always been on the segment; nothing joined them, so the partition was thrown away and
           * the breakpoint fired in whichever `.bank` section happened to be paged.
           */
          const segment =
            lineInfo.segmentIndex === undefined
              ? undefined
              : compilation.result.segments?.[lineInfo.segmentIndex];
          resolvedBp.push({
            resource: bp.resource,
            line: bp.line!,
            address: lineInfo.address,
            partition: resolvedPartitionFor(segment, lineInfo.address, machineId)
          });
        }
      }
    }
    // --- Read-modify-write of the whole set, so owners survive; scoped for intent, and so that a
    // --- source-breakpoint refresh cannot clear a sidecar's or a session's breakpoints.
    await emuApi.resetBreakpointsTo(bps, { kind: "project" });
  }

  await emuApi.resolveBreakpoints(resolvedBp);
}
