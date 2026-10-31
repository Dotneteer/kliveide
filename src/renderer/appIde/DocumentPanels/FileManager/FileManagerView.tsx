import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { Icon } from "@renderer/controls/Icon";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { VirtualizedList, type VirtualizedListApi } from "@renderer/controls/VirtualizedList";
import type { FileManagerIntent } from "./FileManagerController";
import type { PaneSide } from "./FileManagerModel";
import type { ColumnVm, DriveIcon, DriveMenuVm, FileManagerVm, PaneVm, RowVm } from "./FileManagerViewModel";
import { intentForKey } from "./fileManagerKeys";
import styles from "./FileManagerPanel.module.scss";

/*
 * The File Manager's view (.plans/FILE_MANAGER_PLAN.md §4.1): two panes side by side, each a header
 * (drive button, path, buttons), the column headers, the virtualized rows and a status line. Dumb:
 * it renders the view model and dispatches intents.
 */

type Dispatch = (intent: FileManagerIntent) => void;

const DRIVE_ICONS: Record<DriveIcon, string> = {
  volume: "hard-drive",
  home: "home",
  folder: "folder",
  project: "file-project",
  image: "floppy"
};

export type FileManagerViewProps = {
  vm: FileManagerVm;
  dispatch: Dispatch;
  rowHeight: number;
};

export const FileManagerView = ({ vm, dispatch, rowHeight }: FileManagerViewProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const listHeights = useRef<[number, number]>([0, 0]);
  const active = vm.panes[0].active ? 0 : 1;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const pane = vm.panes[active];
    const intent = intentForKey(e, {
      side: active,
      cursor: pane.cursor,
      rowCount: pane.rows.length,
      pageSize: Math.max(1, Math.floor(listHeights.current[active] / rowHeight)),
      menuOpen: !!vm.menu
    });
    if (!intent) return;
    e.preventDefault();
    e.stopPropagation();
    dispatch(intent);
  };

  // --- The keyboard goes to the document as soon as it opens
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.fileManager}
      tabIndex={0}
      onKeyDown={onKeyDown}
      data-testid="file-manager"
    >
      {vm.drivesError && <div className={styles.banner}>{vm.drivesError}</div>}
      <div className={styles.panes}>
        {vm.panes.map((pane) => (
          <FilePane
            key={pane.side}
            pane={pane}
            menu={vm.menu?.side === pane.side ? vm.menu : undefined}
            dispatch={dispatch}
            rowHeight={rowHeight}
            onListHeight={(h) => (listHeights.current[pane.side] = h)}
            refocus={() => rootRef.current?.focus({ preventScroll: true })}
          />
        ))}
      </div>
    </div>
  );
};

type FilePaneProps = {
  pane: PaneVm;
  menu?: DriveMenuVm;
  dispatch: Dispatch;
  rowHeight: number;
  onListHeight: (height: number) => void;
  refocus: () => void;
};

const FilePane = ({ pane, menu, dispatch, rowHeight, onListHeight, refocus }: FilePaneProps) => {
  const t = useT();
  const side = pane.side;
  const listApi = useRef<VirtualizedListApi>();
  const listHost = useRef<HTMLDivElement>(null);

  // --- Keep the cursor's row in view
  useEffect(() => {
    listApi.current?.scrollToIndex(pane.cursor, { align: "nearest" });
  }, [pane.cursor, pane.rows]);

  useEffect(() => {
    const host = listHost.current;
    if (!host) return undefined;
    const observer = new ResizeObserver(() => onListHeight(host.clientHeight));
    observer.observe(host);
    onListHeight(host.clientHeight);
    return () => observer.disconnect();
  }, [onListHeight]);

  const template = gridTemplate(pane.columns);

  return (
    <section
      className={classnames(styles.pane, { [styles.active]: pane.active })}
      data-testid={`fm-pane-${side}`}
      onMouseDown={() => {
        if (!pane.active) dispatch({ type: "paneFocused", side });
      }}
    >
      <header className={styles.paneHeader}>
        <button
          type="button"
          className={styles.driveButton}
          title={t("panels.fileManager.changeDrive")}
          onClick={() => dispatch({ type: "driveMenuToggled", side })}
          data-testid={`fm-drive-${side}`}
        >
          {pane.drive && <Icon iconName={DRIVE_ICONS[pane.drive.icon]} width={14} height={14} fill="--color-command-icon" />}
          <span className={styles.driveLabel}>{pane.drive?.label ?? ""}</span>
          <span className={styles.caret}>{menu ? "▴" : "▾"}</span>
        </button>
        {pane.drive?.readOnly && (
          <span title={t("panels.fileManager.readOnly")} className={styles.lock}>
            <Icon iconName="lock" width={12} height={12} fill="--color-command-icon" />
          </span>
        )}
        <nav className={styles.crumbs} title={pane.pathText}>
          {pane.crumbs.map((c, i) => (
            <span key={i} className={styles.crumbItem}>
              {i > 0 && <span className={styles.crumbSep}>›</span>}
              <button
                type="button"
                className={classnames(styles.crumb, { [styles.crumbCurrent]: c.current })}
                title={t("panels.fileManager.pathTooltip", { name: c.label })}
                onClick={() => {
                  dispatch({ type: "crumbChosen", side, target: c.target });
                  refocus();
                }}
              >
                {c.label}
              </button>
            </span>
          ))}
        </nav>
        <SmallIconButton
          iconName="eye"
          title={t("panels.fileManager.showHidden")}
          clicked={() => {
            dispatch({ type: "hiddenToggled", side });
            refocus();
          }}
        />
        <SmallIconButton
          iconName="refresh"
          title={t("panels.fileManager.refresh")}
          clicked={() => {
            dispatch({ type: "refreshRequested", side });
            refocus();
          }}
        />
      </header>

      <div className={styles.columns} style={{ gridTemplateColumns: template }} role="row">
        {pane.columns.map((c) => (
          <button
            type="button"
            key={c.key}
            className={classnames(styles.columnHead, { [styles.end]: c.align === "end" })}
            disabled={!c.sortable}
            onClick={() => {
              dispatch({ type: "sortChosen", side, key: c.key as "name" | "size" | "modified" | "kind" });
              refocus();
            }}
          >
            {c.label}
            {c.sorted && <span className={styles.sortMark}>{c.sorted === "ascending" ? "▲" : "▼"}</span>}
          </button>
        ))}
      </div>

      <div className={styles.list} ref={listHost}>
        {pane.error ? (
          <div className={styles.message} data-testid={`fm-error-${side}`}>{pane.error}</div>
        ) : pane.loading && pane.rows.length === 0 ? (
          <div className={styles.message}>{t("panels.fileManager.loading")}</div>
        ) : pane.empty && pane.rows.length === 0 ? (
          <div className={styles.message}>{pane.empty}</div>
        ) : (
          <VirtualizedList
            items={pane.rows}
            itemSize={rowHeight}
            apiLoaded={(api) => (listApi.current = api)}
            renderItem={(index, row) => (
              <FileRow
                row={row}
                template={template}
                columns={pane.columns}
                activePane={pane.active}
                onClick={() => dispatch({ type: "cursorMoved", side, to: index })}
                onOpen={() => dispatch({ type: "rowActivated", side, index })}
                onMark={() => {
                  dispatch({ type: "cursorMoved", side, to: index });
                  dispatch({ type: "markToggled", side });
                }}
              />
            )}
          />
        )}
        {menu && <DriveMenu menu={menu} dispatch={dispatch} refocus={refocus} />}
      </div>

      <footer className={styles.status}>
        <span className={styles.statusLeft}>{pane.statusLeft}</span>
        <span className={styles.statusRight}>{pane.statusRight}</span>
      </footer>
    </section>
  );
};

/** Column widths in `ch` (M2), the name column taking the rest but never less than 12ch */
function gridTemplate (columns: ColumnVm[]): string {
  return columns.map((c) => (c.width ? `${c.width}ch` : "minmax(12ch, 1fr)")).join(" ");
}

type FileRowProps = {
  row: RowVm;
  template: string;
  columns: ColumnVm[];
  activePane: boolean;
  onClick: () => void;
  onOpen: () => void;
  onMark: () => void;
};

const FileRow = ({ row, template, columns, activePane, onClick, onOpen, onMark }: FileRowProps) => (
  <div
    className={classnames(styles.row, {
      [styles.cursor]: row.cursor,
      [styles.cursorActive]: row.cursor && activePane,
      [styles.marked]: row.marked,
      [styles.directory]: row.isDirectory
    })}
    style={{ gridTemplateColumns: template }}
    onClick={(e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey) onMark();
      else onClick();
    }}
    onDoubleClick={onOpen}
    data-testid="fm-row"
  >
    {row.cells.map((cell, i) => (
      <span key={i} className={classnames(styles.cell, { [styles.end]: columns[i]?.align === "end" })}>
        {i === 0 && (
          <Icon
            iconName={row.isUp ? "arrow-up" : row.isDirectory ? "folder" : row.isImage ? "floppy" : "file-code"}
            width={14}
            height={14}
            fill={row.isDirectory ? "--accent-text" : "--color-command-icon"}
          />
        )}
        <span className={styles.cellText}>{cell}</span>
      </span>
    ))}
  </div>
);

type DriveMenuProps = { menu: DriveMenuVm; dispatch: Dispatch; refocus: () => void };

const DriveMenu = ({ menu, dispatch, refocus }: DriveMenuProps) => {
  const choose = (intent: FileManagerIntent) => {
    dispatch(intent);
    refocus();
  };
  return (
    <>
      <div className={styles.menuBackdrop} onMouseDown={() => choose({ type: "driveMenuClosed" })} />
      <div className={styles.menu} role="menu" data-testid="fm-drive-menu">
        {menu.groups.map((g) => (
          <div key={g.title} className={styles.menuGroup}>
            <div className={styles.menuTitle}>{g.title}</div>
            {g.items.map((item) => (
              <button
                type="button"
                role="menuitem"
                key={item.id}
                className={classnames(styles.menuItem, { [styles.menuSelected]: item.selected })}
                onClick={() => choose({ type: "driveChosen", side: menu.side as PaneSide, driveId: item.id })}
              >
                <Icon iconName={DRIVE_ICONS[item.icon]} width={14} height={14} fill="--color-command-icon" />
                <span className={styles.menuLabel}>
                  {item.label}
                  {item.detail && <span className={styles.menuDetail}>{item.detail}</span>}
                </span>
                <span className={styles.menuFree}>{item.free ?? ""}</span>
              </button>
            ))}
          </div>
        ))}
        <div className={styles.menuGroup}>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => choose({ type: "openImageRequested", side: menu.side })}>
            <Icon iconName="floppy" width={14} height={14} fill="--color-command-icon" />
            <span className={styles.menuLabel}>{menu.openImageLabel}</span>
            <span className={styles.menuFree} />
          </button>
        </div>
      </div>
    </>
  );
};
