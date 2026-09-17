import { useCallback, useRef, useState } from "react";
import { IconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { SECONDARY_ICON_SIZE } from "@renderer/controls/toolbar-constants";
import { iconSizes } from "@renderer/theming/tokens/dimensions";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { readNavigationShortcuts } from "@common/utils/navigationShortcuts";
import type { NavigationEntry } from "@renderer/abstractions/NavigationLocation";
import type { INavigationHistoryService } from "@renderer/abstractions/INavigationHistoryService";
import { NavigationHistoryPopover } from "./NavigationHistoryPopover";
import { IS_MAC, formatAccelerator } from "./useNavigationShortcuts";
import styles from "./NavigationControls.module.scss";

/**
 * Back, the history list, and Forward — the start of the IDE toolbar (Option A of
 * `.plans/NAVIGATION_HISTORY_PLAN.md` §6).
 *
 * Enabled state and tooltips are computed from the service on every render, not taken from the
 * published `ideView.navHistory` flags: whether Back has somewhere to go depends on the active
 * document, which changes without the history changing. The selectors below exist only to re-render
 * on the events that can change the answer — a history change, a document activation, a shortcut
 * setting change.
 */
export const NavigationControls = () => {
  const { navigationHistoryService: history } = useAppServices();
  const { store } = useRendererContext();
  useSelector((s) => s.ideView?.navHistory);
  useSelector((s) => s.ideView?.documentHubState);
  useSelector((s) => s.userSettings);

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);

  const shortcuts = readNavigationShortcuts(store.getState(), IS_MAC);
  const canGoBack = history.canGoBack();
  const canGoForward = history.canGoForward();
  const hasEntries = history.getEntries().entries.length > 0;

  return (
    <>
      <span ref={anchorRef} className={styles.navGroup}>
        <IconButton
          iconName="arrow-left"
          iconSize={SECONDARY_ICON_SIZE}
          fill="--color-toolbarbutton"
          title={navigationTitle(
            "Back",
            canGoBack ? history.peekBack() : undefined,
            history,
            formatAccelerator(shortcuts.back)
          )}
          enable={canGoBack}
          clicked={() => void history.goBack()}
        />
        <IconButton
          iconName="chevron-down"
          iconSize={iconSizes.xs}
          buttonWidth={12}
          fill="--color-toolbarbutton"
          title="Show navigation history"
          enable={hasEntries}
          clicked={() => setOpen((o) => !o)}
        />
        <IconButton
          iconName="arrow-right"
          iconSize={SECONDARY_ICON_SIZE}
          fill="--color-toolbarbutton"
          title={navigationTitle(
            "Forward",
            canGoForward ? history.peekForward() : undefined,
            history,
            formatAccelerator(shortcuts.forward)
          )}
          enable={canGoForward}
          clicked={() => void history.goForward()}
        />
      </span>
      <ToolbarSeparator />
      {open && (
        <NavigationHistoryPopover
          anchor={anchorRef.current}
          shortcuts={{
            back: formatAccelerator(shortcuts.back),
            forward: formatAccelerator(shortcuts.forward)
          }}
          onClose={close}
        />
      )}
    </>
  );
};

/** "Back to main.asm · line 42 (⌃-)", or "Go Back (⌃-)" when there is nowhere to go. */
export function navigationTitle(
  direction: "Back" | "Forward",
  target: NavigationEntry | undefined,
  history: Pick<INavigationHistoryService, "describe">,
  shortcut: string
): string {
  if (!target) return `Go ${direction} (${shortcut})`;
  const position = history.describe(target);
  return `${direction} to ${target.title}${position ? ` · ${position}` : ""} (${shortcut})`;
}
