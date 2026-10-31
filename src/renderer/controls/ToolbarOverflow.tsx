/*
 * Toolbar overflow: what a toolbar does when its window is too narrow for all its buttons.
 *
 * The emulator window can be 640px wide, and with every machine feature on (the Next's mouse, a
 * tape, reverse debugging) its toolbar needs more than that. A toolbar of fixed-size buttons must
 * not shrink them, and wrapping would change the toolbar's height, from which the emulator window
 * computes its size. So, only while the strip lacks room, its groups give way in two steps:
 *
 *  1. A group with a `collapse` button folds into that one button, which opens its commands as a
 *     menu (the display switches become one "View options" button). Every such group folds before
 *     any group leaves.
 *  2. A group leaves the strip, lowest `priority` first, and its commands appear in the "More" menu
 *     at the end of the strip.
 *
 * They come back in the reverse order as soon as there is room again: the highest-priority group
 * that left returns first (folded, if it can fold), and the folded groups open up last.
 *
 * - `ToolbarOverflowProvider` wraps the strip and measures it. `stripRef` must point at the element
 *   whose children are the toolbar's items (the flex row).
 * - `ToolbarGroup` wraps one group. Its `overflowItems` are its commands as menu items; its leading
 *   separator goes inside it (`separator`), so a hidden group leaves no double divider.
 * - `ToolbarOverflowButton` is the "More" button; it renders only while a group is out.
 *
 * Without a provider (a test that renders a control alone) a group always shows in full.
 */
import {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenuState } from "./ContextMenu";
import { SECONDARY_ICON_SIZE, TOOLBAR_BUTTON_SIZE } from "./toolbar-constants";
import { useT } from "@common/i18n/useT";
import styles from "./ToolbarOverflow.module.scss";

/** One command of a group, as a menu item */
export type ToolbarOverflowItem = {
  id: string;
  text: string;
  /** The button's own icon, so the item looks like the button it stands for */
  iconName?: string;
  iconFill?: string;
  /** An on/off switch: its icon gets the toolbar's selection border while on */
  toggled?: boolean;
  /** The current choice of a set (a sound level) */
  selected?: boolean;
  disabled?: boolean;
  clicked: () => void | Promise<void>;
};

/** 0: every button shown; 1: folded into its collapse button; 2: in the More menu */
export type ToolbarGroupLevel = 0 | 1 | 2;

type GroupEntry = {
  priority: number;
  collapsible: boolean;
  /** Widths with the strip's gap after them, measured while the group showed that way */
  fullWidth: number;
  collapsedWidth: number;
  /** Its left edge while it was shown: the More menu lists groups in toolbar order */
  left: number;
  items: ToolbarOverflowItem[];
};

type OverflowContextValue = {
  levelOf: (id: string) => ToolbarGroupLevel;
  update: (id: string, entry: Partial<GroupEntry>) => void;
  remove: (id: string) => void;
  /** Re-check the fit after something in the strip changed size */
  refit: () => void;
  /** The hidden groups' items, group by group, in toolbar order */
  hiddenItems: () => ToolbarOverflowItem[][];
  anyHidden: boolean;
};

const OverflowContext = createContext<OverflowContextValue | null>(null);

/** The strip's own horizontal gap between items, which a removed group gives back too */
const gapOf = (strip: HTMLElement) => parseFloat(getComputedStyle(strip).columnGap) || 0;

export type OverflowGroupState = {
  id: string;
  priority: number;
  collapsible: boolean;
  fullWidth: number;
  collapsedWidth: number;
  level: ToolbarGroupLevel;
};

const lowest = <T extends { priority: number }>(list: T[]) =>
  list.reduce((a, b) => (b.priority < a.priority ? b : a));
const highest = <T extends { priority: number }>(list: T[]) =>
  list.reduce((a, b) => (b.priority > a.priority ? b : a));

/**
 * Decides, from the current layout, which group changes level next — or none.
 *
 * `slack` is the room left at the right end of the strip (negative when it overflows). One step at
 * a time: the caller applies it, the strip re-lays out, and the next measurement decides again.
 */
export function nextOverflowStep(
  slack: number,
  groups: OverflowGroupState[],
  moreButtonWidth: number
): { id: string; level: ToolbarGroupLevel } | null {
  if (slack < -0.5) {
    // --- Fold first: a folded group keeps its commands one click away on the strip
    const foldable = groups.filter((g) => g.collapsible && g.level === 0);
    if (foldable.length) return { id: lowest(foldable).id, level: 1 };
    const shown = groups.filter((g) => g.level < 2);
    return shown.length ? { id: lowest(shown).id, level: 2 } : null;
  }
  const hidden = groups.filter((g) => g.level === 2);
  if (hidden.length) {
    const back = highest(hidden);
    const width = back.collapsible ? back.collapsedWidth : back.fullWidth;
    // --- The last group to come back also takes the More button away
    const freed = hidden.length === 1 ? moreButtonWidth : 0;
    return slack + freed >= width ? { id: back.id, level: back.collapsible ? 1 : 0 } : null;
  }
  const folded = groups.filter((g) => g.level === 1);
  if (folded.length) {
    const open = highest(folded);
    return slack >= open.fullWidth - open.collapsedWidth ? { id: open.id, level: 0 } : null;
  }
  return null;
}

type ProviderProps = {
  stripRef: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export const ToolbarOverflowProvider = ({ stripRef, children }: ProviderProps) => {
  const groups = useRef(new Map<string, GroupEntry>());
  const [levels, setLevels] = useState<Record<string, ToolbarGroupLevel>>({});
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const [fitRequest, setFitRequest] = useState(0);

  const refit = useCallback(() => setFitRequest((n) => n + 1), []);

  const fit = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    if (rect.width === 0) return;
    const style = getComputedStyle(strip);
    const contentRight = rect.right - (parseFloat(style.paddingRight) || 0);
    let usedRight = rect.left + (parseFloat(style.paddingLeft) || 0);
    for (const child of Array.from(strip.children)) {
      const r = child.getBoundingClientRect();
      if (r.width > 0) usedRight = Math.max(usedRight, r.right);
    }
    const more = strip.querySelector<HTMLElement>("[data-toolbar-more]");
    const moreWidth = more ? more.getBoundingClientRect().width + gapOf(strip) : 0;
    const step = nextOverflowStep(
      contentRight - usedRight,
      Array.from(groups.current.entries()).map(([id, g]) => ({
        id,
        priority: g.priority,
        collapsible: g.collapsible,
        fullWidth: g.fullWidth,
        collapsedWidth: g.collapsedWidth,
        level: levelsRef.current[id] ?? 0
      })),
      moreWidth
    );
    if (step) setLevels((l) => ({ ...l, [step.id]: step.level }));
  }, [stripRef]);

  // --- Every change of a level, and every request, re-measures before the paint
  useLayoutEffect(() => {
    fit();
  }, [fit, levels, fitRequest]);

  // --- The window's width
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => fit());
    observer.observe(strip);
    return () => observer.disconnect();
  }, [fit, stripRef]);

  const value = useMemo<OverflowContextValue>(() => {
    const hidden = Object.keys(levels).filter((id) => levels[id] === 2);
    return {
      levelOf: (id) => levels[id] ?? 0,
      update: (id, entry) => {
        const prev = groups.current.get(id);
        groups.current.set(id, {
          priority: 0,
          collapsible: false,
          fullWidth: 0,
          collapsedWidth: 0,
          left: 0,
          items: [],
          ...prev,
          ...entry
        });
      },
      remove: (id) => {
        groups.current.delete(id);
        if (levelsRef.current[id] !== undefined) {
          setLevels((l) => {
            const { [id]: _removed, ...rest } = l;
            return rest;
          });
        }
      },
      refit,
      hiddenItems: () =>
        hidden
          .map((id) => groups.current.get(id))
          .filter((g): g is GroupEntry => !!g && g.items.length > 0)
          .sort((a, b) => a.left - b.left)
          .map((g) => g.items),
      anyHidden: hidden.length > 0
    };
  }, [levels, refit]);

  return <OverflowContext.Provider value={value}>{children}</OverflowContext.Provider>;
};

/**
 * A group's commands as menu items: the toolbar's icons, a switch's selection border, and an empty
 * icon slot for a command without an icon, so every label starts at the same column
 */
const OverflowMenuItems = ({ items, close }: { items: ToolbarOverflowItem[]; close: () => void }) => (
  <>
    {items.map((item) => (
      <ContextMenuItem
        key={item.id}
        text={item.text}
        iconName={item.iconName}
        // --- A disabled command's icon dims, as a disabled toolbar button's does
        iconFill={item.disabled ? "--text-disabled" : item.iconFill}
        toggled={item.toggled}
        framedIcon
        selected={item.selected}
        disabled={item.disabled}
        clicked={async () => {
          close();
          await item.clicked();
        }}
      />
    ))}
  </>
);

type GroupProps = {
  /** Stable, unique within the toolbar */
  id: string;
  /** Higher stays longer: the lowest-priority group leaves first */
  priority: number;
  /** The group's commands, as its folded menu and the More menu show them */
  overflowItems: ToolbarOverflowItem[];
  /** The one button the group folds into while the strip is short of room; no folding without it */
  collapse?: { iconName: string; title: string };
  /** A separator before the group, which leaves with it */
  separator?: boolean;
  children: ReactNode;
};

export const ToolbarGroup = ({ id, priority, overflowItems, collapse, separator, children }: GroupProps) => {
  const ctx = useContext(OverflowContext);
  const ref = useRef<HTMLDivElement>(null);
  const level = ctx?.levelOf(id) ?? 0;
  const [menu, menuApi] = useContextMenuState();

  // --- The folded menu belongs to the folded button: when the group opens up or leaves, the menu
  // --- closes, or it would reopen at the next fold anchored to a button that no longer exists
  const menuOpen = menu.contextVisible;
  useEffect(() => {
    if (level !== 1 && menuOpen) menuApi.conceal();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- menuApi is a new object every render
  }, [level, menuOpen]);

  // --- The latest items and priority, every render: the menus read them when they open
  ctx?.update(id, { priority, collapsible: !!collapse, items: overflowItems });

  // --- Measure while shown; a change of size (a group gaining a button) re-checks the fit
  useLayoutEffect(() => {
    const el = ref.current;
    if (!ctx || level === 2 || !el) return undefined;
    const measure = () => {
      const strip = el.parentElement;
      const width = el.getBoundingClientRect().width + (strip ? gapOf(strip) : 0);
      ctx.update(id, {
        ...(level === 0 ? { fullWidth: width } : { collapsedWidth: width }),
        left: el.getBoundingClientRect().left
      });
    };
    measure();
    ctx.refit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      measure();
      ctx.refit();
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx changes with every level change
  }, [level, id]);

  useEffect(() => {
    return () => ctx?.remove(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remove once, on unmount
  }, [id]);

  if (level === 2) return null;
  return (
    <div ref={ref} className={styles.group} data-toolbar-group={id} data-toolbar-level={level}>
      {separator && <ToolbarSeparator />}
      {level === 1 && collapse ? (
        <>
          <IconButton
            iconName={collapse.iconName}
            iconSize={SECONDARY_ICON_SIZE}
            buttonWidth={TOOLBAR_BUTTON_SIZE}
            buttonHeight={TOOLBAR_BUTTON_SIZE}
            fill="--color-toolbarbutton"
            title={collapse.title}
            clicked={(e) => menuApi.showAt(e.currentTarget)}
          />
          {menu.contextVisible && (
            <ContextMenu state={menu} onClickOutside={menuApi.conceal}>
              <OverflowMenuItems items={overflowItems} close={menuApi.conceal} />
            </ContextMenu>
          )}
        </>
      ) : (
        children
      )}
    </div>
  );
};

/** The "More" button and its menu; nothing while every group fits */
export const ToolbarOverflowButton = () => {
  const t = useT();
  const ctx = useContext(OverflowContext);
  const [menu, menuApi] = useContextMenuState();
  const anyHidden = !!ctx?.anyHidden;
  const menuOpen = menu.contextVisible;

  // --- This component stays mounted while it renders nothing, so its menu must close with the
  // --- button: otherwise it reopens at the next overflow, anchored to the detached old button
  useEffect(() => {
    if (!anyHidden && menuOpen) menuApi.conceal();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- menuApi is a new object every render
  }, [anyHidden, menuOpen]);

  if (!ctx || !anyHidden) return null;
  const sections = ctx.hiddenItems();
  return (
    <div className={styles.group} data-toolbar-more>
      <ToolbarSeparator />
      <IconButton
        iconName="chevrons-right"
        iconSize={SECONDARY_ICON_SIZE}
        buttonWidth={TOOLBAR_BUTTON_SIZE}
        buttonHeight={TOOLBAR_BUTTON_SIZE}
        fill="--color-toolbarbutton"
        title={t("toolbar.more")}
        clicked={(e) => menuApi.showAt(e.currentTarget)}
      />
      {menu.contextVisible && (
        <ContextMenu state={menu} placement="bottom-end" onClickOutside={menuApi.conceal}>
          {sections.map((items, i) => (
            <div key={items[0]?.id ?? i} role="none">
              {i > 0 && <ContextMenuSeparator />}
              <OverflowMenuItems items={items} close={menuApi.conceal} />
            </div>
          ))}
        </ContextMenu>
      )}
    </div>
  );
};
