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
  /**
   * The glyph for the header's accent chip — the accent's only landing place in the dialog chrome.
   * Optional: a dialog that supplies none renders no chip. The chip takes the danger tone whenever
   * `primaryDanger` is set, so a destructive dialog is marked in the header as well as on its
   * commit button.
   */
  iconName?: string;
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
  footerVisible?: boolean;
  initialFocus?: "none" | "primary" | "secondary" | "cancel";
  onClose: (result?: any) => any;
  /**
   * Runs when the commit button is clicked.
   *
   * **Resolve `true` to keep the dialog open**, `false` (or nothing) to let it close. The sense is
   * the opposite of what the name suggests, which is why it is spelled out here: the handler's
   * return value answers "am I handling the close myself?", not "should this close?".
   *
   * It used to be read into a variable called `close` meaning *keep open*, and four MVC containers
   * each carried their own comment correcting that at the call site. Four copies of one clarifying
   * comment is the signal that the name was wrong, not the readers.
   */
  onPrimaryClicked?: () => Promise<boolean>;
  /** As `onPrimaryClicked`: resolve `true` to keep the dialog open. */
  onSecondaryClicked?: () => Promise<boolean>;
  /** As `onPrimaryClicked`: resolve `true` to keep the dialog open. */
  onCancelClicked?: () => Promise<boolean>;
};

export const Modal = ({
  children,
  isOpen,
  width,
  fullWidth,
  fullScreen,
  portalTo,
  dialogRole,
  iconName,
  closeOnEscape = true,
  closeOnOutsideClick = true,
  title,
  translateY = 0,
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
  footerVisible,
  initialFocus = "primary",
  onClose,
  onPrimaryClicked,
  onSecondaryClicked,
  onCancelClicked
}: ModalProps) => {
  const overlayRoot = useOverlayRoot();
  const root = portalTo ?? overlayRoot ?? getOverlayRoot();
  const titleId = useId();
  const { store, messageSource } = useRendererContext();
  const modalId = useId();
  const closeOnEscapeRef = useRef(closeOnEscape);
  const doCloseRef = useRef<(result?: any) => void>();
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const hasCapturedRestoreTargetRef = useRef(false);

  const doClose = useCallback((result?: any) => {
    if (getModalStackSize() <= 1) {
      store.dispatch(dimMenuAction(false), messageSource);
    }
    onClose?.(result);
  }, [messageSource, onClose, store]);

  const [closeStarted, setCloseStarted] = useState<boolean>(false);
  const showFooter = footerVisible ?? (primaryVisible || secondaryVisible || cancelVisible);
  const containerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  closeOnEscapeRef.current = closeOnEscape;
  doCloseRef.current = doClose;

  /*
   * Who to give focus back to, captured while opening — during render, not from an effect.
   *
   * React applies a field's `autoFocus` during the commit phase, which is *before* any effect runs.
   * Capturing this from an effect therefore recorded whatever the dialog had just focused inside
   * itself, and closing then "restored" focus to an element being unmounted — leaving it on
   * `<body>`, where no panel shortcut works until the user clicks something. A dialog with no
   * autofocusing field looked fine, which is why this survived: it only bites the dialogs that do.
   *
   * The render pass is the last moment before that commit, and Modal's own body runs before its
   * children are committed, so this still sees the element the user was actually on. The sentinel
   * resets on close so a Modal that is toggled rather than unmounted captures again next time.
   */
  if (isOpen && !hasCapturedRestoreTargetRef.current) {
    hasCapturedRestoreTargetRef.current = true;
    restoreFocusElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  } else if (!isOpen) {
    hasCapturedRestoreTargetRef.current = false;
  }

  // --- Define button click handlers
  const primaryClickHandler = useCallback(async () => {
    const keepOpen = await onPrimaryClicked?.();
    if (!keepOpen) {
      doClose();
    }
  }, [doClose, onPrimaryClicked]);
  const secondaryClickHandler = useCallback(async () => {
    const keepOpen = await onSecondaryClicked?.();
    if (!keepOpen) {
      doClose();
    }
  }, [doClose, onSecondaryClicked]);
  const cancelClickHandler = useCallback(async () => {
    const keepOpen = await onCancelClicked?.();
    if (!keepOpen) {
      doClose();
    }
  }, [doClose, onCancelClicked]);

  useEffect(() => {
    store.dispatch(dimMenuAction(isOpen), messageSource);
    return () => {
      if (isOpen && getModalStackSize() <= 1) {
        store.dispatch(dimMenuAction(false), messageSource);
      }
    };
  }, [isOpen, messageSource, store]);

  useEffect(() => {
    if (!isOpen) return;

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
      if (getModalStackSize() === 0) {
        store.dispatch(dimMenuAction(false), messageSource);
      }
      const elementToRestore = restoreFocusElementRef.current;
      restoreFocusElementRef.current = null;
      if (elementToRestore && document.contains(elementToRestore)) {
        elementToRestore.focus();
      }
    };
  }, [isOpen, messageSource, modalId, store]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleFormCancel = (event: Event) => {
      event.preventDefault();
      doCloseRef.current?.();
    };
    container.addEventListener("klive-dialog-cancel", handleFormCancel);
    return () => container.removeEventListener("klive-dialog-cancel", handleFormCancel);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      // --- One `isTopModal` call: the guard above already established it, and the second call
      // --- re-derived the same answer into a variable used once.
      if (event.code !== "Escape" || !isTopModal(modalId)) return;
      if (closeOnEscapeRef.current) {
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
              <header className={styles.dialogHeader}>
                {iconName && (
                  <span
                    className={classnames(styles.titleChip, {
                      [styles.danger]: primaryDanger
                    })}
                    aria-hidden='true'
                  >
                    <Icon iconName={iconName} height={14} width={14} fill='currentColor' />
                  </span>
                )}
                <span id={titleId} className={styles.dialogTitle}>
                  {title}
                </span>
                <button
                  type='button'
                  aria-label='Close dialog'
                  className={styles.closeButton}
                  onClick={() => doClose()}
                >
                  <Icon iconName='close' height={14} width={14} fill='currentColor' />
                </button>
              </header>

              <div className={styles.dialogBody}>{children}</div>

              {showFooter && <div>
                <footer className={styles.dialogFooter}>
                  <span data-modal-action="primary">
                    <Button
                      text={primaryLabel}
                      visible={primaryVisible}
                      focusOnInit={primaryEnabled && initialFocus === "primary"}
                      isDanger={primaryDanger}
                      disabled={!primaryEnabled}
                      clicked={async () => await primaryClickHandler()}
                    />
                  </span>
                  <span data-modal-action="secondary">
                    <Button
                      text={secondaryLabel}
                      variant='secondary'
                      visible={secondaryVisible}
                      focusOnInit={
                        secondaryEnabled && initialFocus === "secondary"
                      }
                      disabled={!secondaryEnabled}
                      clicked={async () => await secondaryClickHandler()}
                    />
                  </span>
                  <span data-modal-action="cancel">
                    <Button
                      text={cancelLabel}
                      variant='secondary'
                      visible={cancelVisible}
                      disabled={!cancelEnabled}
                      focusOnInit={
                        cancelEnabled && initialFocus === "cancel"
                      }
                      clicked={async () => await cancelClickHandler()}
                    />
                  </span>
                </footer>
              </div>}
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
  /*
   * A modal that is already gone must not focus anything.
   *
   * This runs from a `setTimeout`, and a timer can outlive the modal that scheduled it: closing
   * removes the dialog's DOM in the commit phase, while React's passive cleanup — which clears the
   * timer and gives focus back to the opener — is flushed separately. A timer landing in that gap
   * used to focus a field that was being unmounted, which drops focus on `<body>`: measured as
   * `focus(input)` → `focus(opener)` → `focus(input)`, the last one from here.
   *
   * That is how the NEX listing's annotation shortcuts went dead after the first dialog. They are
   * bare letters, heard only while the listing is focused, so `<body>` meant nothing worked until
   * the user clicked a row again. `isConnected` is the whole guard: if this container is no longer
   * in the document, the modal it belongs to has closed and its focus claim has expired.
   */
  if (!container || !container.isConnected) return;

  const requestedTarget =
    initialFocus && initialFocus !== "none"
      ? container.querySelector<HTMLElement>(
          `[data-modal-action="${initialFocus}"] ${FOCUSABLE_SELECTOR}`
        )
      : null;
  if (requestedTarget) {
    // --- An explicit request from the dialog's author outranks anything the body arranged.
    requestedTarget.focus();
    return;
  }

  /*
   * A field inside the body that already took focus keeps it.
   *
   * React implements `autoFocus` by calling `.focus()` during commit rather than by emitting the
   * attribute (checked against React 18: the rendered HTML carries no `autofocus`), so a field that
   * asked for focus is *already focused* by the time this runs a tick later — and there is no
   * attribute left to look for. Without this check the fallback below would immediately take it
   * away again and hand it to whatever happens to come first in the DOM.
   *
   * That is not hypothetical: every dialog opened through `DialogProvider` passes
   * `initialFocus="none"`, so all of them land here. The NEX label dialog marks its Name field
   * `autoFocus`, and focus went to the Scope radio group above it instead, purely because a radio
   * input is the first focusable thing in the form.
   *
   * `"none"` still does not mean *no* focus: a body that asked for nothing gets its first focusable
   * element, which is what keeps Tab and Escape working in a dialog the user has not clicked into.
   */
  if (container.contains(document.activeElement) && document.activeElement !== container) {
    return;
  }

  const firstFocusable = getFocusableElements(container).find(
    (element) => !element.classList.contains(styles.closeButton)
  );

  (firstFocusable ?? container).focus();
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
