import classnames from "@/utils/classnames";
import {
  MouseEventHandler,
  ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Modal.module.scss";

export interface ModalApi {
  enablePrimaryButton: (flag: boolean) => void;
  enableSecondaryButton: (flag: boolean) => void;
  enableCancel: (flag: boolean) => void;
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
  secondaryLabel?: string;
  secondaryEnabled?: boolean;
  secondaryVisible?: boolean;
  cancelLabel?: string;
  cancelEnabled?: boolean;
  cancelVisible?: boolean;
  onApiLoaded?: (api: ModalApi) => void;
  onClose: (...args: any[]) => any;
  onPrimaryClicked?: () => boolean;
  onSecondaryClicked?: () => boolean;
  onCancelClicked?: () => boolean;
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
  secondaryLabel = "Secondary",
  secondaryVisible = false,
  secondaryEnabled = true,
  cancelLabel = "Cancel",
  cancelEnabled = true,
  cancelVisible = true,
  onApiLoaded,
  onClose,
  onPrimaryClicked,
  onSecondaryClicked,
  onCancelClicked
}: ModalProps) => {
  const root = document.getElementById("appMain") || document.body;
  const [button1Enabled, setButton1Enabled] = useState(primaryEnabled);
  const [button2Enabled, setButton2Enabled] = useState(secondaryEnabled);
  const [cancelButtonEnabled, setCancelButtonEnabled] = useState(cancelEnabled);

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === "Escape") {
      onClose?.();
    }
  };
  const [closeStarted, setCloseStarted] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onApiLoaded?.({
      enablePrimaryButton: (flag: boolean) => setButton1Enabled(flag),
      enableSecondaryButton: (flag: boolean) => setButton2Enabled(flag),
      enableCancel: (flag: boolean) => setCancelButtonEnabled(flag),
      triggerClose: () => onClose()
    });
  }, [modalRef.current]);

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
      onClose();
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
                  onClick={onClose}
                >
                  <Icon iconName='close' height={16} width={16} />
                </button>
              </div>

              <div className={styles.dialogBody}>{children}</div>
              <div>
                <footer className={styles.dialogFooter}>
                  {primaryVisible && (
                    <button
                      disabled={!button1Enabled}
                      onClick={() => {
                        const close = onPrimaryClicked?.();
                        if (!close) {
                          onClose();
                        }
                      }}
                    >
                      {primaryLabel}
                    </button>
                  )}
                  {secondaryVisible && (
                    <button
                      disabled={!button2Enabled}
                      onClick={() => {
                        const close = onSecondaryClicked?.();
                        if (!close) {
                          onClose();
                        }
                      }}
                    >
                      {secondaryLabel}
                    </button>
                  )}
                  {cancelVisible && (
                    <button
                      disabled={!cancelButtonEnabled}
                      onClick={() => {
                        const close = onCancelClicked?.();
                        if (!close) {
                          onClose();
                        }
                      }}
                    >
                      {cancelLabel}
                    </button>
                  )}
                </footer>
              </div>
            </div>
          </div>,
          root
        )}
    </>
  );
};
