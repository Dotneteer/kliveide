import { RefObject, useEffect, useRef, useState } from "react";
import {
  ChromeInputs,
  ChromeState,
  INITIAL_CHROME_STATE,
  isEdgeVisible,
  nextDeadline,
  REVEAL_ZONE_PX,
  stepChrome
} from "./fullScreenChromeModel";

/** Popups that belong to a revealed bar: toolbar split-button and overflow menus, dropdown lists */
const HOLDING_POPUPS = '[role="menu"], [role="listbox"]';

/**
 * Feeds the full screen mode's reveal model (`fullScreenChromeModel.ts`) from the pointer, and says
 * which bars are on screen.
 *
 * Popups render through portals into `#overlayRoot`, outside the bars' DOM: a pointer over one
 * counts as over the bars, and an open menu or a dialog (`dialogOpen`) holds them. The captured
 * mouse is the pointer lock; with it no bar is revealed.
 *
 * @param enabled Whether the mode is on; off, both bars are hidden and nothing is listened to
 * @param toolbarRef The toolbar's edge bar
 * @param statusBarRef The status bar's edge bar
 * @param dialogOpen A modal dialog is open (the store's `dimMenu`)
 * @param topInset The toolbar's offset from the top edge in CSS pixels (the macOS menu bar)
 */
export function useFullScreenChrome(
  enabled: boolean,
  toolbarRef: RefObject<HTMLElement>,
  statusBarRef: RefObject<HTMLElement>,
  dialogOpen: boolean,
  topInset = 0
): { toolbarShown: boolean; statusBarShown: boolean } {
  const [state, setState] = useState<ChromeState>(INITIAL_CHROME_STATE);
  const stateRef = useRef(state);
  const pointer = useRef<{ y?: number; target?: EventTarget | null }>({});
  const dialogOpenRef = useRef(dialogOpen);
  const topInsetRef = useRef(topInset);
  topInsetRef.current = topInset;
  const evaluateRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) {
      stateRef.current = INITIAL_CHROME_STATE;
      setState(INITIAL_CHROME_STATE);
      pointer.current = {};
      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const evaluate = (): void => {
      const now = performance.now();
      const target = pointer.current.target instanceof Node ? pointer.current.target : null;
      const overlay = document.getElementById("overlayRoot");
      const inPopup = !!target && !!overlay?.contains(target);
      const inputs: ChromeInputs = {
        pointerY: pointer.current.y,
        windowHeight: window.innerHeight,
        overToolbar: inPopup || (!!target && !!toolbarRef.current?.contains(target)),
        overStatusBar: inPopup || (!!target && !!statusBarRef.current?.contains(target)),
        held: dialogOpenRef.current || !!overlay?.querySelector(HOLDING_POPUPS),
        captured: !!document.pointerLockElement,
        topInset: topInsetRef.current
      };
      const next = stepChrome(stateRef.current, inputs, now);
      if (next !== stateRef.current) {
        stateRef.current = next;
        setState(next);
      }
      clearTimeout(timer);
      timer = undefined;
      const deadline = nextDeadline(next);
      if (deadline !== undefined) {
        timer = setTimeout(evaluate, Math.max(0, deadline - now) + 1);
      }
    };
    evaluateRef.current = evaluate;

    const onMove = (e: MouseEvent): void => {
      pointer.current = { y: e.clientY, target: e.target };
      evaluate();
    };
    const onLeave = (): void => {
      // --- Through the top edge under a macOS menu bar, the pointer went onto the menu bar, not out
      // --- of the window: keep its last position, so the toolbar below the menu bar stays
      const y = pointer.current.y;
      if (!(topInsetRef.current > 0 && y !== undefined && y < REVEAL_ZONE_PX)) pointer.current = {};
      evaluate();
    };

    document.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("pointerlockchange", evaluate);

    // --- A popup closing (or opening) with the pointer at rest must re-evaluate the hold
    const overlay = document.getElementById("overlayRoot");
    const observer = overlay ? new MutationObserver(evaluate) : undefined;
    observer?.observe(overlay, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("pointerlockchange", evaluate);
      evaluateRef.current = () => {};
    };
  }, [enabled, toolbarRef, statusBarRef]);

  // --- A dialog closing releases the bars it held
  useEffect(() => {
    dialogOpenRef.current = dialogOpen;
    evaluateRef.current();
  }, [dialogOpen]);

  return {
    toolbarShown: enabled && isEdgeVisible(state.toolbar),
    statusBarShown: enabled && isEdgeVisible(state.statusBar)
  };
}

/**
 * CSS pixels per screen point while the window covers its display (the full screen mode): the page
 * zoom divides points into fewer CSS pixels. Follows zoom changes, which resize the page.
 */
export function useCssPixelsPerPoint(enabled: boolean): number {
  const measure = (): number =>
    window.screen?.height > 0 && window.innerHeight > 0 ? window.innerHeight / window.screen.height : 1;
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    if (!enabled) return undefined;
    const update = (): void => setRatio(measure());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled]);
  return ratio;
}
