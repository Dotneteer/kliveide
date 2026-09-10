import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { BreakpointEnvironment } from "@renderer/appIde/utils/breakpoint-form";

import { useCallback } from "react";
import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { derivePartitionSetup } from "@renderer/features/memory/memoryViewModel";
import { applyBreakpointEdit } from "@renderer/appIde/utils/breakpoint-actions";
import { BreakpointDialog } from "./BreakpointDialog";

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
      const [partitionLabels, partitionDescriptions, partitionGroups, bpState] = await Promise.all([
        emuApi.getPartitionLabels(),
        emuApi.getPartitionDescriptions(),
        emuApi.getPartitionGroups(),
        emuApi.listBreakpoints()
      ]);

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
        existingKeys: (bpState?.breakpoints ?? []).map((bp) =>
          getBreakpointDisplayKey(bp, partitionLabels)
        ),
        // --- A breakpoint must be allowed to keep its own key while being edited.
        editingKey: initial ? getBreakpointDisplayKey(initial, partitionLabels) : undefined
      };

      const result = await dialogs.open(
        BreakpointDialog,
        { initial, env, machineSetup, machineId },
        { title: initial ? "Edit breakpoint" : "Add breakpoint", width: 420 }
      );
      // --- A dismissed dialog resolves undefined, which is a cancellation, not an empty edit.
      if (!result) return false;

      await applyBreakpointEdit(emuApi, result);
      return true;
    },
    [emuApi, dialogs, machineId]
  );
}
