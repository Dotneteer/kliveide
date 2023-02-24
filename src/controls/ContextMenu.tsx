import classnames from "@/utils/classnames";
import { ReactNode, useRef, useState } from "react";
import { usePopper } from "react-popper";
import { ClickAwayListener } from "./ClickAwayListener";
import localStyles from "./ContextMenu.module.scss";

type Props = {
  isVisible: boolean;
  children: ReactNode;
  offsetX?: number;
  offsetY?: number;
  placement?: string;
  onClickAway?: () => void;
};

export const ContextMenu = ({
  isVisible,
  children,
  offsetX,
  offsetY,
  placement = "bottom-start",
  onClickAway
}: Props) => {
  const [popperElement, setPopperElement] = useState(null);
  const [referenceElement, setReferenceElement] = useState<HTMLElement>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
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
      <div ref={el => setReferenceElement(el)}></div>
      {isVisible && (
          <div
            ref={setPopperElement}
            className={localStyles.contextMenu}
            style={styles.popper}
            {...attributes.popper}
          >
            {children}
          </div>
      )}
    </>
  );
};

type ContextMenuItemProps = {
  text?: string;
  disabled?: boolean;
};

export const ContextMenuItem = ({ text, disabled }: ContextMenuItemProps) => {
  return (
    <div
      className={classnames(localStyles.menuItem, {
        [localStyles.disabled]: disabled
      })}
    >
      {text}
    </div>
  );
};

export const ContextMenuSeparator = () => {
  return <div className={localStyles.separator}></div>
}
