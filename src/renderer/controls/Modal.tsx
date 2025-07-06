import { useRendererContext } from "@renderer/core/RendererProvider";
import classnames from "classnames";
import { dimMenuAction } from "@state/actions";
import {
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { Icon } from "./Icon";
import styles from "./Modal.module.scss";

export type DialogResultType = any;

export interface ModalApi {
  enablePrimaryButton: (flag: boolean) => void;
  enableSecondaryButton: (flag: boolean) => void;
  enableCancel: (flag: boolean) => void;
  setDialogResult: (result?: DialogResultType) => void;
  triggerPrimary: (result?: DialogResultType) => void;
  triggerSecondary: (result?: DialogResultType) => void;
  triggerCancel: (result?: DialogResultType) => void;
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
  onClose: (result?: DialogResultType) => any;
  onPrimaryClicked?: (result?: DialogResultType) => Promise<boolean>;
  onSecondaryClicked?: (result?: DialogResultType) => Promise<boolean>;
  onCancelClicked?: (result?: DialogResultType) => Promise<boolean>;
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
  const [dialogResult, setDialogResult] = useState<DialogResultType>(undefined);

  const doClose = useCallback(() => {
    store.dispatch(dimMenuAction(false), messageSource);
    onClose?.();
  }, [store, messageSource, onClose]);

  const handleKeyboard = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.code === "Escape") {
      doClose();
    }
  }, [doClose]);

  const [closeStarted, setCloseStarted] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // --- Define button click handlers with useCallback
  const primaryClickHandler = useCallback(async (result?: DialogResultType) => {
    const close = await onPrimaryClicked?.(result ?? dialogResult);
    if (!close) {
      doClose();
    }
  }, [onPrimaryClicked, dialogResult, doClose]);
  
  const secondaryClickHandler = useCallback(async (result?: DialogResultType) => {
    const close = await onSecondaryClicked?.(result ?? dialogResult);
    if (!close) {
      doClose();
    }
  }, [onSecondaryClicked, dialogResult, doClose]);
  
  const cancelClickHandler = useCallback(async (result?: DialogResultType) => {
    const close = await onCancelClicked?.(result);
    if (!close) {
      doClose();
    }
  }, [onCancelClicked, doClose]);

  useEffect(() => {
    setButton1Enabled(primaryEnabled);
    setButton2Enabled(secondaryEnabled);
    setCancelButtonEnabled(cancelEnabled);
  },
  [primaryEnabled, secondaryEnabled, cancelEnabled]);

  // Memoize the API object to prevent recreation on every render
  const modalApi = useMemo<ModalApi>(() => ({
    enablePrimaryButton: (flag: boolean) => setButton1Enabled(flag),
    enableSecondaryButton: (flag: boolean) => setButton2Enabled(flag),
    enableCancel: (flag: boolean) => setCancelButtonEnabled(flag),
    setDialogResult: (result?: DialogResultType) => setDialogResult(result),
    triggerPrimary: (result?: DialogResultType) => primaryClickHandler(result),
    triggerSecondary: (result?: DialogResultType) => secondaryClickHandler(result),
    triggerCancel: (result?: DialogResultType) => cancelClickHandler(result),
    triggerClose: (result?: DialogResultType) => onClose(result)
  }), [
    setButton1Enabled,
    setButton2Enabled,
    setCancelButtonEnabled,
    setDialogResult,
    primaryClickHandler,
    secondaryClickHandler,
    cancelClickHandler,
    onClose
  ]);

  useEffect(() => {
    onApiLoaded?.(modalApi);
  }, [onApiLoaded, modalApi]);

  useEffect(() => {
    store.dispatch(dimMenuAction(isOpen), messageSource);
  }, [store, isOpen, messageSource]);

  useEffect(() => {
    if (isOpen) {
      containerRef.current?.focus();
    }
  }, [isOpen]);

  const onMouseDownHandler = useCallback<MouseEventHandler<HTMLDivElement>>(e => {
    setCloseStarted(!!(modalRef?.current && modalRef?.current === e.target));
  }, [modalRef]);

  const onMouseUpHandler = useCallback<MouseEventHandler<HTMLDivElement>>(e => {
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
  }, [modalRef, closeStarted, doClose]);

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
              <div className={styles.headerContainer}>
                <header className={styles.dialogTitle}>{title}</header>
              </div>

              <div className={styles.closeButtonContainer}>
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
