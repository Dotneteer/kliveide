import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import classnames from "classnames";
import { Icon } from "@renderer/controls/Icon";
import { useOverlayRoot } from "@renderer/controls/overlay/useOverlayRoot";
import { iconSizes } from "@renderer/theming/tokens/dimensions";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import type { NavigationReason } from "@renderer/abstractions/NavigationLocation";
import styles from "./NavigationControls.module.scss";
import { useT } from "@common/i18n/useT";
import { labelRecord } from "@common/i18n/labels";
import type { MessageKey } from "@common/i18n/keys.generated";

/** How each reason reads in the list. */
const REASON_KEYS: Record<NavigationReason, MessageKey> = {
  definition: "panels.feature.navigation.reason.definition",
  outputLink: "panels.feature.navigation.reason.outputLink",
  breakpoint: "panels.feature.navigation.reason.breakpoint",
  memoryGoTo: "panels.feature.navigation.reason.goTo",
  disassemblyGoTo: "panels.feature.navigation.reason.goTo",
  nexLabel: "panels.feature.navigation.reason.label",
  nexBank: "panels.feature.navigation.reason.bank",
  z88Bank: "panels.feature.navigation.reason.bank",
  spectrumBank: "panels.feature.navigation.reason.bank",
  tapeBlock: "panels.feature.navigation.reason.block",
  pFileRegion: "panels.feature.navigation.reason.part",
  tabSwitch: "panels.feature.navigation.reason.tab",
  explorer: "panels.feature.navigation.reason.explorer",
  command: "panels.feature.navigation.reason.command",
  profiler: "panels.feature.navigation.reason.profiler",
  unitTest: "panels.feature.navigation.reason.unitTest"
};

/** How each reason reads in the list (translated on each read) */
export const REASON_LABELS: Readonly<Record<NavigationReason, string>> = labelRecord(REASON_KEYS);

type Props = {
  /** The element the list hangs from. */
  anchor: HTMLElement | null;
  /** Already formatted for display. */
  shortcuts: { back: string; forward: string };
  onClose: () => void;
};

/**
 * The navigation history as a list: newest at the top, the current entry marked, entries Go Forward
 * would reach dimmed above it. Choosing a row goes there.
 *
 * Keyboard: the current row takes focus on open; arrows move, Enter chooses, Escape closes.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §6.
 */
export const NavigationHistoryPopover = ({ anchor, shortcuts, onClose }: Props) => {
  const t = useT();
  const { navigationHistoryService: history } = useAppServices();
  useSelector((s) => s.ideView?.navHistory);
  const overlayRoot = useOverlayRoot();
  const boxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>();

  const { entries, index } = history.getEntries();
  // --- Newest first; keep each entry's history index for `goTo`.
  const rows = entries.map((entry, i) => ({ entry, i })).reverse();

  useLayoutEffect(() => {
    const bounds = anchor?.getBoundingClientRect();
    setPosition(bounds ? { top: bounds.bottom + 4, left: bounds.left } : { top: 48, left: 8 });
  }, [anchor]);

  // --- Focus the current row once the list is on screen.
  useEffect(() => {
    if (!position) return;
    const current = boxRef.current?.querySelector<HTMLButtonElement>('[data-current="true"]');
    (current ?? boxRef.current?.querySelector<HTMLButtonElement>("button[data-row]"))?.focus();
  }, [position]);

  // --- Close on a press outside the list or its anchor (the chevron toggles it itself).
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown, true);
    return () => document.removeEventListener("mousedown", onPointerDown, true);
  }, [anchor, onClose]);

  const choose = (i: number) => {
    onClose();
    void history.goTo(i);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      anchor?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(
      boxRef.current?.querySelectorAll<HTMLButtonElement>("button[data-row]") ?? []
    );
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? at + 1 : at - 1;
    buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
  };

  if (!position) return null;

  const box = (
    <div
      ref={boxRef}
      className={styles.popover}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={t("panels.feature.navigation.history")}
      onKeyDown={onKeyDown}
    >
      <div className={styles.popoverHeader}>
        <span className={styles.popoverTitle}>{t("panels.feature.navigation.history")}</span>
        <span className={styles.popoverCount}>{entries.length}</span>
        <span className={styles.popoverSpacer} />
        <button
          type="button"
          className={styles.clearButton}
          disabled={entries.length === 0}
          onClick={() => {
            history.clear();
            onClose();
          }}
        >
          {t("panels.feature.navigation.clear")}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className={styles.emptyHistory}>
          {t("panels.feature.navigation.empty")}
        </div>
      ) : (
        <div className={styles.historyList} role="listbox" aria-label={t("panels.feature.navigation.locations")}>
          {rows.map(({ entry, i }) => {
            const position = history.describe(entry);
            const preview = history.preview(entry);
            const current = i === index;
            return (
              <button
                key={`${i}:${entry.documentId}:${entry.time}`}
                type="button"
                role="option"
                aria-selected={current}
                data-row={i}
                data-current={current ? "true" : undefined}
                className={classnames(styles.historyRow, {
                  [styles.current]: current,
                  [styles.ahead]: i > index
                })}
                title={entry.documentId}
                onClick={() => choose(i)}
              >
                <span className={styles.rowIcon}>
                  <Icon
                    iconName={entry.iconName ?? "note"}
                    width={iconSizes.sm}
                    height={iconSizes.sm}
                  />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>
                    {entry.title}
                    {position && <span className={styles.rowPosition}>{position}</span>}
                  </span>
                  {preview && <span className={styles.rowPreview}>{preview}</span>}
                </span>
                <span className={styles.reasonChip}>{REASON_LABELS[entry.reason] ?? entry.reason}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className={styles.popoverFooter}>
        <span>
          <kbd>{shortcuts.back}</kbd> {t("panels.feature.navigation.footerBack")}
        </span>
        <span>
          <kbd>{shortcuts.forward}</kbd> {t("panels.feature.navigation.footerForward")}
        </span>
      </div>
    </div>
  );

  return overlayRoot ? createPortal(box, overlayRoot) : box;
};
