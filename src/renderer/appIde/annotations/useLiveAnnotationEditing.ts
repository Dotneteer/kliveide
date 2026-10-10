import { useCallback, useMemo, useRef } from "react";

import type { BankSpace } from "@common/annotations/bankSpace";
import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import type { LiveMemorySnapshot } from "@renderer/appIde/DocumentPanels/useDisassemblyRefresh";
import type { NexAnnotationMenuAction } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useAnnotationEditorPorts } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/useNexAnnotationEditor";
import {
  annotationActionForKey,
  annotationShortcutHints
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorViewModel";
import {
  annotationRowMenuItems,
  type AnnotationRowMenuItem
} from "@renderer/appIde/DocumentPanels/disassemblyRowMenu";

import { useActiveAnnotationSet } from "./activeAnnotationSet";
import { runLiveAnnotationAction } from "./liveAnnotationEditing";
import { liveRowTarget, rowsOfTarget, type LiveRowTarget, type LiveRowTargetContext } from "./liveListingPort";
import { ANNOTATION_BANK_SIZE, decodedRegionTypesFor } from "./programAnnotations";
import { getRomPartition } from "./romAnnotations";

/** The region entries a row menu offers on a machine. */
function regionActionsFor(space: BankSpace | undefined): { id: NexAnnotationMenuAction; text: string }[] {
  const actions: { id: NexAnnotationMenuAction; text: string }[] = [
    { id: "mark-disassembly", text: "Mark As Code" },
    { id: "mark-bytes", text: "Mark As Bytes" },
    { id: "mark-words", text: "Mark As Words" }
  ];
  if (space && decodedRegionTypesFor(space.id).includes("text")) {
    actions.push({ id: "mark-text", text: "Mark As Text" });
  }
  actions.push({ id: "mark-skip", text: "Mark As Skip" });
  return actions;
}

/**
 * Editing annotations from the live Disassembly view
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5): the row menu's annotation entries, their
 * shortcuts, and running one through the bank document's controller.
 */
export function useLiveAnnotationEditing(args: {
  items: DisassemblyItem[];
  memorySnapshot?: LiveMemorySnapshot;
  bankSpace?: BankSpace;
  decimalView: boolean;
  navigateToAddress: (address: number) => void;
}) {
  const { projectService } = useAppServices();
  const activeSet = useActiveAnnotationSet();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineRunning =
    machineState === MachineControllerState.Running || machineState === MachineControllerState.Paused;

  const argsRef = useRef(args);
  argsRef.current = args;
  // --- The target an open dialog previews the bytes of
  const targetRef = useRef<LiveRowTarget | undefined>(undefined);

  const contextOf = useCallback(
    (): LiveRowTargetContext => ({
      bankSpace: argsRef.current.bankSpace,
      slots: argsRef.current.memorySnapshot?.slots,
      activeSet,
      romPartition: getRomPartition
    }),
    [activeSet]
  );

  /** The target's bank as far as the listing read it: its bytes at their own offsets. */
  const bankImage = useCallback((): Uint8Array => {
    const image = new Uint8Array(ANNOTATION_BANK_SIZE);
    const target = targetRef.current;
    const snapshot = argsRef.current.memorySnapshot;
    if (!target || !snapshot) return image;
    const context = contextOf();
    for (let offset = 0; offset < ANNOTATION_BANK_SIZE; offset++) {
      const address = (target.disassOffset + offset) & 0xffff;
      const index = address - snapshot.memoryBase;
      if (index < 0 || index >= snapshot.memory.length) continue;
      const other = liveRowTarget(address, context);
      if ("annotationPath" in other && other.bank === target.bank && other.offset === offset) {
        image[offset] = snapshot.memory[index];
      }
    }
    return image;
  }, [contextOf]);

  const ports = useAnnotationEditorPorts({
    contents: bankImage,
    onNavigateToAddress: (address) => argsRef.current.navigateToAddress(address),
    onRevealAddressInBank: async (address) => argsRef.current.navigateToAddress(address),
    onUnwrittenChanged: () => {
      // --- A failed write shows in the session; the live view has no document tab to mark
    }
  });

  const hints = useMemo(() => annotationShortcutHints(), []);

  const menuItemsFor = useCallback(
    (item: DisassemblyItem | undefined): AnnotationRowMenuItem[] => {
      if (!item || !argsRef.current.bankSpace) return [];
      const target = liveRowTarget(item.address, contextOf());
      const disabledReason = "disabledReason" in target ? target.disabledReason : undefined;
      return annotationRowMenuItems({
        disabledReason,
        destination: "destination" in target ? target.destination : undefined,
        rom: "kind" in target && target.kind === "rom",
        hasOperands: !!item.operandCandidates?.length,
        hasDefinition: !!item.operandCandidates?.some((operand) => operand.resolvedText),
        hints,
        regionActions: regionActionsFor(argsRef.current.bankSpace)
      });
    },
    [contextOf, hints]
  );

  const run = useCallback(
    async (item: DisassemblyItem, action: NexAnnotationMenuAction): Promise<void> => {
      const context = contextOf();
      const target = liveRowTarget(item.address, context);
      if (!("annotationPath" in target)) return;
      targetRef.current = target;
      try {
        await runLiveAnnotationAction({
          ports,
          target,
          rows: rowsOfTarget(argsRef.current.items, target, context),
          row: item,
          action,
          decimalView: argsRef.current.decimalView,
          machineRunning,
          projectService
        });
      } finally {
        targetRef.current = undefined;
      }
    },
    [contextOf, machineRunning, ports, projectService]
  );

  /** The action a key stands for on a row, when its menu entry is enabled there. */
  const actionForKey = useCallback(
    (item: DisassemblyItem | undefined, key: string, shift: boolean, ctrl: boolean) => {
      const action = annotationActionForKey(key, shift, ctrl);
      if (!action || !item) return undefined;
      const entry = menuItemsFor(item).find((candidate) =>
        candidate.id === action || (action === "global-label" && candidate.id === "local-label")
      );
      return entry && !entry.disabled ? entry.id : undefined;
    },
    [menuItemsFor]
  );

  return { menuItemsFor, run, actionForKey };
}
