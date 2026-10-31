import { useEffect, useMemo, useRef, type ComponentProps } from "react";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useMainApi } from "@renderer/core/MainApi";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useController, useFilePickerPort, useViewModel } from "@renderer/mvc";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { t } from "@common/i18n/i18n";
import { NewItemDialog, type NewItemDialogResult } from "@renderer/appIde/dialogs/NewItemDialog";
import { RenameDialog, type RenameDialogResult } from "@renderer/appIde/dialogs/RenameDialog";
import { FmConflictDialog, FmDeleteDialog, FmTransferDialog } from "./FileManagerDialogs";
import {
  FileManagerController,
  type ConflictAnswer,
  type FileManagerPorts,
  type TransferConfirmation
} from "./FileManagerController";
import type { PaneLocation } from "./FileManagerModel";
import { FileManagerView } from "./FileManagerView";

/*
 * The File Manager document (.plans/FILE_MANAGER_PLAN.md, D1): wiring only. The controller gets
 * MainApi's `fm*` calls, the file picker and the document's view state as its ports.
 */

type FileManagerViewState = {
  locations?: [PaneLocation | undefined, PaneLocation | undefined];
};

export const createFileManagerPanel = ({ document }: DocumentProps) => (
  <FileManagerPanel key={document?.id} documentId={document?.id ?? ""} />
);

const FileManagerPanel = ({ documentId }: { documentId: string }) => {
  const mainApi = useMainApi();
  const picker = useFilePickerPort();
  const hub = useDocumentHubService();
  const { list: rowHeight } = useRowSizes();
  const dialogs = useDialogs();
  const emuApi = useEmuApi();
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const machineStopped =
    machineState === undefined || machineState === MachineControllerState.None || machineState === MachineControllerState.Stopped;

  // --- Ports read the hub through a ref: the controller keeps the ports it was built with
  const hubRef = useRef(hub);
  hubRef.current = hub;

  const ports = useMemo<FileManagerPorts>(
    () => ({
      fm: {
        listDrives: () => mainApi.fmListDrives(),
        openImage: (filePath) => mainApi.fmOpenImage(filePath),
        list: (driveId, dir) => mainApi.fmList(driveId, dir),
        planTransfer: (request) => mainApi.fmPlanTransfer(request),
        runTransfer: (id, decisions) => mainApi.fmRunTransfer(id, decisions),
        jobStatus: (id) => mainApi.fmJobStatus(id),
        cancelJob: (id) => mainApi.fmCancelJob(id),
        deleteEntries: (driveId, paths) => mainApi.fmDelete(driveId, paths),
        mkdir: (driveId, dir, name) => mainApi.fmMkdir(driveId, dir, name),
        rename: (driveId, path, newName) => mainApi.fmRename(driveId, path, newName)
      },
      dialogs: {
        confirmTransfer: (request) =>
          dialogs.open<TransferConfirmation, Omit<ComponentProps<typeof FmTransferDialog>, "controls">>(
            FmTransferDialog,
            request,
            { title: t(request.plan.move ? "panels.fileManager.dialog.moveTitle" : "panels.fileManager.dialog.copyTitle"), width: 640, iconName: "columns-2" }
          ),
        resolveConflict: async (request) =>
          (await dialogs.open<ConflictAnswer, Omit<ComponentProps<typeof FmConflictDialog>, "controls">>(
            FmConflictDialog,
            request,
            { title: t("panels.fileManager.dialog.conflictTitle"), width: 520 }
          )) ?? { kind: "cancel" },
        confirmDelete: async (request) =>
          !!(await dialogs.open<true, Omit<ComponentProps<typeof FmDeleteDialog>, "controls">>(
            FmDeleteDialog,
            request,
            { title: t("panels.fileManager.dialog.deleteTitle"), width: 440, danger: true }
          )),
        askFolderName: async ({ where, existing }) =>
          (await dialogs.open<NewItemDialogResult, Omit<ComponentProps<typeof NewItemDialog>, "controls">>(
            NewItemDialog,
            { isFolder: true, path: where, itemNames: existing },
            { title: t("panels.fileManager.dialog.mkdirTitle"), width: 420, iconName: "folder" }
          ))?.name,
        askNewName: async ({ oldName }) =>
          (await dialogs.open<RenameDialogResult, Omit<ComponentProps<typeof RenameDialog>, "controls">>(
            RenameDialog,
            { oldPath: oldName },
            { title: t("panels.fileManager.dialog.renameTitle"), width: 420, iconName: "pencil" }
          ))?.name
      },
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      machine: { stop: () => emuApi.issueMachineCommand("stop") },
      picker,
      locations: {
        save: (locations) => {
          const current = (hubRef.current.getDocumentViewState(documentId) as FileManagerViewState) ?? {};
          hubRef.current.setDocumentViewState(documentId, { ...current, locations });
        }
      }
    }),
    // --- Built once: a controller keeps its first ports
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const controller = useController(() => new FileManagerController(ports));
  const vm = useViewModel(controller);

  useEffect(() => {
    const saved = (hubRef.current.getDocumentViewState(documentId) as FileManagerViewState)?.locations;
    void controller.dispatch({ type: "activated", locations: saved });
  }, [controller, documentId]);

  // --- The machine's storage is a drive only while the machine is stopped (D4)
  useEffect(() => {
    void controller.dispatch({ type: "machineStateChanged", stopped: machineStopped });
  }, [controller, machineStopped]);

  return <FileManagerView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} rowHeight={rowHeight} />;
};
