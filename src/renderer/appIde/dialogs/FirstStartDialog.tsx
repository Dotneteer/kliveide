import { startScreenDisplayedAction } from "@common/state/actions";
import styles from "./FirstStartDialog.module.scss";
import { Modal } from "@controls/Modal";
import { useDispatch } from "@renderer/core/RendererProvider";
import { useRef } from "react";
import { Logo } from "@renderer/controls/Logo";
import { useMainApi } from "@renderer/core/MainApi";

export type FirstStartDialogResult = "ok" | "website";

type Props = {
  onClose: () => void;
  onResolve?: (result: FirstStartDialogResult) => void;
};

export const FirstStartDialog = ({ onClose, onResolve }: Props) => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const resolved = useRef(false);

  const resolveOnce = (result: FirstStartDialogResult) => {
    if (resolved.current) return;
    resolved.current = true;
    onResolve?.(result);
  };

  return (
    <Modal
      title="Welcome to Klive!"
      isOpen={true}
      fullScreen={false}
      width={500}
      translateY={0}
      primaryLabel="Ok"
      secondaryEnabled={true}
      secondaryVisible={true}
      secondaryLabel="Visit the Klive website"
      cancelVisible={false}
      onSecondaryClicked={async () => {
        dispatch(startScreenDisplayedAction());
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
      <div className={styles.lineWrapper}>
        Klive IDE is a retro computer emulator and Integrated Development Environment running on
        Mac, Windows, and Linux.
      </div>
      <div className={styles.lineWrapper}>
        You can not only run your favorite retro machines but also create programs and games for
        them.
      </div>
      <div className={styles.lineWrapper}>Visit the Klive website to get started!</div>
      <div className={styles.lineWrapper} />
    </Modal>
  );
};
