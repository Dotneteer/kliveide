import { startScreenDisplayedAction } from "@common/state/actions";
import styles from "./FirstStartDialog.module.scss";
import { Modal } from "@controls/Modal";
import { useDispatch } from "@renderer/core/RendererProvider";
import { useRef } from "react";
import { Logo } from "@renderer/controls/Logo";
import { useMainApi } from "@renderer/core/MainApi";
import { useT } from "@common/i18n/useT";

export type FirstStartDialogResult = "ok" | "website";

type Props = {
  onClose: () => void;
  onResolve?: (result: FirstStartDialogResult) => void;
};

export const FirstStartDialog = ({ onClose, onResolve }: Props) => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const t = useT();
  const resolved = useRef(false);

  const resolveOnce = (result: FirstStartDialogResult) => {
    if (resolved.current) return;
    resolved.current = true;
    onResolve?.(result);
  };

  return (
    <Modal
      title={t("dialog.firstStart.title")}
      iconName="rocket"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      primaryLabel={t("common.button.ok")}
      secondaryEnabled={true}
      secondaryVisible={true}
      secondaryLabel={t("dialog.firstStart.visitWebsite")}
      cancelVisible={false}
      onSecondaryClicked={async () => {
        /*
         * No `dispatch` here.
         *
         * Returning `false` tells `Modal` to close, which runs `onClose` below — and that already
         * dispatches `startScreenDisplayedAction`. Doing it here as well fired the action twice for
         * one click. It is idempotent, so nothing broke; it is still two writes where the code
         * reads as one, and the next person to add a non-idempotent step inherits the bug.
         */
        await mainApi.showWebsite();
        resolveOnce("website");
        return false;
      }}
      onClose={() => {
        dispatch(startScreenDisplayedAction());
        resolveOnce("ok");
        onClose?.();
      }}
    >
      <div className={styles.logoWrapper}>
        <Logo />
      </div>
      <div className={styles.lineWrapper}>{t("dialog.firstStart.intro")}</div>
      <div className={styles.lineWrapper}>{t("dialog.firstStart.purpose")}</div>
      <div className={styles.lineWrapper}>{t("dialog.firstStart.getStarted")}</div>
      <div className={styles.lineWrapper} />
    </Modal>
  );
};
