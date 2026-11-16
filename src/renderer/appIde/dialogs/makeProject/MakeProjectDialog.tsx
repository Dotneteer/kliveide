import { useEffect, useMemo, useRef } from "react";

import { useT } from "@common/i18n/useT";
import { Modal } from "@controls/Modal";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { getGlobalSetting, useRendererContext } from "@renderer/core/RendererProvider";
import { normalizeMachineFavorites } from "@common/machines/machine-favorites";
import { machineRegistry } from "@common/machines/machine-registry";
import { SETTING_EMU_MACHINE_FAVORITES } from "@common/settings/setting-const";

import {
  ensureBuildRootsLoaded,
  ensureProjectLoaded,
  ensureWorkspaceLoaded
} from "../../IdeEventsHandler";
import type { NewProjectContext } from "../newProject/NewProjectModel";
import { buildRootCandidatesOf } from "./buildRootCandidates";
import { MakeProjectController } from "./MakeProjectController";
import type { MakeProjectDialogResult, MakeProjectPorts } from "./MakeProjectPorts";
import { MakeProjectView } from "./MakeProjectView";

export type { MakeProjectDialogResult } from "./MakeProjectPorts";

/** What opens the dialog: the folder, and whether it is the offer after Open Folder */
export type MakeProjectDialogData = {
  folder: string;
  offer?: boolean;
};

type Props = {
  data: MakeProjectDialogData;
  onDone?: (result: MakeProjectDialogResult) => void;
  onClose: () => void;
};

/**
 * Wiring only: services in, ports built from them, and the modal frame around the view. The
 * sequences live in the controller.
 */
export const MakeProjectDialog = ({ data, onDone, onClose }: Props) => {
  const t = useT();
  const mainApi = useMainApi();
  const { projectService, ideCommandsService } = useAppServices();
  const { store } = useRendererContext();

  const callbacksRef = useRef({ onDone, onClose });
  callbacksRef.current = { onDone, onClose };

  const ports = useMemo<MakeProjectPorts>(
    () => ({
      close: {
        done: (result) => {
          callbacksRef.current.onDone?.(result);
          callbacksRef.current.onClose();
        },
        cancelled: () => callbacksRef.current.onClose()
      },
      service: {
        getBuildRootCandidates: async (folder) => {
          // --- Right after Open Folder the tree may still be the previous folder's
          await ensureProjectLoaded(projectService, folder);
          return buildRootCandidatesOf(projectService.getProjectTree());
        },
        getTemplateDirectories: (machineId) => mainApi.getTemplateDirectories(machineId),
        getConflicts: (folder, machineId, templateId) =>
          mainApi.getProjectConversionConflicts(folder, machineId, templateId),
        convert: (request) => mainApi.convertFolderToProject(request),
        rememberPlainFolder: (folder) => mainApi.rememberPlainFolder(folder),
        // --- Not an offer: the folder is a project by now
        openFolder: async (folder) => (await mainApi.openFolder(folder, false)) ?? undefined,
        ensureProjectLoaded: async (folder) => {
          await ensureProjectLoaded(projectService, folder);
        },
        ensureWorkspaceLoaded: async (folder) => {
          await ensureWorkspaceLoaded(store, folder);
        },
        loadBuildRoots: async () => {
          await ensureBuildRootsLoaded(store);
          return store.getState().project?.buildRoots ?? [];
        },
        navigateTo: (path) => {
          void ideCommandsService.executeCommand(`nav "${path}"`);
        },
        notify: (type, title, message) => mainApi.displayMessageBox(type, title, message)
      }
    }),
    [ideCommandsService, mainApi, projectService, store]
  );

  // --- Read once, at open: the machine the dialog starts on and the default models
  const context = useMemo<NewProjectContext>(() => {
    const emulator = store.getState()?.emulatorState;
    return {
      running: emulator?.machineId
        ? { machineId: emulator.machineId, modelId: emulator.modelId }
        : undefined,
      favorites: normalizeMachineFavorites(
        getGlobalSetting(store, SETTING_EMU_MACHINE_FAVORITES),
        machineRegistry
      )
    };
  }, [store]);

  const controller = useController(
    () => new MakeProjectController(ports, { folder: data.folder, offer: data.offer, context })
  );
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "opened" });
  }, [controller]);

  return (
    <Modal
      title={t("dialog.makeProject.title")}
      iconName="file-project"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      footerVisible={false}
      onClose={() => {
        void controller.dispatch({ type: "cancelRequested" });
      }}
    >
      <MakeProjectView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
