import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { BreakpointEnvironment } from "@renderer/appIde/utils/breakpoint-form";

import { useCallback } from "react";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { derivePartitionSetup } from "@renderer/features/memory/memoryViewModel";
import { applyBreakpointEdit } from "@renderer/appIde/utils/breakpoint-actions";
import { BreakpointDialog } from "./BreakpointDialog";
import { setIdeStatusMessageAction } from "@state/actions";
import { MI_ZXNEXT } from "@common/machines/constants";

/**
 * Opens the breakpoint dialog and installs whatever it returns.
 *
 * Shared by the Breakpoints panel and the disassembly view so the two cannot drift: one place
 * builds the dialog's environment, and one place decides what an edit does to the emulator.
 *
 * The environment is read **when the dialog opens**, not from whatever the caller happens to be
 * holding. A panel's own copy of the breakpoint list is a render or two old, and the duplicate-key
 * check is only as good as the list it is checked against.
 *
 * The partition chooser comes from `derivePartitionSetup`, the same derivation behind the Memory
 * view's bank selector, so the two cannot decide differently whether a machine has banks or offer
 * different pickers for the same one. It is called here rather than read from
 * `useMemoryMachineSetup` because that hook resolves asynchronously: opening the dialog in the
 * moment before it settled would have shown no partition row on a machine that has banks.
 */
export function useBreakpointDialog() {
  const emuApi = useEmuApi();
  const dispatch = useDispatch();
  const dialogs = useDialogs();
  const machineId = useSelector((s) => s.emulatorState?.machineId);

  return useCallback(
    /**
     * @param initial The breakpoint to edit. Omit to add a new one. Must be address-bound —
     *   `isBinaryBreakpoint` is the caller's gate, because a source-bound breakpoint belongs to the
     *   editor's glyph margin.
     * @returns Whether anything was installed; false when the dialog was cancelled.
     */
    async (initial?: BreakpointInfo): Promise<boolean> => {
      /*
       * Four IPC calls with a failure path.
       *
       * `Promise.all` rejects as soon as any one of these does — the emulator not running, a
       * machine mid-switch — and nothing caught it, so the rejection escaped this callback
       * unhandled and the dialog simply never opened. No error, no dialog, nothing to click: the
       * command appeared to have been ignored. This is defect class #6 that
       * `DIALOG_MVC_REFACTOR_PLAN.md` records as fixed for `NewProject` and `ExcludedItems`, still
       * live here.
       *
       * Reporting through the status bar rather than a second dialog: the user asked for a dialog
       * and did not get one, and stacking an error dialog on that is more ceremony than the failure
       * deserves.
       */
      let partitionLabels: Awaited<ReturnType<typeof emuApi.getPartitionLabels>>;
      let partitionDescriptions: Awaited<ReturnType<typeof emuApi.getPartitionDescriptions>>;
      let partitionGroups: Awaited<ReturnType<typeof emuApi.getPartitionGroups>>;
      let bpState: Awaited<ReturnType<typeof emuApi.listBreakpoints>>;
      try {
        [partitionLabels, partitionDescriptions, partitionGroups, bpState] = await Promise.all([
          emuApi.getPartitionLabels(),
          emuApi.getPartitionDescriptions(),
          emuApi.getPartitionGroups(),
          emuApi.listBreakpoints()
        ]);
      } catch (err) {
        dispatch(
          setIdeStatusMessageAction(
            `Cannot open the breakpoint dialog: ${(err as Error)?.message ?? "the emulator did not respond"}`,
            true
          )
        );
        return false;
      }

      const machineSetup = derivePartitionSetup(
        machineId,
        partitionLabels,
        partitionDescriptions,
        partitionGroups
      );

      const env: BreakpointEnvironment = {
        partitionLabels,
        // --- `banksView` is exactly "this machine declares MF_ROM or MF_BANK".
        supportsPartitions: machineSetup.banksView,
        // --- Next-only, matching `bp-set`'s own guard on the grammar.
        supportsBankRelative: machineId === MI_ZXNEXT,
        existingKeys: (bpState?.breakpoints ?? []).map((bp) =>
          getBreakpointDisplayKey(bp, partitionLabels)
        ),
        // --- A breakpoint must be allowed to keep its own key while being edited.
        editingKey: initial ? getBreakpointDisplayKey(initial, partitionLabels) : undefined
      };

      const result = await dialogs.open(
        BreakpointDialog,
        // --- No `machineId`: `BreakpointDialog` declares no such prop, so it was reaching the
        // --- component and being dropped. It survived only because `dialogs.open`'s generics
        // --- infer the props from the object rather than checking it against the component.
        { initial, env, machineSetup },
        { title: initial ? "Edit breakpoint" : "Add breakpoint", width: 420, iconName: "debug-with-bp" }
      );
      // --- A dismissed dialog resolves undefined, which is a cancellation, not an empty edit.
      if (!result) return false;

      await applyBreakpointEdit(emuApi, result);
      return true;
    },
    [emuApi, dialogs, machineId]
  );
}
