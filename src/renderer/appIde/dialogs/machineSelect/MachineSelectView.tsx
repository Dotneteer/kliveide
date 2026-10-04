import { KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import classnames from "classnames";

import { Icon } from "@renderer/controls/Icon";
import { PanelFilter } from "@renderer/controls/data";
import type { MachineSelectEvent } from "./MachineSelectModel";
import type {
  FavoriteRowVm,
  MachineSelectVm,
  ModelRowVm,
  ScreenVm,
  SectionVm,
  SheetVm
} from "./MachineSelectViewModel";

import styles from "./MachineSelectDialog.module.scss";

type Props = {
  vm: MachineSelectVm;
  filter: string;
  dispatch: (event: MachineSelectEvent) => void;
  /** Switch to a model (double-click, Enter) */
  onSwitchRequested: (key: string) => void;
};

/** `data-nav` ids: one per focusable stop of the accordion */
const sectionNav = (id: string) => `section:${id}`;
const modelNav = (key: string) => `model:${key}`;
const favoriteNav = (key: string) => `favorite:${key}`;

/**
 * The Select Machine dialog's body: the accordion on the left, the hardware sheet on the right.
 * Dumb: it renders the view model and turns gestures into `MachineSelectEvent`s.
 */
export const MachineSelectView = ({ vm, filter, dispatch, onSwitchRequested }: Props) => {
  const treeRef = useRef<HTMLDivElement>(null);
  const [focusNav, setFocusNav] = useState<string>();
  const [dragKey, setDragKey] = useState<string>();
  const [dropKey, setDropKey] = useState<string>();

  // --- Keep the keyboard focus on the same item across re-renders (reordering moves the node)
  useLayoutEffect(() => {
    if (!focusNav) return;
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-nav="${CSS.escape(focusNav)}"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: "nearest" });
    setFocusNav(undefined);
  }, [focusNav, vm]);

  const onTreeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const nav = target.dataset?.nav;
    if (!nav) return;
    const [kind, id] = [nav.slice(0, nav.indexOf(":")), nav.slice(nav.indexOf(":") + 1)];

    if (e.altKey && kind === "favorite" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      dispatch({ type: "favoriteMoved", key: id, delta: e.key === "ArrowUp" ? -1 : 1 });
      setFocusNav(nav);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        const stops = [...(treeRef.current?.querySelectorAll<HTMLElement>("[data-nav]") ?? [])];
        const next = stops[stops.indexOf(target) + (e.key === "ArrowDown" ? 1 : -1)];
        if (!next) return;
        const nextNav = next.dataset.nav!;
        const nextId = nextNav.slice(nextNav.indexOf(":") + 1);
        if (!nextNav.startsWith("section:")) dispatch({ type: "modelSelected", key: nextId });
        setFocusNav(nextNav);
        return;
      }
      case "ArrowRight":
      case "ArrowLeft":
        if (kind === "section") {
          e.preventDefault();
          dispatch({ type: "sectionToggled", sectionId: id, open: e.key === "ArrowRight" });
          setFocusNav(nav);
        }
        return;
      case " ":
        if (kind !== "section") {
          e.preventDefault();
          dispatch({ type: "favoriteToggled", key: id });
          setFocusNav(kind === "favorite" ? undefined : nav);
        }
        return;
      case "Enter":
        if (kind !== "section") {
          e.preventDefault();
          onSwitchRequested(id);
        }
        return;
      case "Delete":
      case "Backspace":
        if (kind === "favorite") {
          e.preventDefault();
          dispatch({ type: "favoriteRemoved", key: id });
        }
        return;
    }
  };

  // --- Roving tab stop: the selected row when it is visible, else the first section header
  const visibleNavs = vm.sections.flatMap((s) =>
    s.kind === "leaf"
      ? [{ nav: modelNav(s.row.key), selected: s.row.selected }]
      : [
          { nav: sectionNav(s.id), selected: false },
          ...(s.open
            ? s.rows.map((r) => ({
                nav: s.kind === "favorites" ? favoriteNav(r.key) : modelNav(r.key),
                selected: r.selected
              }))
            : [])
        ]
  );
  const tabStop = (visibleNavs.find((n) => n.selected) ?? visibleNavs[0])?.nav;

  // --- Opening puts the keyboard on the running model (or the first section)
  const tabStopRef = useRef(tabStop);
  tabStopRef.current = tabStop;
  useEffect(() => {
    const handle = setTimeout(() => setFocusNav(tabStopRef.current));
    return () => clearTimeout(handle);
  }, []);

  const select = (key: string, nav: string) => {
    dispatch({ type: "modelSelected", key });
    setFocusNav(nav);
  };

  const starButton = (key: string, on: boolean) => (
    <button
      type="button"
      className={classnames(styles.star, { [styles.starOn]: on })}
      title={on ? "Remove from the Machine type menu" : "Add to the Machine type menu"}
      aria-label={on ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={on}
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: "favoriteToggled", key });
      }}
    >
      <Icon iconName={on ? "star-filled" : "star"} width={13} height={13} fill="currentColor" />
    </button>
  );

  const modelRow = (row: ModelRowVm, leafTitle?: string) => (
    <div
      key={row.key}
      role="treeitem"
      aria-selected={row.selected}
      tabIndex={tabStop === modelNav(row.key) ? 0 : -1}
      data-nav={modelNav(row.key)}
      data-testid={`machine-row-${row.key}`}
      className={classnames(leafTitle ? styles.leaf : styles.modelRow, { [styles.selected]: row.selected })}
      onClick={() => select(row.key, modelNav(row.key))}
      onDoubleClick={() => onSwitchRequested(row.key)}
    >
      {leafTitle && <span className={styles.chevronSpace} />}
      <span className={styles.name}>{leafTitle ?? row.name}</span>
      {row.running ? <span className={styles.pill}>Running</span> : <span />}
      {starButton(row.key, row.favorite)}
    </div>
  );

  const favoriteRow = (row: FavoriteRowVm) => (
    <div key={row.key}>
      <div
        role="treeitem"
        aria-selected={row.selected}
        tabIndex={tabStop === favoriteNav(row.key) ? 0 : -1}
        draggable
        data-nav={favoriteNav(row.key)}
        data-testid={`favorite-row-${row.key}`}
        className={classnames(styles.favoriteRow, {
          [styles.selected]: row.selected,
          [styles.dropBefore]: dropKey === row.key && dragKey !== row.key
        })}
        onClick={() => select(row.key, favoriteNav(row.key))}
        onDoubleClick={() => onSwitchRequested(row.key)}
        onDragStart={(e) => {
          setDragKey(row.key);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", row.key);
        }}
        onDragOver={(e) => {
          if (!dragKey) return;
          e.preventDefault();
          setDropKey(row.key);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragKey) dispatch({ type: "favoriteDropped", key: dragKey, beforeKey: row.key });
          setDragKey(undefined);
          setDropKey(undefined);
        }}
        onDragEnd={() => {
          setDragKey(undefined);
          setDropKey(undefined);
        }}
      >
        <span className={styles.grip} aria-hidden="true">
          <Icon iconName="grip-vertical" width={12} height={12} fill="currentColor" />
        </span>
        <span className={styles.name}>{row.name}</span>
        <span className={styles.rowActions}>
          {rowAction("arrow-up", "Move up (Alt+↑)", !row.canMoveUp, () =>
            dispatch({ type: "favoriteMoved", key: row.key, delta: -1 })
          )}
          {rowAction("arrow-down", "Move down (Alt+↓)", !row.canMoveDown, () =>
            dispatch({ type: "favoriteMoved", key: row.key, delta: 1 })
          )}
          {rowAction(
            "separator-horizontal",
            row.separatorAfter ? "Remove the separator after this item" : "Add a separator after this item",
            !row.canToggleSeparator,
            () => dispatch({ type: "separatorToggled", key: row.key }),
            row.separatorAfter
          )}
          {rowAction("close", "Remove from favourites (Delete)", false, () =>
            dispatch({ type: "favoriteRemoved", key: row.key })
          )}
        </span>
      </div>
      {row.separatorAfter && <div className={styles.menuSeparator} aria-hidden="true" />}
    </div>
  );

  const section = (s: SectionVm) => {
    if (s.kind === "leaf") {
      return (
        <div key={s.id} className={styles.section} role="group">
          {modelRow(s.row, s.title)}
        </div>
      );
    }
    const isFavorites = s.kind === "favorites";
    return (
      <div key={s.id} className={styles.section} role="group">
        <div
          role="treeitem"
          aria-expanded={s.open}
          tabIndex={tabStop === sectionNav(s.id) ? 0 : -1}
          data-nav={sectionNav(s.id)}
          data-testid={`section-${s.id}`}
          className={classnames(styles.sectionHeader, { [styles.favoritesHeader]: isFavorites })}
          onClick={() => {
            dispatch({ type: "sectionToggled", sectionId: s.id });
            setFocusNav(sectionNav(s.id));
          }}
        >
          <span className={classnames(styles.chevron, { [styles.chevronOpen]: s.open })}>
            <Icon iconName="chevron-right" width={12} height={12} fill="currentColor" />
          </span>
          <span className={styles.name}>
            {isFavorites ? "Favourites · menu order" : s.title}
            {!isFavorites && s.containsRunning && !s.open && (
              <span className={styles.runningDot} title="The running model is in here" />
            )}
          </span>
          <span className={styles.count}>{s.rows.length}</span>
        </div>
        {s.open && (
          <div role="group">
            {isFavorites
              ? s.rows.length
                ? s.rows.map((r) => favoriteRow(r as FavoriteRowVm))
                : <div className={styles.hint}>Star a model to add it to the Machine type menu.</div>
              : s.rows.map((r) => modelRow(r as ModelRowVm))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.body}>
      <div className={styles.navPane}>
        <PanelFilter
          value={filter}
          onChange={(text) => dispatch({ type: "filterChanged", text })}
          placeholder="Name, 128K, NTSC, disk…"
          label="Filter machines"
        />
        <div
          ref={treeRef}
          className={styles.tree}
          role="tree"
          aria-label="Machines"
          data-testid="machine-tree"
          onKeyDown={onTreeKeyDown}
        >
          {vm.sections.map(section)}
          {vm.noMatch && <div className={styles.hint}>No machine matches “{filter}”.</div>}
        </div>
        <div className={styles.navFooter}>
          <button
            type="button"
            className={styles.linkButton}
            data-testid="restore-default-favorites"
            onClick={() => dispatch({ type: "defaultsRestored" })}
          >
            Restore default favourites
          </button>
          {vm.dirty && <span className={styles.dirtyNote}>Unsaved menu changes</span>}
        </div>
      </div>
      <div className={styles.sheetPane} data-testid="hardware-sheet">
        {vm.sheet ? (
          <HardwareSheet
            sheet={vm.sheet}
            onFavoriteToggled={() => dispatch({ type: "favoriteToggled", key: vm.sheet!.key })}
          />
        ) : (
          <div className={styles.hint}>Select a model to see its hardware.</div>
        )}
      </div>
    </div>
  );
};

function rowAction(icon: string, title: string, disabled: boolean, onClick: () => void, on = false) {
  return (
    <button
      type="button"
      className={classnames(styles.rowAction, { [styles.rowActionOn]: on })}
      title={title}
      aria-label={title}
      aria-pressed={on || undefined}
      disabled={disabled}
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon iconName={icon} width={12} height={12} fill="currentColor" />
    </button>
  );
}

const HardwareSheet = ({ sheet, onFavoriteToggled }: { sheet: SheetVm; onFavoriteToggled: () => void }) => (
  <div className={styles.sheet}>
    <div className={styles.sheetHead}>
      <div className={styles.sheetTitle}>
        <span className={styles.sheetName}>{sheet.name}</span>
        {sheet.running && <span className={styles.pill}>Running</span>}
      </div>
      <button
        type="button"
        className={classnames(styles.favoriteToggle, { [styles.favoriteToggleOn]: sheet.favorite })}
        aria-pressed={sheet.favorite}
        data-testid="sheet-favorite"
        onClick={onFavoriteToggled}
      >
        <span className={styles.favoriteToggleIcon}>
          <Icon iconName={sheet.favorite ? "star-filled" : "star"} width={13} height={13} fill="currentColor" />
        </span>
        {sheet.favorite ? "In Machine type menu" : "Add to Machine type menu"}
      </button>
      <div className={styles.sheetSub}>
        {sheet.machineName} · <code>{sheet.idLabel}</code>
      </div>
    </div>
    {sheet.chips.length > 0 && (
      <div className={styles.chips}>
        {sheet.chips.map((c) => (
          <span key={c} className={styles.chip}>
            {c}
          </span>
        ))}
      </div>
    )}
    <div className={styles.groups}>
      {sheet.groups.map((g) => (
        <section key={g.id} className={classnames(styles.group, { [styles.groupWide]: g.id === "display" })}>
          <h3 className={styles.groupTitle}>{g.title}</h3>
          <div className={g.id === "display" && sheet.screen ? styles.displayBody : undefined}>
            {g.id === "display" && sheet.screen && <ScreenDrawing screen={sheet.screen} />}
            <dl className={styles.facts}>
              {g.rows.map((r, i) => (
                <div key={i} className={styles.fact}>
                  <dt>{r.label}</dt>
                  <dd>
                    {r.value}
                    {r.note && <span className={styles.factNote}>{r.note}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ))}
    </div>
  </div>
);

/** The visible raster to scale, the display area inside it (an LCD for the Z88) */
const ScreenDrawing = ({ screen }: { screen: ScreenVm }) => {
  const maxW = 160;
  const scale = Math.min(maxW / screen.rasterWidth, 110 / screen.rasterHeight);
  const w = screen.rasterWidth * scale;
  const h = screen.rasterHeight * scale;
  const iw = screen.width * scale;
  const ih = screen.height * scale;
  const x = (maxW - w) / 2;
  return (
    <figure className={styles.screen} aria-label={screen.caption}>
      <svg viewBox={`0 0 ${maxW} ${h}`} width={maxW} height={h} role="img">
        <rect
          className={screen.kind === "lcd" ? styles.screenPaper : styles.screenRaster}
          x={x}
          y={0}
          width={w}
          height={h}
        />
        {screen.kind === "crt" && (
          <rect
            className={styles.screenPaper}
            x={x + (w - iw) / 2}
            y={(h - ih) / 2}
            width={iw}
            height={ih}
          />
        )}
      </svg>
      <figcaption className={styles.screenCaption}>{screen.caption}</figcaption>
    </figure>
  );
};

