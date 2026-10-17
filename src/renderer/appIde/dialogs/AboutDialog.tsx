import type { AboutDialogData } from "@common/messaging/about-dialog";
import { Modal } from "@controls/Modal";
import { useMainApi } from "@renderer/core/MainApi";
import { useT } from "@common/i18n/useT";

export type AboutDialogResult = "close" | "website";

type Props = {
  about: AboutDialogData;
  onClose: (result: AboutDialogResult) => void;
};

export function AboutDialog({ about, onClose }: Props) {
  const mainApi = useMainApi();
  const t = useT();

  return (
    <Modal
      title={t("dialog.about.title")}
      iconName="question"
      isOpen={true}
      width={460}
      primaryVisible={false}
      secondaryVisible={true}
      secondaryLabel={t("dialog.about.visitWebsite")}
      cancelVisible={true}
      cancelLabel={t("common.button.close")}
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
      <p>{t("dialog.about.description")}</p>
      <p>
        {t("dialog.about.versionLabel")} <strong data-testid="about-version">{about.version}</strong>
      </p>
      <p>{t("dialog.about.electronVersion", { version: about.electronVersion })}</p>
      <p>{t("dialog.about.osVersion", { version: about.osVersion })}</p>
    </Modal>
  );
}
