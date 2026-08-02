import type { AboutDialogData } from "@common/messaging/about-dialog";
import { Modal } from "@controls/Modal";
import { useMainApi } from "@renderer/core/MainApi";

export type AboutDialogResult = "close" | "website";

type Props = {
  about: AboutDialogData;
  onClose: (result: AboutDialogResult) => void;
};

export function AboutDialog({ about, onClose }: Props) {
  const mainApi = useMainApi();

  return (
    <Modal
      title="About Klive IDE"
      isOpen={true}
      width={460}
      primaryVisible={false}
      secondaryVisible={true}
      secondaryLabel="Visit website"
      cancelVisible={true}
      cancelLabel="Close"
      initialFocus="cancel"
      onSecondaryClicked={async () => {
        await mainApi.showWebsite();
        onClose("website");
        return true;
      }}
      onCancelClicked={async () => {
        onClose("close");
        return true;
      }}
      onClose={() => onClose("close")}
    >
      <p>Klive IDE is a retro computer emulator and Integrated Development Environment.</p>
      <p>
        Version: <strong data-testid="about-version">{about.version}</strong>
      </p>
      <p>Electron version: {about.electronVersion}</p>
      <p>OS version: {about.osVersion}</p>
    </Modal>
  );
}
