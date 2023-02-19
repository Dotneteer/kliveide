import classnames from "@/utils/classnames";
import { MouseEventHandler, ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import styles from "./Modal.module.scss";

export type ModalProps = {
    isOpen?: boolean;
    onClose: (...args: any[]) => any;
    children?: ReactNode;
    header?: ReactNode;
    portalTo?: HTMLElement;
    fullWidth?: boolean;
    fullScreen?: boolean;
    title?: string;
  };
  
  export const Modal: React.FC<ModalProps> = ({ children, header, isOpen, onClose, fullWidth, fullScreen, title }) => {
    const root = document.getElementById("root") || document.body;
    const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.code === "Escape") {
        onClose();
      }
    };
    const [closeStarted, setCloseStarted] = useState<boolean>(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      if (isOpen) {
        containerRef.current?.focus();
      }
    }, [isOpen]);
  
    const onMouseDownHandler: MouseEventHandler<HTMLDivElement> = (e) => {
      setCloseStarted(!!(modalRef?.current && modalRef?.current === e.target));
    };
  
    const onMouseUpHandler: MouseEventHandler<HTMLDivElement> = (e) => {
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
                [styles.fullScreen]: fullScreen,
              })}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-labelledby="dialogTitle"
                aria-describedby="dialogDesc"
                onKeyUp={handleKeyboard}
                tabIndex={-1}
                ref={containerRef}
                className={classnames(styles.dialog, {
                  [styles.fullWidth]: fullWidth,
                  [styles.fullScreen]: fullScreen,
                })}
              >
                {header || (
                  <>
                    <div style={{ display: "flex", flexDirection: "row", position: "relative" }}>
                      <header id="dialogTitle" className={styles.dialogTitle}>
                        {title}
                      </header>
                    </div>
  
                    <div style={{ position: "absolute", right: "0.25rem", top: "0.2rem" }}>
                      <button type="button" className={styles.closeButton} onClick={onClose}>
                        <Icon iconName="close" height={16} width={16}/>
                      </button>
                    </div>
                  </>
                )}
                {children}
              </div>
            </div>,
            root
          )}
      </>
    );
  };
  