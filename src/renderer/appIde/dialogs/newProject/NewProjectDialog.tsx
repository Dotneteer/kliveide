import { useEffect, useMemo, useRef } from "react";

import { Modal } from "@controls/Modal";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useFilePickerPort } from "@mvc/dialogs/useDialogPorts";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useRendererContext } from "@renderer/core/RendererProvider";

import {
  ensureBuildRootsLoaded,
  ensureProjectLoaded,
  ensureWorkspaceLoaded
} from "../../IdeEventsHandler";
import { NewProjectController } from "./NewProjectController";
import type { NewProjectEnvironment } from "./NewProjectModel";
import type { NewProjectDialogResult, NewProjectPorts } from "./NewProjectPorts";
import { NewProjectView } from "./NewProjectView";

export type { NewProjectDialogResult } from "./NewProjectPorts";

type Props = {
  onClose: () => void;
  onCreate?: (result: NewProjectDialogResult) => Promise<void> | void;
};

/**
 * Wiring only: services in, ports built from them, and the modal frame around
 * the view. The creation sequence itself lives in the controller.
 */
export const NewProjectDialog = ({ onClose, onCreate }: Props) => {
  const mainApi = useMainApi();
  const files = useFilePickerPort();
  const { validationService, projectService, ideCommandsService } = useAppServices();
  const { store } = useRendererContext();

  const env = useMemo<NewProjectEnvironment>(
    () => ({ validation: validationService }),
    [validationService]
  );

  const callbacksRef = useRef({ onClose, onCreate });
  callbacksRef.current = { onClose, onCreate };

  const ports = useMemo<NewProjectPorts>(
    () => ({
      files,
      close: {
        created: async (result) => {
          await callbacksRef.current.onCreate?.(result);
          callbacksRef.current.onClose();
        },
        cancelled: () => callbacksRef.current.onClose()
      },
      service: {
        getTemplateDirectories: (machineId) => mainApi.getTemplateDirectories(machineId),
        createProject: (request) =>
          mainApi.createKliveProject(
            request.machineId,
            request.projectName,
            request.projectFolder,
            request.modelId,
            request.templateId
          ),
        openFolder: (path) => mainApi.openFolder(path),
        ensureProjectLoaded: async () => {
          await ensureProjectLoaded(projectService);
        },
        ensureWorkspaceLoaded: async () => {
          await ensureWorkspaceLoaded(store);
        },
        loadBuildRoots: async () => {
          // --- Waits for the main process to forward them, then reads what
          // --- arrived; the dialog only ever wants the answer.
          await ensureBuildRootsLoaded(store);
          return store.getState().project?.buildRoots ?? [];
        },
        navigateTo: (path) => {
          void ideCommandsService.executeCommand(`nav "${path}"`);
        },
        notify: (type, title, message) => mainApi.displayMessageBox(type, title, message)
      }
    }),
    [files, ideCommandsService, mainApi, projectService, store]
  );

  const controller = useController(() => new NewProjectController(ports, env));
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title="Create a new Klive project"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      footerVisible={false}
      onClose={() => {
        void controller.dispatch({ type: "cancelRequested" });
      }}
    >
      <NewProjectView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
