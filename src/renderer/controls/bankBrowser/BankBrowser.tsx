import classnames from "classnames";
import {
  CSSProperties,
  Fragment,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { Icon } from "@renderer/controls/Icon";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import ScrollViewer, { type ScrollViewerApi } from "@renderer/controls/ScrollViewer";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import styles from "./BankBrowser.module.scss";

/*
 * A file's banks: a list on one side and the selected bank's details on the other, with every bank
 * poppable into its own document.
 *
 * Extracted from the NEX viewer's bank browser so the `.z88` viewer's slots can use the same shape
 * (`.plans/Z88_SLOT_BROWSER_PLAN.md`). The shell owns what both share - the heading and filters, the
 * list and its keyboard, the details frame with its split pop-out button, the row menu - and knows
 * nothing about NEX annotations or Z88 cards: the caller hands it items and renders their content.
 *
 * **Bounded, with its own scroll.** The browser is as tall as the viewer's visible area, and only the
 * bank list (and, when it is taller than the space, the details) scrolls inside it. It used to grow
 * with the list inside the viewer's scroll, with the details made `sticky` - which never stuck,
 * because the body's `overflow: hidden` (for its rounded corners) is the box a sticky child sticks
 * to. Scrolling to the last of a long list carried the selected bank's details off the top.
 */

/**
 * The height of the scrolling viewport that holds `ref`, kept current as it resizes.
 *
 * A viewer scrolls inside an OverlayScrollbars viewport (`ScrollViewer`), else inside the nearest
 * ancestor that scrolls. `undefined` until measured, or with no such ancestor - the stylesheet then
 * falls back to a share of the window.
 */
function useViewportHeight(ref: RefObject<HTMLElement>): number | undefined {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const viewport = findScrollViewport(element);
    if (!viewport) return undefined;
    const update = () => setHeight(viewport.clientHeight || undefined);
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

function findScrollViewport(element: HTMLElement): HTMLElement | undefined {
  const overlay = element.parentElement?.closest<HTMLElement>("[data-overlayscrollbars-viewport]");
  if (overlay) return overlay;
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflowY = getComputedStyle(node).overflowY;
    if (overflowY === "auto" || overflowY === "scroll") return node;
  }
  return undefined;
}

/** What the shell needs of an item; callers extend it with their own fields. */
export type BankBrowserItem<V extends string = string> = {
  /** Unique within the list. */
  key: string;
  bank: number;
  /** The view a pop-out opens in. */
  lastView: V;
};

/** A heading in the list above the first item of a group. Not an option: the keyboard skips it. */
export type BankBrowserGroup = {
  key: string;
  label: ReactNode;
};

export type BankBrowserFilterOption = { value: string; text: string };

type Props<T extends BankBrowserItem<V>, V extends string> = {
  /** All items, to summarise; `visibleItems` is what the filter leaves. */
  visibleItems: T[];
  selectedKey?: string;
  heading: string;
  summary: ReactNode;
  filters: BankBrowserFilterOption[];
  filter: string;
  /** The views a bank pops out in, in menu order. */
  views: V[];
  viewNames: Record<V, string>;
  onSelect: (item: T) => void;
  onFilterChange: (filter: string) => void;
  onPopOut: (item: T, view: V) => void;
  /** The group an item belongs to; a header is drawn wherever it changes. */
  groupOf?: (item: T) => BankBrowserGroup | undefined;
  /** A row's content between its bank number and its pop-out icon. */
  renderRow: (item: T) => ReactNode;
  /** Chips beside the details title. */
  renderDetailsMarks?: (item: T) => ReactNode;
  /** Everything below the details head. */
  renderDetails: (item: T) => ReactNode;
  /** Items after "Pop Out" in a row's context menu; `close` conceals the menu. */
  renderRowMenuItems?: (item: T, close: () => void) => ReactNode;
  hint?: ReactNode;
  /**
   * What one item is called, in the details title, the pop-out tooltips, the list's aria label and
   * the empty-filter text. "Bank" by default; the tape viewer's items are "Block"s.
   */
  itemNoun?: string;
  /**
   * An item's number as the row and the details title show it. `$NN` by default, with the decimal
   * beside it in the details; a caller that supplies this gets no decimal, since its own form is
   * presumably already the one meant to be read.
   */
  formatNumber?: (item: T) => string;
  /**
   * The views this item can pop out in, when not every item can use every view (a tape's header has
   * no BASIC listing). Defaults to `views`. An item with none has no pop-out controls at all.
   */
  viewsFor?: (item: T) => V[];
  /** Content between the heading and the list - the tape viewer's timeline strip. */
  beforeBody?: ReactNode;
};

const defaultNumber = (item: BankBrowserItem) => `$${toHexa2(item.bank)}`;

export function BankBrowser<T extends BankBrowserItem<V>, V extends string>({
  visibleItems: visible,
  selectedKey,
  heading,
  summary,
  filters,
  filter,
  views,
  viewNames,
  onSelect,
  onFilterChange,
  onPopOut,
  groupOf,
  renderRow,
  renderDetailsMarks,
  renderDetails,
  renderRowMenuItems,
  hint,
  itemNoun = "Bank",
  formatNumber,
  viewsFor,
  beforeBody
}: Props<T, V>) {
  const numberOf = formatNumber ?? defaultNumber;
  const viewsOf = viewsFor ?? (() => views);
  const canPopOut = (item: T) => viewsOf(item).length > 0;
  const selected = visible.find((item) => item.key === selectedKey) ?? visible[0] ?? undefined;
  const listRef = useRef<HTMLDivElement | null>(null);
  const browserRef = useRef<HTMLElement>(null);
  const viewportHeight = useViewportHeight(browserRef);

  /*
   * Bring the selected row into the list's view when the list is shown or refiltered: a remembered
   * selection can be far down a long list. Through the list's own scroller, not `scrollIntoView`,
   * which would also scroll the viewer around the browser. OverlayScrollbars initialises after the
   * first render, so this waits for its API.
   */
  const [listScroller, setListScroller] = useState<ScrollViewerApi>();
  const filterKey = `${filter}:${visible.length}`;
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = Array.from(list?.querySelectorAll<HTMLElement>("[data-key]") ?? []).find(
      (r) => r.dataset.key === selected?.key
    );
    const viewport = list?.closest<HTMLElement>("[data-overlayscrollbars-viewport]");
    if (!listScroller || !row || !viewport) return;
    const top = row.offsetTop;
    const scrollTop = listScroller.getScrollTop();
    if (top < scrollTop || top + row.offsetHeight > scrollTop + viewport.clientHeight) {
      listScroller.scrollToVertical(
        Math.max(0, top - (viewport.clientHeight - row.offsetHeight) / 2)
      );
    }
    // --- Only on showing and refiltering: a click or a key already keeps the row in view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, viewportHeight, listScroller]);
  const [rowMenuState, rowMenuApi] = useContextMenuState();
  const rowMenuItem = useRef<T>();

  const focusRow = (key: string) =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-key]") ?? [])
      .find((row) => row.dataset.key === key)
      ?.focus();

  const listKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selected || visible.length === 0) return;
    const index = visible.indexOf(selected);
    const moves: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 8,
      PageUp: -8,
      Home: -visible.length,
      End: visible.length
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      const next = visible[Math.max(0, Math.min(visible.length - 1, index + move))];
      onSelect(next);
      requestAnimationFrame(() => focusRow(next.key));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (canPopOut(selected)) onPopOut(selected, selected.lastView);
    }
  };

  const openRowMenu = (item: T, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onSelect(item);
    rowMenuItem.current = item;
    rowMenuApi.show(event);
  };

  let lastGroup: string | undefined;
  const rowMenuExtra = rowMenuItem.current
    ? renderRowMenuItems?.(rowMenuItem.current, rowMenuApi.conceal)
    : undefined;

  return (
    <section
      ref={browserRef}
      className={styles.browser}
      aria-label={heading}
      style={
        viewportHeight === undefined
          ? undefined
          : ({ "--bank-browser-height": `${viewportHeight}px` } as CSSProperties)
      }
    >
      <div className={styles.heading}>
        <span className={styles.title}>{heading}</span>
        <span className={styles.summary}>{summary}</span>
        <span className={styles.filters} role="group" aria-label={`Show ${heading.toLowerCase()}`}>
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.filter}
              aria-pressed={filter === option.value}
              onClick={() => onFilterChange(option.value)}
            >
              {option.text}
            </button>
          ))}
        </span>
      </div>

      {beforeBody}

      {visible.length === 0 ? (
        <div className={styles.none}>{`No ${itemNoun.toLowerCase()} matches this filter.`}</div>
      ) : (
        <div className={styles.body}>
          <ScrollViewer
            className={styles.listPane}
            allowHorizontal={false}
            thinScrollBar={true}
            apiLoaded={setListScroller}
          >
            <div
              ref={listRef}
              className={styles.list}
              role="listbox"
              aria-label={`${itemNoun} list`}
              onKeyDown={listKeyDown}
            >
              {visible.map((item) => {
                const group = groupOf?.(item);
                const header = group && group.key !== lastGroup ? group : undefined;
                lastGroup = group?.key;
                return (
                  <Fragment key={item.key}>
                    {header && (
                      <div className={styles.groupHeader} role="presentation">
                        {header.label}
                      </div>
                    )}
                    <BankRow
                      item={item}
                      selected={item === selected}
                      number={numberOf(item)}
                      itemNoun={itemNoun}
                      canPopOut={canPopOut(item)}
                      viewNames={viewNames}
                      onSelect={onSelect}
                      onPopOut={onPopOut}
                      onContextMenu={openRowMenu}
                    >
                      {renderRow(item)}
                    </BankRow>
                  </Fragment>
                );
              })}
            </div>
          </ScrollViewer>
          <ScrollViewer className={styles.detailsPane} allowHorizontal={false} thinScrollBar={true}>
            {selected && (
              <BankDetails
                item={selected}
                views={viewsOf(selected)}
                title={formatNumber ? numberOf(selected) : `${itemNoun} ${numberOf(selected)}`}
                decimal={formatNumber ? undefined : `(${selected.bank})`}
                itemNoun={itemNoun}
                viewNames={viewNames}
                marks={renderDetailsMarks?.(selected)}
                hint={hint}
                onPopOut={onPopOut}
              >
                {renderDetails(selected)}
              </BankDetails>
            )}
          </ScrollViewer>
        </div>
      )}

      <ContextMenu state={rowMenuState} onClickOutside={rowMenuApi.conceal}>
        {(!rowMenuItem.current || canPopOut(rowMenuItem.current)) && (
          <ContextMenuItem
            text={`Pop Out in ${
              rowMenuItem.current ? viewNames[rowMenuItem.current.lastView] : viewNames[views[0]]
            }`}
            clicked={() => {
              rowMenuApi.conceal();
              const item = rowMenuItem.current;
              if (item) onPopOut(item, item.lastView);
            }}
          />
        )}
        {rowMenuExtra && (
          <>
            <ContextMenuSeparator />
            {rowMenuExtra}
          </>
        )}
      </ContextMenu>
    </section>
  );
}

// ─── Rows ────────────────────────────────────────────────────────────────────

function BankRow<T extends BankBrowserItem<V>, V extends string>({
  item,
  selected,
  number,
  itemNoun,
  canPopOut,
  viewNames,
  onSelect,
  onPopOut,
  onContextMenu,
  children
}: {
  item: T;
  selected: boolean;
  number: string;
  itemNoun: string;
  canPopOut: boolean;
  viewNames: Record<V, string>;
  onSelect: (item: T) => void;
  onPopOut: (item: T, view: V) => void;
  onContextMenu: (item: T, event: MouseEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-key={item.key}
      data-bank={item.bank}
      className={classnames(styles.row, { [styles.rowSelected]: selected })}
      title={
        canPopOut ? `Double-click or Enter to pop out in ${viewNames[item.lastView]}` : undefined
      }
      onClick={() => onSelect(item)}
      onDoubleClick={() => canPopOut && onPopOut(item, item.lastView)}
      onContextMenu={(event) => onContextMenu(item, event)}
    >
      <span className={styles.bankNumber}>{number}</span>
      {children}
      {canPopOut ? (
        <button
          type="button"
          className={styles.rowPopOut}
          title={`Pop out ${itemNoun} ${number} (${viewNames[item.lastView]})`}
          aria-label={`Pop out ${itemNoun} ${number}`}
          onClick={(event) => {
            event.stopPropagation();
            onPopOut(item, item.lastView);
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Icon
            iconName="square-arrow-out-up-right"
            width={14}
            height={14}
            fill="--color-command-icon"
          />
        </button>
      ) : (
        <span className={styles.rowPopOutPlaceholder} aria-hidden="true" />
      )}
    </div>
  );
}

// ─── Details ─────────────────────────────────────────────────────────────────

function BankDetails<T extends BankBrowserItem<V>, V extends string>({
  item,
  views,
  title,
  decimal,
  itemNoun,
  viewNames,
  marks,
  hint,
  onPopOut,
  children
}: {
  item: T;
  views: V[];
  title: string;
  decimal?: string;
  itemNoun: string;
  viewNames: Record<V, string>;
  marks?: ReactNode;
  hint?: ReactNode;
  onPopOut: (item: T, view: V) => void;
  children: ReactNode;
}) {
  const [menuState, menuApi] = useContextMenuState();
  const moreRef = useRef<HTMLButtonElement | null>(null);

  return (
    <aside className={styles.details} aria-label={`${title} details`}>
      <div className={styles.detailsHead}>
        <span className={styles.detailsTitle}>
          <span className={styles.bankNumber}>{title}</span>
          {decimal && <span className={styles.decimal}>{decimal}</span>}
          {marks}
        </span>
        {views.length > 0 && (
          <span className={styles.split}>
            <button
              type="button"
              className={styles.splitMain}
              title={`Open this ${itemNoun.toLowerCase()} as its own document`}
              aria-label={`Pop out in ${viewNames[item.lastView]}`}
              onClick={() => onPopOut(item, item.lastView)}
            >
              <Icon
                iconName="square-arrow-out-up-right"
                width={14}
                height={14}
                fill="--text-on-accent"
              />
              Pop out
              <span className={styles.splitView}>{`· ${viewNames[item.lastView]}`}</span>
            </button>
            <button
              ref={moreRef}
              type="button"
              className={styles.splitMore}
              aria-haspopup="menu"
              aria-label="Pop out in another view"
              title="Pop out in another view"
              onClick={() => menuApi.showAt(moreRef.current)}
            >
              <Icon iconName="chevron-down" width={14} height={14} fill="--text-on-accent" />
            </button>
          </span>
        )}
        <ContextMenu state={menuState} onClickOutside={menuApi.conceal} placement="bottom-end">
          {views.map((view) => (
            <ContextMenuItem
              key={view}
              text={`Pop Out in ${viewNames[view]}`}
              selected={item.lastView === view}
              trailing={item.lastView === view ? "last used" : undefined}
              clicked={() => {
                menuApi.conceal();
                onPopOut(item, view);
              }}
            />
          ))}
        </ContextMenu>
      </div>

      {children}

      {hint && <div className={styles.hint}>{hint}</div>}
    </aside>
  );
}

// ─── Building blocks for the caller's content ────────────────────────────────

/** A pill on a row or beside the details title: PC, SP, a segment. */
export const BankChip = ({
  alt,
  tone,
  title,
  children
}: {
  /** The secondary accent, for a second kind of mark beside the first. */
  alt?: boolean;
  /**
   * A status, not a kind: a problem with the item (a tape block's bad checksum, a block Klive does
   * not play). Takes the app's status colour, never an accent.
   */
  tone?: "warning" | "error";
  title?: string;
  children: ReactNode;
}) => (
  <span
    className={classnames(styles.chip, {
      [styles.chipAlt]: alt,
      [styles.chipWarning]: tone === "warning",
      [styles.chipError]: tone === "error"
    })}
    title={title}
  >
    {children}
  </span>
);

/** The row's text after its chips: a comment, "empty", a note. Truncates. */
export const BankRowText = ({ title, children }: { title?: string; children: ReactNode }) => (
  <span className={styles.rowText} title={title}>
    {children}
  </span>
);

/** The details' fact list: alternate `<dt>` and `<dd>` children. */
export const BankFacts = ({ children }: { children: ReactNode }) => (
  <dl className={styles.facts}>{children}</dl>
);

/** A titled block in the details. */
export const BankDetailsSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className={styles.section}>
    <div className={styles.sectionTitle}>{title}</div>
    {children}
  </div>
);

/** A group header's content: a title and a quieter line about it. */
export const BankGroupLabel = ({ title, meta }: { title: string; meta?: string }) => (
  <>
    <span>{title}</span>
    {meta && <span className={styles.groupMeta}>{meta}</span>}
  </>
);
