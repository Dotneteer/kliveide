import classnames from "classnames";
import type { KeyboardEvent } from "react";
import { Icon } from "@controls/Icon";
import { TabButton } from "@controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { OpenEditorEntry, useOpenEditors } from "./useOpenEditors";
import styles from "./OpenEditorsPanel.module.scss";

/**
 * Size of the file-type glyph on a row.
 *
 * The same 20px the explorer tree and the document tabs use, so one file looks the same size
 * wherever it is listed.
 */
const OPEN_EDITOR_ICON_SIZE = 20;

/** Size of the unsaved-changes dot. Small enough to read as a marker, not as a second icon. */
const DIRTY_MARKER_SIZE = 10;

/**
 * The Open Editors panel: every open document across every document hub, most recently activated
 * first, with a click to jump back to one.
 *
 * The ordering (and the reason it is computed in `useOpenEditors` rather than here) is described
 * on that hook. This component is the presentation half: it renders rows and turns a click into an
 * activation.
 */
export const OpenEditorsPanel = () => {
  const { projectService } = useAppServices();
  const entries = useOpenEditors();

  /**
   * Jumps to a document: makes its hub the active one first, then activates the document in it.
   *
   * Both steps are needed in a split view, and in that order — activating a document in a hub the
   * user is not looking at would change a pane off to the side while their focus stayed put.
   */
  const activate = async (entry: OpenEditorEntry) => {
    if (projectService.getActiveDocumentHubService() !== entry.hub) {
      projectService.setActiveDocumentHubService(entry.hub);
    }
    await entry.hub.setActiveDocument(entry.document.id);
  };

  /** Promotes a preview tab to a permanent one, the way double-clicking its tab does. */
  const makePermanent = async (entry: OpenEditorEntry) => {
    await activate(entry);
    entry.hub.setPermanent(entry.document.id);
  };

  /**
   * Closes a document, in the hub that holds it.
   *
   * Deliberately without activating that hub first, unlike every other action here: closing is not
   * going somewhere. `closeDocument` is the same call the tab's own close button makes, so an
   * unsaved document raises the same save prompt whichever button the user reaches for.
   */
  const closeEditor = async (entry: OpenEditorEntry) => {
    await entry.hub.closeDocument(entry.document.id);
  };

  if (entries.length === 0) {
    return <div className={styles.empty}>No open editors</div>;
  }

  return (
    <div className={styles.openEditorsPanel}>
      {entries.map((entry) => (
        <div
          // A document can be open in both halves of a split view, so the hub is part of its
          // identity here; the document ID alone would collide.
          key={`${entry.hub.hubId}:${entry.document.id}`}
          className={classnames(styles.item, {
            [styles.current]: entry.isCurrent,
            [styles.active]: entry.isActive && !entry.isCurrent
          })}
          role="button"
          tabIndex={0}
          aria-current={entry.isCurrent ? "true" : undefined}
          title={entry.document.path ?? entry.document.name}
          onClick={() => activate(entry)}
          onDoubleClick={() => makePermanent(entry)}
          onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
            if (e.code !== "Enter" && e.code !== "Space") return;
            // Space scrolls the panel otherwise, and Enter may bubble to the panel header.
            e.preventDefault();
            e.stopPropagation();
            activate(entry);
          }}
        >
          {/*
            * The close affordance, in a slot that is always reserved — which is what indents the
            * rest of the row by one icon width. Reserved rather than inserted on hover: a slot
            * that appeared under the pointer would shove every name sideways as the mouse moved
            * down the list. `TabButton` is the same button the document tabs close with, so the
            * two look and behave alike; the stylesheet fades it in on hover and on focus.
            */}
          <div className={styles.closeSlot}>
            <TabButton
              iconName="close"
              xclass={styles.closeButton}
              title={`Close ${entry.document.name}`}
              clicked={() => closeEditor(entry)}
            />
          </div>
          <Icon
            iconName={entry.document.iconName ?? "file-code"}
            fill={entry.document.iconFill ?? "--color-doc-icon"}
            width={OPEN_EDITOR_ICON_SIZE}
            height={OPEN_EDITOR_ICON_SIZE}
          />
          <span
            className={classnames(styles.name, {
              [styles.temporary]: entry.isTemporary
            })}
          >
            {entry.label}
          </span>
          {entry.detail && <span className={styles.detail}>{entry.detail}</span>}
          <div
            className={styles.marker}
            // A dot beside a filename is not self-explanatory, and it sits on a row whose own
            // tooltip is the file path, so it carries its own.
            title={entry.isDirty ? "Unsaved changes" : undefined}
          >
            {entry.isDirty && (
              <Icon
                iconName="circle-filled"
                fill="--color-doc-icon"
                width={DIRTY_MARKER_SIZE}
                height={DIRTY_MARKER_SIZE}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
