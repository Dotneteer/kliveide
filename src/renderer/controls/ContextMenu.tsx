import classnames from "classnames";
import { MouseEvent, ReactNode, useEffect, useState } from "react";
import { usePopper } from "react-popper";
import localStyles from "./ContextMenu.module.scss";
import { createPortal } from "react-dom";

export type ContextMenuState = {
  contextVisible: boolean;
  contextRef?: HTMLElement;
  contextX: number;
  contextY: number;
};

type Props = {
  children: ReactNode;
  state: ContextMenuState;
  onClickOutside?: () => void;
  placement?: string;
};

export const ContextMenu = ({
  children,
  state,
  placement = "bottom-start",
  onClickOutside
}: Props) => {
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(state.contextRef, popperElement, {
    placement: placement as any,
    strategy: "absolute",
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [state.contextX, state.contextY]
        }
      }
    ]
  });
  const rootElement = document.getElementById("themeRoot");

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (popperElement && !popperElement.contains(event.target as Node)) {
        onClickOutside?.();
      }
    };

    if (state.contextVisible) {
      document.addEventListener("mousedown", handleOutsideClick as any);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick as any);
    };
  }, [state.contextVisible, popperElement, onClickOutside]);

  return (
    <>
      {state.contextVisible &&
        createPortal(
          <div
            ref={setPopperElement}
            tabIndex={-1}
            
            className={localStyles.contextMenu}
            style={{ ...styles.popper, zIndex: 9999 }}
            {...attributes.popper}
          >
            {children}
          </div>,
          rootElement || document.body
        )}
    </>
  );
};

type ContextMenuItemProps = {
  dangerous?: boolean;
  text?: string;
  disabled?: boolean;
  clicked?: () => void;
};

export const ContextMenuItem = ({ dangerous, text, disabled, clicked }: ContextMenuItemProps) => {
  return (
    <div
      className={classnames(localStyles.menuItem, {
        [localStyles.dangerous]: dangerous,
        [localStyles.disabled]: disabled
      })}
      onMouseDown={(e) => {
        if (!disabled) {
          if (e.button === 0) clicked?.();
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

export interface IContextMenuApi {
  show(e: MouseEvent): void;
  conceal(): void;
}

export const useContextMenuState = (): [ContextMenuState, IContextMenuApi] => {
  const [state, setState] = useState<ContextMenuState>({
    contextVisible: false,
    contextRef: null,
    contextX: 0,
    contextY: 0
  });

  return [
    state,
    {
      show: (e) => {
        const t = e.target as HTMLElement;
        const rc = t?.getBoundingClientRect();
        setState({
          contextVisible: true,
          contextRef: t,
          contextX: rc ? e.clientX - rc.left : 0,
          contextY: rc ? e.clientY - rc.bottom : 0
        });
      },
      conceal: () => {
        setState({
          ...state,
          contextVisible: false
        });
      }
    }
  ];
};
