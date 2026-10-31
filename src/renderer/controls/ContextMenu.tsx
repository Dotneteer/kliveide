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
  /** Opened by `showAt` from a trigger: a second press on the trigger closes the menu */
  anchored?: boolean;
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
            popperElement.querySelectorAll<HTMLElement>(
              '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])'
            )
          )
        : [],
    [popperElement]
  );

  /*
   * The focus ring shows only once the user moves through the menu with the keyboard. Opening the
   * menu focuses its first row (so the first arrow key works), and Chromium treats that programmatic
   * focus as `:focus-visible` even after a mouse click, which put a ring on a row nobody chose.
   */
  const [keyboardNav, setKeyboardNav] = useState(false);
  useEffect(() => {
    if (!state.contextVisible) setKeyboardNav(false);
  }, [state.contextVisible]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "Home", "End", "Tab"].includes(e.code)) setKeyboardNav(true);
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
      const target = event.target as Node;
      // --- A press on the trigger is the trigger's own: its click toggles the menu (`showAt`).
      // --- Closing here too would let that click reopen the menu at once.
      if (state.anchored && state.contextRef?.contains(target)) return;
      if (popperElement && !popperElement.contains(target)) {
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
  }, [state.contextVisible, state.anchored, state.contextRef, popperElement, onClickOutside]);

  return (
    <>
      {state.contextVisible &&
        createPortal(
          <div
            ref={setPopperElement}
            tabIndex={-1}
            role="menu"
            className={classnames(localStyles.contextMenu, {
              [localStyles.keyboardNav]: keyboardNav
            })}
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
  /**
   * Makes the row an on/off switch (`menuitemcheckbox`). While on, its icon gets the toolbar's
   * selection border, so a toolbar button folded into a menu keeps the look it had on the strip.
   */
  toggled?: boolean;
  /**
   * Draws the icon in the switch's (empty) frame, so a plain command's icon lines up with the
   * switches' icons in the same menu; without an `iconName` it keeps the frame's room empty.
   */
  framedIcon?: boolean;
};

export const ContextMenuItem = ({
  dangerous,
  text,
  disabled,
  clicked,
  iconName,
  iconFill,
  trailing,
  selected,
  toggled,
  framedIcon
}: ContextMenuItemProps) => {
  const isSwitch = toggled !== undefined;
  return (
    <button
      type="button"
      role={isSwitch ? "menuitemcheckbox" : "menuitem"}
      aria-checked={isSwitch ? toggled : undefined}
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
      {(iconName || framedIcon) && (
        <span
          className={classnames(localStyles.menuItemIcon, {
            [localStyles.toggleIcon]: isSwitch || framedIcon,
            [localStyles.toggledOn]: toggled
          })}
        >
          {iconName ? (
            <Icon iconName={iconName} width={16} height={16} fill={iconFill} />
          ) : (
            <span className={localStyles.noIcon} />
          )}
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
   * whether it was opened by mouse or by keyboard. Calling it again with the same element while the
   * menu is open closes it, so the trigger toggles its menu. `toggle: false` is for an anchor that is
   * not a trigger (a whole strip a right-click opens the menu on): a press on it closes the menu
   * like a press anywhere else, and the next right-click opens it again.
   */
  showAt(element: HTMLElement | null | undefined, options?: { toggle?: boolean }): void;
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
          contextY: rc ? e.clientY - rc.bottom : 0,
          anchored: false
        });
      },
      // --- Toggles: the trigger that opened the menu closes it again
      showAt: (element, options) => {
        if (!element) return;
        const toggle = options?.toggle ?? true;
        setState((prev) =>
          toggle && prev.contextVisible && prev.contextRef === element
            ? { ...prev, contextVisible: false }
            : { contextVisible: true, contextRef: element, contextX: 0, contextY: 0, anchored: toggle }
        );
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
