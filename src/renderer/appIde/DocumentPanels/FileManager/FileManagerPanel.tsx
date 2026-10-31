import { useEffect, useMemo, useRef } from "react";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useMainApi } from "@renderer/core/MainApi";
import { useController, useFilePickerPort, useViewModel } from "@renderer/mvc";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import { FileManagerController, type FileManagerPorts } from "./FileManagerController";
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

  // --- Ports read the hub through a ref: the controller keeps the ports it was built with
  const hubRef = useRef(hub);
  hubRef.current = hub;

  const ports = useMemo<FileManagerPorts>(
    () => ({
      fm: {
        listDrives: () => mainApi.fmListDrives(),
        openImage: (filePath) => mainApi.fmOpenImage(filePath),
        list: (driveId, dir) => mainApi.fmList(driveId, dir)
      },
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

  return <FileManagerView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} rowHeight={rowHeight} />;
};
