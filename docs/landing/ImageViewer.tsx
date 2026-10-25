"use client";
/**
 * Shows the landing page's pictures full size (R5 of .plans/DOCS_SITE_REDESIGN_PLAN.md).
 *
 * - The pictures stay server-rendered links to their files (`<a href data-viewer="<group>"
 *   data-caption>`), so without JavaScript a click simply opens the file. With it, a click opens
 *   this panel instead: a native modal <dialog>, inset from the window over the dimmed page.
 * - The picture is always fitted into the panel, never scrolled or shown larger than the window.
 * - The arrow keys step through the pictures of the same group (the carousel's, or the features');
 *   Esc, the Close button and a click outside the panel close it.
 * - While it is open it sends VIEWER_EVENT (detail: true, then false) on the document, so the
 *   carousel stands still.
 */
import { useEffect, useRef, useState } from "react";

export const VIEWER_EVENT = "lp-viewer";

type Props = Readonly<{
  label: string;
  closeLabel: string;
  /** "{n} / {count}", with the placeholders still in it */
  countLabel: string;
}>;

type Shown = { group: HTMLAnchorElement[]; at: number };

export default function ImageViewer({ label, closeLabel, countLabel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<Shown>();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[data-viewer]");
      if (!link) return;
      e.preventDefault();
      const group = [...document.querySelectorAll<HTMLAnchorElement>(`a[data-viewer="${link.dataset.viewer}"]`)];
      setShown({ group, at: Math.max(0, group.indexOf(link)) });
      if (!dialog.current?.open) {
        dialog.current?.showModal();
        document.dispatchEvent(new CustomEvent(VIEWER_EVENT, { detail: true }));
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const step = (by: number) =>
    setShown((s) => (s && s.group.length > 1 ? { ...s, at: (s.at + by + s.group.length) % s.group.length } : s));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  };

  const onClose = () => {
    setShown(undefined);
    document.dispatchEvent(new CustomEvent(VIEWER_EVENT, { detail: false }));
  };

  // --- A click on the dialog element itself is a click on the dimmed page around the panel
  const onDialogClick = (e: React.MouseEvent) => {
    if (e.target === dialog.current) dialog.current?.close();
  };

  const link = shown?.group[shown.at];
  const caption = link?.dataset.caption ?? "";
  const count = shown && shown.group.length > 1 ? countLabel.replace("{n}", String(shown.at + 1)).replace("{count}", String(shown.group.length)) : "";

  return (
    <dialog ref={dialog} className="lp-viewer" aria-label={label} onClose={onClose} onClick={onDialogClick} onKeyDown={onKeyDown}>
      <div className="lp-viewer-in">
        <div className="lp-viewer-bar">
          <span className="lp-viewer-count">{count}</span>
          <button type="button" className="lp-button" onClick={() => dialog.current?.close()}>
            {closeLabel}
          </button>
        </div>
        <div className="lp-viewer-stage">{link && <img src={link.getAttribute("href") ?? ""} alt={caption} />}</div>
        <p className="lp-viewer-caption">{caption}</p>
      </div>
    </dialog>
  );
}
