import classnames from "@/renderer/utils/classnames";
import { ReactNode, useState } from "react";
import { usePopper } from "react-popper";
import { ClickAwayListener } from "./ClickAwayListener";
import localStyles from "./ContextMenu.module.scss";

type Props = {
  refElement: HTMLElement;
  isVisible: boolean;
  children: ReactNode;
  offsetX?: number;
  offsetY?: number;
  placement?: string;
  onClickAway?: () => void;
};

export const ContextMenu = ({
  refElement,
  isVisible,
  children,
  offsetX,
  offsetY,
  placement = "bottom-start",
  onClickAway
}: Props) => {
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(refElement, popperElement, {
    placement: placement as any,
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [offsetX, offsetY]
        }
      }
    ]
  });
  return (
    <>
      {isVisible && (
        <ClickAwayListener mouseEvent="mousedown" onClickAway={() => onClickAway?.()}>
          <div
            ref={setPopperElement}
            className={localStyles.contextMenu}
            style={styles.popper}
            {...attributes.popper}
            onMouseDown={e => {
              if (e.currentTarget !== e.target) {
                return;
              }
              console.log("prevent");
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {children}
          </div>
        </ClickAwayListener>
      )}
    </>
  );
};

type ContextMenuItemProps = {
  text?: string;
  disabled?: boolean;
  clicked?: () => void;
};

export const ContextMenuItem = ({ text, disabled, clicked }: ContextMenuItemProps) => {
  return (
    <div
      className={classnames(localStyles.menuItem, {
        [localStyles.disabled]: disabled
      })}
      onMouseDown={e => {
        if (!disabled) {
          if (e.button === 0) clicked?.();
        } else {
          console.log("prevent")
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {text}
    </div>
  );
};

export const ContextMenuSeparator = () => {
  return <div className={localStyles.separator}></div>;
};
