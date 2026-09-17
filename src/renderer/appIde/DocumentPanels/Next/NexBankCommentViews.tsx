import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopper } from "react-popper";
import { Icon } from "@renderer/controls/Icon";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { Button } from "@renderer/controls/Button";
import { getOverlayRoot } from "@renderer/controls/overlay/useOverlayRoot";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { flattenBankComment } from "./nexAnnotationEdits";
import styles from "./NexBankCommentViews.module.scss";

/*
 * How a popped-out bank shows its comment without spending a row of the listing on it.
 *
 * Two views of one comment (`.plans/NEX_BANK_COMMENTS_PLAN.md` §4.2):
 *
 * - **The chip** sits in the toolbar and shows as much of the comment as fits in a short, fixed
 *   width. Clicking it opens a popover with the whole text, from which it can be edited or *pinned*.
 * - **The strip** is the pinned form: a band under the toolbar, one line until expanded. Unpinning
 *   goes back to the chip.
 *
 * Whether the comment is pinned is how this document is shown, not a fact about the program, so it
 * lives in the document's view state beside the other display switches and never reaches the
 * sidecar — pinning is not a write.
 */

export const BANK_COMMENT_CHIP_TITLE = "Show this bank's comment";

type ChipProps = {
  bank: number;
  comment: string;
  onEdit: () => void;
  onPin: () => void;
};

/** The toolbar chip, and the popover it opens. */
export function NexBankCommentChip ({ bank, comment, onEdit, onPin }: ChipProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [popover, setPopover] = useState<HTMLDivElement | null>(null);
  const { styles: popperStyles, attributes } = usePopper(anchor, popover, {
    placement: "bottom-end",
    strategy: "absolute",
    modifiers: [{ name: "offset", options: { offset: [0, 6] } }]
  });

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popover?.contains(target) || anchor?.contains(target)) return;
      setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        anchor?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [anchor, open, popover]);

  // --- Focus moves into the popover, so a keyboard user can reach Edit and Pin at all.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open) bodyRef.current?.focus();
  }, [open]);

  const close = (then?: () => void) => {
    setOpen(false);
    then?.();
  };

  return (
    <>
      <button
        type="button"
        ref={setAnchor}
        className={styles.chip}
        title={BANK_COMMENT_CHIP_TITLE}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon iconName="note" width={14} height={14} fill="--accent-text" />
        <span className={styles.chipText}>{flattenBankComment(comment)}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={setPopover}
            role="dialog"
            aria-label={`Bank $${toHexa2(bank)} comment`}
            className={styles.popover}
            style={{ ...popperStyles.popper, zIndex: 9999 }}
            {...attributes.popper}
          >
            <div className={styles.popoverTitle}>{`Bank $${toHexa2(bank)} comment`}</div>
            <div ref={bodyRef} className={styles.popoverBody} tabIndex={-1}>
              {comment}
            </div>
            <div className={styles.popoverFooter}>
              <Button text="Edit..." clicked={() => close(onEdit)} />
              <Button variant="secondary" text="Pin" clicked={() => close(onPin)} />
              <span className={styles.spacer} />
              <Button variant="secondary" text="Close" clicked={() => close()} />
            </div>
          </div>,
          getOverlayRoot()
        )}
    </>
  );
}

type StripProps = {
  comment: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onUnpin: () => void;
};

/**
 * The pinned comment, under the toolbar.
 *
 * One line while collapsed — flattened and cut exactly as the NEX viewer's heading cuts it — and the
 * whole text, line breaks and all, once expanded. Clicking the text edits it.
 *
 * **The expand button is offered only when there is something to expand.** A comment whose one-line
 * form fits the strip is already on screen in full, so a chevron would promise more and show the same
 * text. Whether it fits is *measured*, not counted: a hidden, unwrapped copy of the one-line text is
 * compared with the width the text actually gets, and re-checked as the panel is resized. When it
 * fits, the strip shows that one line even if it was left expanded, so a stale expanded state cannot
 * spend rows with no button left to take them back.
 */
export function NexBankCommentStrip ({
  comment,
  expanded,
  onToggleExpanded,
  onEdit,
  onUnpin
}: StripProps) {
  const flattened = flattenBankComment(comment);
  const textRef = useRef<HTMLButtonElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const text = textRef.current;
    const measure = measureRef.current;
    if (!text || !measure) return undefined;
    const check = () => setOverflows(measure.scrollWidth > text.clientWidth);
    check();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(check);
    observer.observe(text);
    return () => observer.disconnect();
  }, [flattened]);

  const canExpand = overflows;
  const showExpanded = expanded && canExpand;

  return (
    <div
      className={showExpanded ? styles.stripExpanded : styles.strip}
      role="note"
      aria-label="Bank comment"
    >
      <span className={styles.stripIcon}>
        <Icon iconName="note" width={14} height={14} fill="--accent-text" />
      </span>
      <button
        type="button"
        ref={textRef}
        className={styles.stripText}
        title="Edit the bank comment"
        onClick={onEdit}
      >
        {showExpanded ? comment : flattened}
      </button>
      <span ref={measureRef} className={styles.stripMeasure} aria-hidden="true">
        {flattened}
      </span>
      {canExpand && (
        <SmallIconButton
          iconName={showExpanded ? "chevron-down" : "chevron-right"}
          title={showExpanded ? "Show the comment on one line" : "Show the whole comment"}
          clicked={onToggleExpanded}
        />
      )}
      <SmallIconButton iconName="close" title="Unpin the bank comment" clicked={onUnpin} />
    </div>
  );
}
