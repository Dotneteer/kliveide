import { useRendererContext } from "@renderer/core/RendererProvider";
import classnames from "classnames";
import { dimMenuAction } from "@state/actions";
import {
  KeyboardEvent,
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { getModalStackSize, isTopModal, registerModal } from "./overlay/modalStack";
import { getOverlayRoot, useOverlayRoot } from "./overlay/useOverlayRoot";
import styles from "./Modal.module.scss";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

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
  dialogRole?: "dialog" | "alertdialog";
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
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
  portalTo,
  dialogRole,
  closeOnEscape = true,
  closeOnOutsideClick = true,
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
  const overlayRoot = useOverlayRoot();
  const root = portalTo ?? overlayRoot ?? getOverlayRoot();
  const titleId = useId();
  const { store, messageSource } = useRendererContext();
  const [button1Enabled, setButton1Enabled] = useState(primaryEnabled);
  const [button2Enabled, setButton2Enabled] = useState(secondaryEnabled);
  const [cancelButtonEnabled, setCancelButtonEnabled] = useState(cancelEnabled);
  const [dialogResult, setDialogResult] = useState<any>();
  const modalId = useId();
  const closeOnEscapeRef = useRef(closeOnEscape);
  const doCloseRef = useRef<(result?: any) => void>();
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);

  const doClose = useCallback((result?: any) => {
    if (getModalStackSize() <= 1) {
      store.dispatch(dimMenuAction(false), messageSource);
    }
    onClose?.(result);
  }, [messageSource, onClose, store]);

  const [closeStarted, setCloseStarted] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  closeOnEscapeRef.current = closeOnEscape;
  doCloseRef.current = doClose;

  // --- Define button click handlers
  const primaryClickHandler = useCallback(async (result?: any) => {
    const close = await onPrimaryClicked?.(result ?? dialogResult);
    if (!close) {
      doClose();
    }
  }, [dialogResult, doClose, onPrimaryClicked]);
  const secondaryClickHandler = useCallback(async (result?: any) => {
    const close = await onSecondaryClicked?.(result ?? dialogResult);
    if (!close) {
      doClose();
    }
  }, [dialogResult, doClose, onSecondaryClicked]);
  const cancelClickHandler = useCallback(async (result?: any) => {
    const close = await onCancelClicked?.(result);
    if (!close) {
      doClose();
    }
  }, [doClose, onCancelClicked]);

  useEffect(() => {
    setButton1Enabled(primaryEnabled);
    setButton2Enabled(secondaryEnabled);
    setCancelButtonEnabled(cancelEnabled);
  },
  [primaryEnabled, secondaryEnabled, cancelEnabled]);

  useEffect(() => {
    onApiLoaded?.({
      enablePrimaryButton: (flag: boolean) => setButton1Enabled(flag),
      enableSecondaryButton: (flag: boolean) => setButton2Enabled(flag),
      enableCancel: (flag: boolean) => setCancelButtonEnabled(flag),
      setDialogResult: (result?: any) => setDialogResult(result),
      triggerPrimary: (result?: any) => primaryClickHandler(result),
      triggerSecondary: (result?: any) => secondaryClickHandler(result),
      triggerCancel: (result?: any) => cancelClickHandler(result),
      triggerClose: (result?: any) => doClose(result)
    });
  }, [cancelClickHandler, doClose, onApiLoaded, primaryClickHandler, secondaryClickHandler]);

  useEffect(() => {
    store.dispatch(dimMenuAction(isOpen), messageSource);
  }, [isOpen, messageSource, store]);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const unregister = registerModal({
      id: modalId,
      handleEscape: () => {
        if (closeOnEscapeRef.current) {
          doCloseRef.current?.();
        }
      }
    });

    return () => {
      unregister();
      const elementToRestore = restoreFocusElementRef.current;
      restoreFocusElementRef.current = null;
      if (elementToRestore && document.contains(elementToRestore)) {
        elementToRestore.focus();
      }
    };
  }, [isOpen, modalId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.code !== "Escape" || !isTopModal(modalId)) return;
      const topModal = isTopModal(modalId);
      if (topModal && closeOnEscapeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        doCloseRef.current?.();
      }
    };

    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown, true);
  }, [isOpen, modalId]);

  useEffect(() => {
    if (!isOpen) return;

    const handle = setTimeout(() => {
      if (!isTopModal(modalId)) return;
      focusInitialElement(containerRef.current, initialFocus);
    });

    return () => clearTimeout(handle);
  }, [initialFocus, isOpen, modalId]);

  const handleDialogKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !isTopModal(modalId)) return;

    const focusableElements = getFocusableElements(containerRef.current);
    if (!focusableElements.length) {
      event.preventDefault();
      containerRef.current?.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey) {
      if (activeElement === firstElement || !containerRef.current?.contains(activeElement)) {
        event.preventDefault();
        lastElement.focus();
      }
    } else if (activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }, [modalId]);

  const onMouseDownHandler: MouseEventHandler<HTMLDivElement> = e => {
    setCloseStarted(
      closeOnOutsideClick && !!(modalRef?.current && modalRef?.current === e.target)
    );
  };

  const onMouseUpHandler: MouseEventHandler<HTMLDivElement> = e => {
    if (!closeOnOutsideClick) {
      setCloseStarted(false);
      return;
    }
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
              role={dialogRole ?? (primaryDanger ? "alertdialog" : "dialog")}
              aria-modal='true'
              aria-labelledby={title ? titleId : undefined}
              onKeyDown={handleDialogKeyDown}
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
                <header id={titleId} className={styles.dialogTitle}>{title}</header>
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
                  onClick={() => doClose()}
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
                  <span data-modal-action="primary">
                    <Button
                      text={primaryLabel}
                      visible={primaryVisible}
                      focusOnInit={primaryEnabled && initialFocus === "primary"}
                      isDanger={primaryDanger}
                      disabled={!button1Enabled}
                      spaceLeft={8}
                      clicked={async () => await primaryClickHandler()}
                    />
                  </span>
                  <span data-modal-action="secondary">
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
                  </span>
                  <span data-modal-action="cancel">
                    <Button
                      text={cancelLabel}
                      visible={cancelVisible}
                      disabled={!cancelButtonEnabled}
                      focusOnInit={
                        cancelButtonEnabled && initialFocus === "cancel"
                      }
                      clicked={async () => await cancelClickHandler()}
                    />
                  </span>
                </footer>
              </div>
            </div>
          </div>,
          root
        )}
    </>
  );
};

function focusInitialElement(
  container: HTMLElement | null,
  initialFocus: ModalProps["initialFocus"]
): void {
  if (!container) return;

  const requestedTarget =
    initialFocus && initialFocus !== "none"
      ? container.querySelector<HTMLElement>(
          `[data-modal-action="${initialFocus}"] ${FOCUSABLE_SELECTOR}`
        )
      : null;
  const firstFocusable = getFocusableElements(container).find(
    (element) => !element.classList.contains(styles.closeButton)
  );

  (requestedTarget ?? firstFocusable ?? container).focus();
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      !element.getAttribute("aria-hidden") &&
      !element.hidden &&
      element.tabIndex !== -1
  );
}
