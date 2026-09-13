import classnames from "classnames";
import {
  MouseEvent as ReactMouseEvent,
  ReactNode,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useState
} from "react";
import { Icon } from "./Icon";
import { usePopper } from "react-popper";
import localStyles from "./ContextMenu.module.scss";
import { createPortal } from "react-dom";
import { getOverlayRoot } from "./overlay/useOverlayRoot";

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
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
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
  const rootElement = getOverlayRoot();

  /*
   * Arrow-key navigation.
   *
   * The menu had no keyboard path at all: items were `<div>`s with an `onClick`, so a menu opened
   * from a keyboard-reachable control could only be dismissed, never used. Items are now
   * `role="menuitem"` buttons and this moves focus between the enabled ones; Enter and Space come
   * free with the button element, and Escape was already handled above.
   */
  const items = useCallback(
    (): HTMLElement[] =>
      popperElement
        ? Array.from(
            popperElement.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')
          )
        : [],
    [popperElement]
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      const list = items();
      if (!list.length) return;
      const current = list.indexOf(document.activeElement as HTMLElement);
      let next: number | undefined;
      switch (e.code) {
        case "ArrowDown":
          next = current < 0 ? 0 : (current + 1) % list.length;
          break;
        case "ArrowUp":
          next = current <= 0 ? list.length - 1 : current - 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = list.length - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
      list[next]?.focus();
    },
    [items]
  );

  // Move focus into the menu when it opens, so the first arrow key does not need a mouse first.
  useEffect(() => {
    if (!state.contextVisible) return;
    items()[0]?.focus();
  }, [state.contextVisible, items]);

  useEffect(() => {
    const handleOutsideClick = (event: globalThis.MouseEvent) => {
      if (popperElement && !popperElement.contains(event.target as Node)) {
        onClickOutside?.();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        onClickOutside?.();
      }
    };

    if (state.contextVisible) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [state.contextVisible, popperElement, onClickOutside]);

  return (
    <>
      {state.contextVisible &&
        createPortal(
          <div
            ref={setPopperElement}
            tabIndex={-1}
            role="menu"
            className={localStyles.contextMenu}
            style={{ ...styles.popper, zIndex: 9999 }}
            onKeyDown={onKeyDown}
            {...attributes.popper}
          >
            {children}
          </div>,
          rootElement
        )}
    </>
  );
};

type ContextMenuItemProps = {
  dangerous?: boolean;
  text?: string;
  disabled?: boolean;
  clicked?: () => void;
  /** Leading icon, so a row can carry the same mark as the thing it stands for. */
  iconName?: string;
  /** Fill colour for `iconName`, as a theme token name. */
  iconFill?: string;
  /** Right-aligned annotation — a dirty marker, a hint, a state word. */
  trailing?: ReactNode;
  /** Renders the row as the current selection. */
  selected?: boolean;
};

export const ContextMenuItem = ({
  dangerous,
  text,
  disabled,
  clicked,
  iconName,
  iconFill,
  trailing,
  selected
}: ContextMenuItemProps) => {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-current={selected || undefined}
      className={classnames(localStyles.menuItem, {
        [localStyles.dangerous]: dangerous,
        [localStyles.disabled]: disabled,
        [localStyles.selected]: selected
      })}
      onMouseDown={(e) => {
        // Keep focus where it was for mouse users; the click still fires.
        if (e.button === 0) {
          e.preventDefault();
        }
      }}
      onClick={() => {
        if (!disabled) clicked?.();
      }}
    >
      {iconName && (
        <span className={localStyles.menuItemIcon}>
          <Icon iconName={iconName} width={16} height={16} fill={iconFill} />
        </span>
      )}
      <span className={localStyles.menuItemText}>{text}</span>
      {trailing !== undefined && <span className={localStyles.menuItemTrailing}>{trailing}</span>}
    </button>
  );
};

export const ContextMenuSeparator = () => {
  return <div className={localStyles.separator}></div>;
};

export interface IContextMenuApi {
  show(e: ReactMouseEvent): void;
  /**
   * Open the menu anchored to an element rather than to a click.
   *
   * A context menu is opened by pointer, but a menu hung off a *button* has no click coordinates to
   * anchor to — and shared controls like `SmallIconButton` deliberately do not hand their event to
   * the caller. Anchoring to the element is also what makes the menu appear in the same place
   * whether it was opened by mouse or by keyboard.
   */
  showAt(element: HTMLElement | null | undefined): void;
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
      showAt: (element) => {
        if (!element) return;
        setState({
          contextVisible: true,
          contextRef: element,
          contextX: 0,
          contextY: 0
        });
      },
      conceal: () => {
        setState((prev) => ({
          ...prev,
          contextVisible: false
        }));
      }
    }
  ];
};
