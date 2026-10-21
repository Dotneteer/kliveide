import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import classnames from "classnames";
import { useOverlayRoot } from "./overlay/useOverlayRoot";
import styles from "./HoverCard.module.scss";

/** The gap between the anchor and the card, in px: the card never overlaps its anchor. */
const GAP = 4;
/** The distance the card keeps from the window's edges, in px. */
const MARGIN = 8;

type Props = Omit<HTMLAttributes<HTMLSpanElement>, "content"> & {
  /** What the card shows; a function is called only while the card is open. */
  content: ReactNode | (() => ReactNode);
  /** The anchor: the whole of it is the hover area. */
  children: ReactNode;
  /** Delay before the card opens, in ms. */
  openDelay?: number;
  /** Grace period before the card closes once the pointer has left, in ms. */
  closeDelay?: number;
  /** Extra class for the card itself. */
  cardClassName?: string;
};

/**
 * A card of explanation that opens when the pointer rests on its anchor, or when the keyboard
 * focuses something inside it, and stays open while the pointer moves onto it.
 *
 * Unlike `Tooltip`, the card is a hit target, so it can be read at leisure and hold more than a
 * line. It opens below the anchor (above, when there is no room) and never over it, so it cannot
 * take the hover away from the anchor that opened it. Escape closes it.
 */
export const HoverCard = ({
  content,
  children,
  openDelay = 250,
  closeDelay = 150,
  className,
  cardClassName,
  ...rest
}: Props) => {
  const root = useOverlayRoot();
  const cardId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>();

  const clearTimer = useCallback(() => {
    if (timer.current !== undefined) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);
  const openSoon = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(true), openDelay);
  }, [clearTimer, openDelay]);
  const closeSoon = useCallback(() => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), closeDelay);
  }, [clearTimer, closeDelay]);
  const close = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);
  useEffect(() => {
    if (!open) setPosition(undefined);
  }, [open]);

  // --- Below the anchor, or above it when the window has no room below; kept inside the window
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !cardRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const card = cardRef.current.getBoundingClientRect();
    const below = anchor.bottom + GAP;
    const top =
      below + card.height <= window.innerHeight - MARGIN || anchor.top - GAP - card.height < MARGIN
        ? below
        : anchor.top - GAP - card.height;
    const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - MARGIN - card.width));
    setPosition({ top, left });
  }, [open]);

  // --- Escape closes it, wherever the focus is
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, close]);

  return (
    <>
      <span
        {...rest}
        ref={anchorRef}
        className={classnames(styles.anchor, className)}
        aria-describedby={open ? cardId : undefined}
        onMouseEnter={openSoon}
        onMouseLeave={closeSoon}
        onFocus={openSoon}
        onBlur={close}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={cardId}
            role="tooltip"
            className={classnames(styles.card, cardClassName)}
            style={position ?? { top: 0, left: 0, visibility: "hidden" }}
            onMouseEnter={clearTimer}
            onMouseLeave={closeSoon}
          >
            {typeof content === "function" ? content() : content}
          </div>,
          root ?? document.body
        )}
    </>
  );
};
