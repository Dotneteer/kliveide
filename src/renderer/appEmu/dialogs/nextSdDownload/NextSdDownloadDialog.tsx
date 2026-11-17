import { useMemo, useRef } from "react";

import { useT } from "@common/i18n/useT";
import type { NextSdDownloadDialogData } from "@common/zxnext/nextSdDownload";
import { Modal } from "@controls/Modal";
import { useMainApi } from "@renderer/core/MainApi";
import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";

import { NextSdDownloadController } from "./NextSdDownloadController";
import type { NextSdDownloadPorts } from "./NextSdDownloadPorts";
import { NextSdDownloadView } from "./NextSdDownloadView";

export type { NextSdDownloadDialogResult } from "@common/zxnext/nextSdDownload";
import type { NextSdDownloadDialogResult } from "@common/zxnext/nextSdDownload";

type Props = {
  data: NextSdDownloadDialogData;
  onClose: (result: NextSdDownloadDialogResult) => void;
};

/**
 * Wiring only: ports built from the renderer services, and the modal frame around the view. Every
 * decision lives in the controller and the model (`dev/ai/ui-mvc-guide.md`).
 */
export const NextSdDownloadDialog = ({ data, onClose }: Props) => {
  // --- Subscribes the dialog to language changes; its texts come from the view model
  useT();
  const mainApi = useMainApi();

  // --- The controller keeps its ports for its lifetime; read the callback through a ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const ports = useMemo<NextSdDownloadPorts>(
    () => ({
      service: {
        start: (setId) => mainApi.startNextSdCardDownload(setId),
        status: (setId) => mainApi.getNextSdCardDownloadStatus(setId),
        cancel: (setId) => mainApi.cancelNextSdCardDownload(setId),
        importFile: (setId) => mainApi.importNextSdCardFile(setId)
      },
      clipboard: { writeText: (text) => navigator.clipboard.writeText(text) },
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      close: { close: (result) => onCloseRef.current(result) }
    }),
    [mainApi]
  );

  const controller = useController(() => new NextSdDownloadController(ports, data));
  const vm = useViewModel(controller);

  return (
    <Modal
      title={vm.title}
      iconName="download"
      isOpen={true}
      fullScreen={false}
      width={560}
      primaryLabel={vm.primary.label}
      primaryEnabled={vm.primary.enabled}
      secondaryLabel={vm.secondary.label}
      secondaryEnabled={vm.secondary.enabled}
      secondaryVisible={true}
      cancelLabel={vm.cancel.label}
      cancelEnabled={vm.cancel.enabled}
      initialFocus="primary"
      closeOnOutsideClick={false}
      onClose={() => {
        void controller.dispatch({ type: "closeRequested" });
      }}
      onCancelClicked={async () => {
        // --- Returning true keeps the modal open; the controller decides when it closes
        void controller.dispatch({ type: "closeRequested" });
        return true;
      }}
      onPrimaryClicked={async () => {
        void controller.dispatch({ type: "downloadRequested" });
        return true;
      }}
      onSecondaryClicked={async () => {
        void controller.dispatch({ type: "importRequested" });
        return true;
      }}
    >
      <NextSdDownloadView vm={vm} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
