import classnames from "classnames";
import type { KeyboardEvent } from "react";
import { Icon } from "@controls/Icon";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import { iconSizes } from "@renderer/theming/tokens/dimensions";
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
const OPEN_EDITOR_ICON_SIZE = iconSizes.md;

/** Size of the unsaved-changes dot. Small enough to read as a marker, not as a second icon. */
const DIRTY_MARKER_SIZE = iconSizes.xs;

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
    /*
     * A named group, not a `list`.
     *
     * The rows are buttons — clicking one activates a document — and ARIA's `list` requires
     * `listitem` children, so announcing them as a list would mean giving up the role that says
     * what they do. `group` with a label supplies the missing context (a screen reader otherwise
     * hears N unrelated buttons) without misdescribing the rows.
     */
    <div className={styles.openEditorsPanel} role="group" aria-label="Open editors">
      {entries.map((entry) => (
        <OpenEditorRow
          // A document can be open in both halves of a split view, so the hub is part of its
          // identity here; the document ID alone would collide.
          key={`${entry.hub.hubId}:${entry.document.id}`}
          entry={entry}
          onActivate={() => activate(entry)}
          onMakePermanent={() => makePermanent(entry)}
          onClose={() => closeEditor(entry)}
        />
      ))}
    </div>
  );
};

type OpenEditorRowProps = {
  entry: OpenEditorEntry;
  onActivate: () => void;
  onMakePermanent: () => void;
  onClose: () => void;
};

/**
 * One open-editor row, with one styled tooltip.
 *
 * Extracted from the panel's `.map()` for the usual reason: binding a tooltip needs
 * `useTooltipRef`, and a hook cannot be called from inside a loop.
 *
 * It replaces **two** native `title` attributes — one on the row carrying the file path, one on the
 * dirty marker. Those were the browser's tooltips: unstyled, on their own clock, positioned where
 * the app has no say, and able to fire on top of each other since the marker sits inside the row.
 * One tooltip states the path and appends the unsaved note when there is one. The path also stays
 * on `aria-label`, because a tooltip is not an accessible name.
 */
const OpenEditorRow = ({ entry, onActivate, onMakePermanent, onClose }: OpenEditorRowProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const path = entry.document.path ?? entry.document.name;
  const tooltip = entry.isDirty ? `${path}\nUnsaved changes` : path;

  return (
    <div
      ref={ref}
      className={classnames(styles.item, {
        [styles.current]: entry.isCurrent,
        [styles.active]: entry.isActive && !entry.isCurrent
      })}
      role="button"
      tabIndex={0}
      aria-current={entry.isCurrent ? "true" : undefined}
      /*
       * No `aria-label` here, deliberately.
       *
       * The row's accessible name should be what the user sees — the filename — and it comes from
       * the row's own content for free. An `aria-label` carrying the full path *replaces* that, so
       * a screen reader would read "/proj/src/a.asm" where the eye reads "a.asm". The path belongs
       * in the tooltip, which is where it now is; the unsaved state is named on the marker below,
       * so it appends to the row's name rather than displacing it.
       */
      onClick={onActivate}
      onDoubleClick={onMakePermanent}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        // --- `e.key`, not `e.code`: `code` is the physical key, so the numeric keypad's Enter
        // --- reports `NumpadEnter` and the row could not be activated from it.
        if (e.key !== "Enter" && e.key !== " ") return;
        // Space scrolls the panel otherwise, and Enter may bubble to the panel header.
        e.preventDefault();
        e.stopPropagation();
        onActivate();
      }}
    >
      {/*
       * The close affordance, in a slot that is always reserved — which is what indents the rest
       * of the row by one icon width. Reserved rather than inserted on hover: a slot that appeared
       * under the pointer would shove every name sideways as the mouse moved down the list.
       * `TabButton` is the same button the document tabs close with, so the two look and behave
       * alike; the stylesheet fades it in on hover and on focus.
       */}
      <div className={styles.closeSlot}>
        <TabButton
          iconName="close"
          xclass={styles.closeButton}
          title={`Close ${entry.document.name}`}
          clicked={onClose}
        />
      </div>
      <Icon
        iconName={entry.document.iconName ?? "file-code"}
        fill={entry.document.iconFill ?? "--color-doc-icon"}
        width={OPEN_EDITOR_ICON_SIZE}
        height={OPEN_EDITOR_ICON_SIZE}
      />
      <span className={classnames(styles.name, { [styles.temporary]: entry.isTemporary })}>
        {entry.label}
      </span>
      {entry.detail && <span className={styles.detail}>{entry.detail}</span>}
      <div
        className={styles.marker}
        role={entry.isDirty ? "img" : undefined}
        aria-label={entry.isDirty ? "Unsaved changes" : undefined}
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
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={0}
        showDelay={100}
        content={tooltip}
      />
    </div>
  );
};
