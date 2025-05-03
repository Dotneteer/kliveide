import React, { useState, useMemo, ReactNode } from "react";
import { usePopper } from "react-popper";
import { createPortal } from "react-dom";
import { ClickAwayListener } from "./ClickAwayListener";
import localStyles from "./ContextMenu.module.scss";

type Props = {
  children: ReactNode;
  placement?: string;
  onClickAway?: () => void;
};

const ContextMenu = ({ children, onClickAway }: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);

  // Dynamically create a virtual element based on current mouse position
  const virtualReference = useMemo(() => {
    if (!mousePosition) return null;

    return {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: mousePosition.y,
        left: mousePosition.x,
        right: mousePosition.x,
        bottom: mousePosition.y,
        x: mousePosition.x,
        y: mousePosition.y,
        toJSON: () => {}
      })
    };
  }, [mousePosition]);

  const { styles, attributes } = usePopper(virtualReference, popperElement, {
    placement: "right-start",
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [0, 0]
        }
      }
    ]
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMousePosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleClick = () => setShowMenu(false);

  return (
    <ClickAwayListener mouseEvent="mousedown" onClickAway={() => onClickAway?.()}>
      <div onContextMenu={handleContextMenu} onClick={handleClick} style={{ height: "100vh" }} >
        <p>Right</p>
        {showMenu &&    
          mousePosition &&
          virtualReference &&
          createPortal(
            <div
              ref={setPopperElement}
              style={{ ...styles.popper, zIndex: 9999 }}
              {...attributes.popper}
            >
              {children}
            </div>,
            document.body
          )}
      </div>
    </ClickAwayListener>
  );
};

export default ContextMenu;
