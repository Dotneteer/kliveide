import { useRendererContext } from "@/core/RendererProvider";
import classnames from "@/utils/classnames";
import { dimMenuAction } from "@state/actions";
import {
  MouseEventHandler,
  ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { Icon } from "./Icon";
import styles from "./Modal.module.scss";

export interface ModalApi {
  enablePrimaryButton: (flag: boolean) => void;
  enableSecondaryButton: (flag: boolean) => void;
  enableCancel: (flag: boolean) => void;
  setDialogResult: (result?: any) => void;
  triggerPrimary: (result?: any) => void;
  triggerSecondary: (result?: any) => void;
  triggerCancel: (result?: any) => void;
  triggerClose: () => void;
}

export type ModalProps = {
  children?: ReactNode;
  portalTo?: HTMLElement;
  width?: number;
  fullWidth?: boolean;
  fullScreen?: boolean;
  title?: string;
  isOpen?: boolean;
  translateY?: number;
  primaryLabel?: string;
  primaryEnabled?: boolean;
  primaryVisible?: boolean;
  primaryDanger?: boolean;
  secondaryLabel?: string;
  secondaryEnabled?: boolean;
  secondaryVisible?: boolean;
  cancelLabel?: string;
  cancelEnabled?: boolean;
  cancelVisible?: boolean;
  initialFocus?: "none" | "primary" | "secondary" | "cancel";
  onApiLoaded?: (api: ModalApi) => void;
  onClose: (result?: any) => any;
  onPrimaryClicked?: (result?: any) => Promise<boolean>;
  onSecondaryClicked?: (result?: any) => Promise<boolean>;
  onCancelClicked?: (result?: any) => Promise<boolean>;
};

export const Modal = ({
  children,
  isOpen,
  width,
  fullWidth,
  fullScreen,
  title,
  translateY = -200,
  primaryLabel = "Ok",
  primaryEnabled = true,
  primaryVisible = true,
  primaryDanger,
  secondaryLabel = "Secondary",
  secondaryVisible = false,
  secondaryEnabled = true,
  cancelLabel = "Cancel",
  cancelEnabled = true,
  cancelVisible = true,
  initialFocus = "primary",
  onApiLoaded,
  onClose,
  onPrimaryClicked,
  onSecondaryClicked,
  onCancelClicked
}: ModalProps) => {
  const root = document.getElementById("appMain") || document.body;
  const { store, messageSource } = useRendererContext();
  const [button1Enabled, setButton1Enabled] = useState(primaryEnabled);
  const [button2Enabled, setButton2Enabled] = useState(secondaryEnabled);
  const [cancelButtonEnabled, setCancelButtonEnabled] = useState(cancelEnabled);
  const [dialogResult, setDialogResult] = useState<any>();

  const doClose = () => {
    store.dispatch(dimMenuAction(false), messageSource);
    onClose?.();
  };

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === "Escape") {
      doClose();
    }
  };

  const [closeStarted, setCloseStarted] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // --- Define button click handlers
  const primaryClickHandler = async (result?: any) => {
    const close = await onPrimaryClicked?.(result ?? dialogResult);
    if (!close) {
      doClose();
    }
  };
  const secondaryClickHandler = async (result?: any) => {
    const close = await onSecondaryClicked?.(result ?? dialogResult);
    if (!close) {
      doClose();
    }
  };
  const cancelClickHandler = async (result?: any) => {
    const close = await onCancelClicked?.(result);
    if (!close) {
      doClose();
    }
  };

  useEffect(() => {
    onApiLoaded?.({
      enablePrimaryButton: (flag: boolean) => setButton1Enabled(flag),
      enableSecondaryButton: (flag: boolean) => setButton2Enabled(flag),
      enableCancel: (flag: boolean) => setCancelButtonEnabled(flag),
      setDialogResult: (result?: any) => setDialogResult(result),
      triggerPrimary: (result?: any) => primaryClickHandler(result),
      triggerSecondary: (result?: any) => primaryClickHandler(result),
      triggerCancel: (result?: any) => primaryClickHandler(result),
      triggerClose: (result?: any) => onClose(result)
    });
  }, [modalRef.current]);

  useEffect(() => {
    store.dispatch(dimMenuAction(isOpen), messageSource);
  });

  useEffect(() => {
    if (isOpen) {
      containerRef.current?.focus();
    }
  }, [isOpen]);

  const onMouseDownHandler: MouseEventHandler<HTMLDivElement> = e => {
    setCloseStarted(!!(modalRef?.current && modalRef?.current === e.target));
  };

  const onMouseUpHandler: MouseEventHandler<HTMLDivElement> = e => {
    if (modalRef?.current && modalRef?.current !== e.target) {
      return;
    }
    if (e.defaultPrevented) {
      return;
    }
    if (closeStarted) {
      doClose();
    }
    setCloseStarted(false);
  };

  return (
    <>
      {isOpen &&
        createPortal(
          <div
            ref={modalRef}
            onMouseDown={onMouseDownHandler}
            onMouseUp={onMouseUpHandler}
            className={classnames(styles.modal, {
              [styles.fullScreen]: fullScreen
            })}
          >
            <div
              onClick={e => e.stopPropagation()}
              role='dialog'
              aria-labelledby='dialogTitle'
              aria-describedby='dialogDesc'
              onKeyUp={handleKeyboard}
              tabIndex={-1}
              ref={containerRef}
              className={classnames(styles.dialog, {
                [styles.fullWidth]: fullWidth,
                [styles.fullScreen]: fullScreen
              })}
              style={{ width, transform: `translateY(${translateY}px)` }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  position: "relative"
                }}
              >
                <header className={styles.dialogTitle}>{title}</header>
              </div>

              <div
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "0.5rem"
                }}
              >
                <button
                  type='button'
                  className={styles.closeButton}
                  onClick={doClose}
                >
                  <Icon
                    iconName='close'
                    height={16}
                    width={16}
                    fill='--color-command-icon'
                  />
                </button>
              </div>

              <div className={styles.dialogBody}>{children}</div>

              <div>
                <footer className={styles.dialogFooter}>
                  <Button
                    text={primaryLabel}
                    visible={primaryVisible}
                    focusOnInit={primaryEnabled && initialFocus === "primary"}
                    isDanger={primaryDanger}
                    disabled={!button1Enabled}
                    spaceLeft={8}
                    clicked={async () => await primaryClickHandler()}
                  />
                  <Button
                    text={secondaryLabel}
                    visible={secondaryVisible}
                    focusOnInit={
                      secondaryEnabled && initialFocus === "secondary"
                    }
                    disabled={!button2Enabled}
                    spaceLeft={8}
                    clicked={async () => await secondaryClickHandler()}
                  />
                  <Button
                    text={cancelLabel}
                    visible={cancelVisible}
                    disabled={!cancelButtonEnabled}
                    focusOnInit={
                      cancelButtonEnabled && initialFocus === "cancel"
                    }
                    clicked={async () => await cancelClickHandler()}
                  />
                </footer>
              </div>
            </div>
          </div>,
          root
        )}
    </>
  );
};
