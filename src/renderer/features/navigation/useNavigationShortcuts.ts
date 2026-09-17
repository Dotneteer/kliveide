import { useEffect } from "react";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import {
  matchesAccelerator,
  readNavigationShortcuts
} from "@common/utils/navigationShortcuts";

/** Whether the renderer runs on macOS (the same test the rest of the renderer uses). */
export const IS_MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform ?? "");

/** The mouse's "back" and "forward" side buttons (`MouseEvent.button`). */
const MOUSE_BACK = 3;
const MOUSE_FORWARD = 4;

/**
 * Go Back / Go Forward from the keyboard and the mouse's side buttons, while the IDE window has focus.
 *
 * The listener sits on `window` in the **capture** phase, so it sees the key before Monaco (or any
 * input) can act on it, and it marks the key handled. That matters twice over:
 *
 * - Monaco would otherwise consume some combinations for its own commands.
 * - Electron offers a key to the application menu only when the page leaves it unhandled, so the
 *   Go menu's accelerator does not fire a second time. The accelerator is still what makes the
 *   shortcut work while the emulator window has focus, where this hook is not mounted.
 *
 * The shortcuts are read on every key press rather than captured once, so a changed
 * `shortcuts.navigateBack` setting applies without a reload.
 *
 * See `.plans/NAVIGATION_HISTORY_PLAN.md` §5.
 */
export function useNavigationShortcuts(): void {
  const { store } = useRendererContext();
  const { navigationHistoryService } = useAppServices();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcuts = readNavigationShortcuts(store.getState(), IS_MAC);
      let go: (() => Promise<boolean>) | undefined;
      if (matchesAccelerator(event, shortcuts.back, IS_MAC)) {
        go = () => navigationHistoryService.goBack();
      } else if (matchesAccelerator(event, shortcuts.forward, IS_MAC)) {
        go = () => navigationHistoryService.goForward();
      }
      if (!go) return;
      event.preventDefault();
      event.stopPropagation();
      void go();
    };

    // --- Chromium turns the side buttons into history navigation on `mouseup`; the IDE page has no
    // --- history of its own, but suppressing the default keeps it that way.
    const isSideButton = (event: MouseEvent) =>
      event.button === MOUSE_BACK || event.button === MOUSE_FORWARD;
    const onMouseDown = (event: MouseEvent) => {
      if (isSideButton(event)) event.preventDefault();
    };
    const onMouseUp = (event: MouseEvent) => {
      if (!isSideButton(event)) return;
      event.preventDefault();
      event.stopPropagation();
      void (event.button === MOUSE_BACK
        ? navigationHistoryService.goBack()
        : navigationHistoryService.goForward());
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mouseup", onMouseUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };
  }, [store, navigationHistoryService]);
}

/**
 * An accelerator as the platform shows it in a tooltip: macOS's modifier glyphs, or the
 * accelerator's own spelling elsewhere.
 */
export function formatAccelerator(accelerator: string, isMac = IS_MAC): string {
  if (!isMac) return accelerator.replace(/\bLeft\b/, "←").replace(/\bRight\b/, "→");
  const glyphs: Record<string, string> = {
    ctrl: "⌃",
    control: "⌃",
    shift: "⇧",
    alt: "⌥",
    option: "⌥",
    cmd: "⌘",
    command: "⌘",
    cmdorctrl: "⌘",
    commandorcontrol: "⌘",
    left: "←",
    right: "→"
  };
  const parts = accelerator.split("+");
  const key = parts.pop() ?? "";
  return parts.map((p) => glyphs[p.toLowerCase()] ?? p).join("") + (glyphs[key.toLowerCase()] ?? key);
}
