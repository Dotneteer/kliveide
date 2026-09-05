import { useEffect, useMemo, useRef } from "react";

import { setExcludedProjectItemsAction } from "@common/state/actions";
import { Modal } from "@controls/Modal";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";

import { getNodeFile } from "../../project/project-paths";
import { saveProject } from "../../utils/save-project";
import {
  excludedItemsFromProject,
  getExcludedProjectItemsFromGlobalSettings
} from "../../utils/excluded-items-utils";
import { ExcludedItemsController } from "./ExcludedItemsController";
import { UNNAMED_PROJECT, type ExcludedItemsEnvironment } from "./ExcludedItemsModel";
import type {
  ExcludedItemsPorts,
  ExcludedProjectItemsDialogResult
} from "./ExcludedItemsPorts";
import { ExcludedItemsView } from "./ExcludedItemsView";

export type { ExcludedProjectItemsDialogResult } from "./ExcludedItemsPorts";

type Props = {
  onClose: () => void;
  onApply?: (result: ExcludedProjectItemsDialogResult) => void;
};

/**
 * Wiring only: Redux state in, ports built from the messenger, and the modal
 * frame around the view.
 */
export const ExcludedProjectItemsDialog = ({ onClose, onApply }: Props) => {
  const { messenger, store } = useRendererContext();
  const dispatch = useDispatch();

  // --- A primitive, so the shallow-equal selector can do its job.
  const projectName = useSelector((state) =>
    getNodeFile(state.project?.folderPath ?? UNNAMED_PROJECT)
  );
  const env = useMemo<ExcludedItemsEnvironment>(() => ({ projectName }), [projectName]);

  // --- Read once, at open: the user is editing this list, so a live feed from
  // --- the store would fight the edit.
  const projectItemsRef = useRef(excludedItemsFromProject(store.getState().project));

  const callbacksRef = useRef({ onClose, onApply });
  callbacksRef.current = { onClose, onApply };

  const ports = useMemo<ExcludedItemsPorts>(
    () => ({
      close: {
        applied: (result) => {
          callbacksRef.current.onApply?.(result);
          callbacksRef.current.onClose();
        },
        dismissed: () => callbacksRef.current.onClose()
      },
      service: {
        getGlobalExcludes: () => getExcludedProjectItemsFromGlobalSettings(messenger),
        saveExcludedItems: async (excludedItemIds) => {
          dispatch(setExcludedProjectItemsAction(excludedItemIds));
          await saveProject(messenger);
        }
      }
    }),
    [dispatch, messenger]
  );

  const controller = useController(
    () => new ExcludedItemsController(ports, env, projectItemsRef.current)
  );
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title="Excluded Items"
      isOpen={true}
      fullScreen={false}
      width={500}
      primaryLabel="OK"
      primaryEnabled={vm.applyEnabled}
      initialFocus="none"
      onPrimaryClicked={async () => {
        // --- Returning true keeps the modal open; the controller closes it once
        // --- the project has actually been saved.
        await controller.dispatch({ type: "applyRequested" });
        return true;
      }}
      onClose={() => {
        void controller.dispatch({ type: "cancelRequested" });
      }}
    >
      <ExcludedItemsView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
