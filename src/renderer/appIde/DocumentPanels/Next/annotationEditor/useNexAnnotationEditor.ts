import { useMemo, useRef } from "react";

import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useConfirmPort } from "@mvc/dialogs/useDialogPorts";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

import { NexRegionDialog } from "../NexRegionDialog";
import { NexRegionsDialog } from "../NexRegionsDialog";
import { NexLabelDialog } from "../NexLabelDialog";
import { NexLabelsDialog } from "../NexLabelsDialog";
import { NexOperandLabelDialog } from "../NexOperandLabelDialog";
import { NexSynopsisCommentDialog } from "../NexSynopsisCommentDialog";
import { NexEndOfLineCommentDialog } from "../NexEndOfLineCommentDialog";
import {
  saveNexAnnotationSession,
  subscribeNexAnnotationSession,
  updateNexAnnotationSession
} from "../nexAnnotationSession";

import { NexAnnotationEditorController } from "./NexAnnotationEditorController";
import type { NexAnnotationEditorEnvironment } from "./NexAnnotationEditorModel";
import type { NexAnnotationEditorPorts } from "./NexAnnotationEditorPorts";
import type { NexAnnotationEditorViewModel } from "./NexAnnotationEditorViewModel";
import type { NexAnnotationEditorIntent } from "./NexAnnotationEditorIntents";

export type UseNexAnnotationEditorArgs = {
  env: NexAnnotationEditorEnvironment;
  /** The bank's bytes, which two of the dialogs render a preview from. */
  contents: Uint8Array;
  /** Scroll the listing to an address — "Go To" in either manage dialog. */
  onNavigateToAddress: (address: number) => void;
  /** Report the unsaved state outward, so the document tab can show it. */
  onDirtyChanged: (dirty: boolean) => void;
  /**
   * Any annotation dialog has finished, however it ended.
   *
   * The listing reaches every annotation action from a bare letter, and a bare letter is only heard
   * while the listing is focused — so the panel has to be able to take its keyboard surface back
   * when a dialog hands it over. Restoring focus is the modal's job and it does it; this is the
   * panel's own backstop, for the case where focus ends up nowhere in particular.
   */
  onDialogClosed?: () => void;
};

export type NexAnnotationEditor = {
  vm: NexAnnotationEditorViewModel;
  dispatch: (intent: NexAnnotationEditorIntent) => void;
  /** Whether the document may be closed; false keeps it open. */
  confirmDisposal: () => Promise<boolean>;
};

/**
 * Wiring only: the ports built from the renderer's services, and the controller over them.
 *
 * Every decision lives in the controller and the model, both of which run without React — so this
 * module is the *only* one that knows an annotation dialog is opened through `useDialogs()` or that
 * the session is reached through `projectService`.
 */
export function useNexAnnotationEditor({
  env,
  contents,
  onNavigateToAddress,
  onDirtyChanged,
  onDialogClosed
}: UseNexAnnotationEditorArgs): NexAnnotationEditor {
  const { projectService } = useAppServices();
  const dialogs = useDialogs();
  const confirm = useConfirmPort();

  // --- The controller holds its ports for its lifetime, so callbacks that the component recreates
  // --- on every render are read through refs. A captured one would go stale after the first render.
  // --- Trap 5 in `.ai/ui-mvc-guide.md`.
  const navigateRef = useRef(onNavigateToAddress);
  navigateRef.current = onNavigateToAddress;
  const dirtyRef = useRef(onDirtyChanged);
  dirtyRef.current = onDirtyChanged;
  const contentsRef = useRef(contents);
  contentsRef.current = contents;
  const dialogClosedRef = useRef(onDialogClosed);
  dialogClosedRef.current = onDialogClosed;

  const ports = useMemo<NexAnnotationEditorPorts>(
    () => {
      /*
       * Every dialog reports back when it is done, whatever the answer was.
       *
       * Wrapped once here rather than at each of the seven call sites, so a dialog added later
       * cannot quietly miss it. `finally` leaves the result and any rejection exactly as they were.
       */
      const opened = <T,>(dialog: Promise<T>): Promise<T> =>
        dialog.finally(() => dialogClosedRef.current?.());

      return {
      session: {
        subscribe: (annotationPath, bank, listener) =>
          subscribeNexAnnotationSession(projectService, annotationPath, bank, listener),
        update: (annotationPath, annotations) =>
          updateNexAnnotationSession(annotationPath, annotations),
        save: (annotationPath) => saveNexAnnotationSession(projectService, annotationPath)
      },
      dialogs: {
        synopsisComment: (args) =>
          opened(dialogs.open(NexSynopsisCommentDialog, args, {
            title: "Synopsis comment",
            width: 560
          })),
        endOfLineComment: (args) =>
          opened(dialogs.open(NexEndOfLineCommentDialog, args, {
            title: "End-of-line comment",
            width: 560
          })),
        label: (args) => opened(dialogs.open(NexLabelDialog, args, { title: "Label", width: 560 })),
        manageLabels: (args) =>
          opened(dialogs.open(NexLabelsDialog, args, { title: "Labels", width: 780 })),
        operandLabel: (args) =>
          opened(dialogs.open(NexOperandLabelDialog, args, { title: "Operand label", width: 640 })),
        region: (args) =>
          opened(dialogs.open(NexRegionDialog, args, { title: "Memory region", width: 640 })),
        manageRegions: (args) =>
          opened(dialogs.open(NexRegionsDialog, args, { title: "Regions", width: 840 }))
      },
      confirm,
      // --- Still `window.confirm`: two questions are asserted with their exact wording by the
      // --- existing suite, so routing them through the app's dialog would be a behaviour change
      // --- rather than a refactor. See the note on `nativeConfirm` in the ports.
      nativeConfirm: (message) => window.confirm(message),
      bankBytes: () => Array.from(contentsRef.current),
      navigateToAddress: (address) => navigateRef.current(address),
      dirtyChanged: (dirty) => dirtyRef.current(dirty)
      };
    },
    [confirm, dialogs, projectService]
  );

  const controller = useController(() => new NexAnnotationEditorController(ports, env));
  const vm = useViewModel(controller);

  return useMemo(
    () => ({
      vm,
      dispatch: (intent: NexAnnotationEditorIntent) => void controller.dispatch(intent),
      confirmDisposal: () => controller.confirmDisposal()
    }),
    [controller, vm]
  );
}
