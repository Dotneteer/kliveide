import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { useT } from "@common/i18n/useT";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { documentDisplayName } from "@renderer/features/documents/specialDocuments";
import styles from "./FloatHeader.module.scss";
import type { ReactNode } from "react";

/**
 * The size of the document glyph and the marks: the document tab's (see `TAB_ICON_SIZE` in
 * `DocumentTab.tsx`, which explains the choice)
 */
const HEADER_ICON_SIZE = 16;

type Props = {
  document?: ProjectDocumentState;
  /** The document has unsaved changes */
  hasChanges?: boolean;
  /** The document is locked while the project runs */
  isLocked?: boolean;
  /** An operation is under way: the buttons wait */
  busy?: boolean;
  /** The document's command bar (the one its tab strip shows in the IDE), if it has one */
  commandBar?: ReactNode;
  onDock: () => void;
  onClose: () => void;
};

/**
 * The header of a floating document window (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §2.2): the
 * document's icon and name with the marks its tab shows, then Dock and Close. The window is
 * frameless, so the header is its drag region.
 */
export const FloatHeader = ({
  document,
  hasChanges,
  isLocked,
  busy,
  commandBar,
  onDock,
  onClose
}: Props) => {
  const t = useT();
  const dockRef = useTooltipRef<HTMLButtonElement>();
  const closeRef = useTooltipRef<HTMLButtonElement>();
  const nameRef = useTooltipRef<HTMLSpanElement>();
  const readOnlyRef = useTooltipRef<HTMLSpanElement>();
  const lockedRef = useTooltipRef<HTMLSpanElement>();
  const dirtyRef = useTooltipRef<HTMLSpanElement>();

  return (
    <div className={styles.floatHeader} data-testid="float-header">
      {document && (
        <span className={styles.glyph}>
          <Icon
            iconName={document.iconName ?? "file-code"}
            width={HEADER_ICON_SIZE}
            height={HEADER_ICON_SIZE}
            fill={document.iconFill ?? "--color-doc-icon"}
          />
        </span>
      )}
      <span ref={nameRef} className={styles.title}>
        <bdi>{document ? documentDisplayName(document) : ""}</bdi>
        {document?.path && (
          <TooltipFactory refElement={nameRef.current} placement="bottom" content={document.path} />
        )}
      </span>
      <span className={styles.marks}>
        {hasChanges && (
          <span ref={dirtyRef} className={styles.dirty} data-testid="float-dirty">
            {"●"}
            <TooltipFactory
              refElement={dirtyRef.current}
              placement="bottom"
              content={t("documents.float.modified")}
            />
          </span>
        )}
        {document?.isReadOnly && (
          <span ref={readOnlyRef} className={styles.glyph}>
            <Icon
              iconName="shield"
              width={HEADER_ICON_SIZE}
              height={HEADER_ICON_SIZE}
              fill="--color-readonly-icon-active"
            />
            <TooltipFactory
              refElement={readOnlyRef.current}
              placement="bottom"
              content={t("documents.tab.readOnly")}
            />
          </span>
        )}
        {isLocked && (
          <span ref={lockedRef} className={styles.glyph}>
            <Icon
              iconName="lock"
              width={HEADER_ICON_SIZE}
              height={HEADER_ICON_SIZE}
              fill="--console-ansi-bright-red"
            />
            <TooltipFactory
              refElement={lockedRef.current}
              placement="bottom"
              content={t("documents.tab.locked")}
            />
          </span>
        )}
      </span>
      {commandBar && (
        <span className={styles.commands} data-testid="float-commands">
          {commandBar}
        </span>
      )}
      <span className={styles.buttons}>
        <button
          ref={dockRef}
          type="button"
          className={styles.button}
          disabled={busy || !document}
          onClick={onDock}
          data-testid="float-dock"
        >
          <Icon
            iconName="dock-window"
            width={HEADER_ICON_SIZE}
            height={HEADER_ICON_SIZE}
            fill="--color-doc-activeText"
          />
          {t("documents.float.dock")}
          <TooltipFactory
            refElement={dockRef.current}
            placement="bottom"
            content={t("documents.float.dockTooltip")}
          />
        </button>
        <button
          ref={closeRef}
          type="button"
          className={styles.button}
          disabled={busy}
          onClick={onClose}
          data-testid="float-close"
        >
          <Icon
            iconName="close"
            width={HEADER_ICON_SIZE}
            height={HEADER_ICON_SIZE}
            fill="--color-doc-activeText"
          />
          {t("documents.float.close")}
          <TooltipFactory
            refElement={closeRef.current}
            placement="bottom"
            content={t("documents.float.closeTooltip")}
          />
        </button>
      </span>
    </div>
  );
};
