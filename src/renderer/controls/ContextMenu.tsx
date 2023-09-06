import classnames from "@renderer/utils/classnames";
import { MouseEvent, ReactNode, useRef, useState } from "react";
import { usePopper } from "react-popper";
import { ClickAwayListener } from "./ClickAwayListener";
import localStyles from "./ContextMenu.module.scss";

export type ContextMenuState = {
  contextVisible: boolean;
  contextRef?: HTMLElement;
  contextX: number;
  contextY: number;
};

export interface IContextMenuApi {
  show (e: MouseEvent): void;
  conceal (): void;
}

// export class ContextMenuState implements ContextMenuStateInfo {

//   public readonly contextRef: any;
//   public readonly contextVisible: boolean;
//   public readonly contextX: number;
//   public readonly contextY: number;

//   readonly setContextRef: React.Dispatch<any>;
//   readonly setContextVisible: React.Dispatch<boolean>;
//   readonly setContextX: React.Dispatch<number>;
//   readonly setContextY: React.Dispatch<number>;

//   constructor(
//       contextRef: [any, React.Dispatch<any>],
//       contextVisible: [boolean, React.Dispatch<boolean>],
//       contextX: [number, React.Dispatch<number>],
//       contextY: [number, React.Dispatch<number>],
//     ) {
//       [this.contextRef, this.setContextRef] = contextRef;
//       [this.contextVisible, this.setContextVisible] = contextVisible;
//       [this.contextX, this.setContextX] = contextX;
//       [this.contextY, this.setContextY] = contextY;
//     // [this.contextRef, this.setContextRef] = useState(null);
//     // [this.contextVisible, this.setContextVisible] = useState(false);
//     // [this.contextX, this.setContextX] = useState(0);
//     // [this.contextY, this.setContextY] = useState(0);
//   }

//   public show (e: MouseEvent): void {
//     const t = e.target as HTMLElement;
//     this.setContextRef(t);
//     const rc = t?.getBoundingClientRect();
//     this.setContextX(rc ? e.clientX - rc.left : 0);
//     this.setContextY(rc ? e.clientY - rc.bottom : 0);
//     this.setContextVisible(true);
//   }

//   public conceal (): void {
//     this.setContextVisible(false);
//   }
// }

export const useContextMenuState = (): [ ContextMenuState, IContextMenuApi ]  => {
  const [state, setState] = useState<ContextMenuState>({
    contextVisible: false,
    contextRef: null,
    contextX: 0,
    contextY: 0,
  });

  return [
    state,
    {
      show: e => {
        const t = e.target as HTMLElement;
        const rc = t?.getBoundingClientRect();
        setState({
          contextVisible:true,
          contextRef: t,
          contextX: rc ? e.clientX - rc.left : 0,
          contextY: rc ? e.clientY - rc.bottom : 0
        })
      },
      conceal: () => {
        setState({
          ...state,
          contextVisible: false
        })
      }
    }
  ];
};

type Props = {
  children: ReactNode;
  state: ContextMenuState;
  placement?: string;
  onClickAway?: () => void;
};

export const ContextMenu = ({
  children,
  state,
  placement = "bottom-start",
  onClickAway
}: Props) => {
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(state.contextRef, popperElement, {
    placement: placement as any,
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [state.contextX, state.contextY]
        }
      }
    ]
  });
  return (
    <>
      {state.contextVisible && (
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
