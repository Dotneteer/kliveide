import { useCallback } from "react";
import { SpriteTools } from "./sprite-common";
import { SPRITE_DIM, SpritePoint, clampToSprite } from "./sprite-raster";
import { HoverStore } from "./sprite-hover";

/**
 * The sprite editor's keyboard map.
 *
 * The editor had **no keyboard at all** - not a tool shortcut, not undo, not an arrow key. The grid
 * carried `tabIndex={0}` and a focus style and listened for exactly one key, Escape, which did
 * nothing (see the Phase 2 notes).
 *
 * Three rules shape what is here:
 *
 * - **Nothing novel.** `P`/`L`/`R`/`E`/`F`, `X` to swap, `[`/`]` to step through the sheet,
 *   `+`/`-`/`0` for zoom: these are the bindings a pixel artist already has in their fingers, and
 *   the value is precisely that they are not new.
 * - **Only keys we actually handle are swallowed.** Anything with a modifier we do not claim falls
 *   through, so the app's own accelerators (F5, the debugger keys) still work with the editor
 *   focused, and typing into a field inside the editor would not be eaten.
 * - **One cursor.** Arrow keys write to the same store the pointer does, so there is no separate
 *   caret that can disagree with the mouse - and the status bar readout follows both.
 */

export type ShortcutActions = {
  selectTool: (tool: SpriteTools) => void;
  swapColors: () => void;
  undo: () => void;
  redo: () => void;
  previousSprite: () => void;
  nextSprite: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  /** Apply the current tool at the cursor, exactly as a click there would. */
  drawAtCursor: (at: SpritePoint) => void;
};

const TOOL_KEYS: Record<string, { plain: SpriteTools; shift?: SpriteTools }> = {
  m: { plain: "pointer" },
  p: { plain: "pencil" },
  l: { plain: "line" },
  r: { plain: "rectangle", shift: "rectangle-filled" },
  e: { plain: "circle", shift: "circle-filled" },
  f: { plain: "paint" }
};

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1]
};

/**
 * Where the keyboard cursor appears when nothing has been hovered yet.
 *
 * The **first** arrow press summons the cursor here and does not move it; subsequent presses move
 * it. Applying the delta immediately would offset it from an origin the user never saw, which is
 * the more confusing of the two - this way the first press answers "where am I" and every press
 * after it is a plain move.
 */
const HOME: SpritePoint = { row: SPRITE_DIM / 2, col: SPRITE_DIM / 2 };

export function useSpriteShortcuts(hover: HoverStore, actions: ShortcutActions) {
  const { drawAtCursor } = actions;

  const moveCursor = useCallback(
    (dRow: number, dCol: number) => {
      const current = hover.get();
      const next = current
        ? clampToSprite({ row: current.row + dRow, col: current.col + dCol })
        : HOME;
      // The colour is filled in by whoever owns the bitmap; -1 until then is fine, because the
      // grid re-publishes with the real index as soon as it draws.
      hover.set({ ...next, colorIndex: current?.colorIndex ?? -1 });
      return next;
    },
    [hover]
  );

  return useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      if (mod) {
        const key = e.key.toLowerCase();
        if (key === "z") {
          e.shiftKey ? actions.redo() : actions.undo();
          return handled();
        }
        // `Ctrl+Y` as well: the Windows convention, and what the toolbar's own Redo implies.
        if (key === "y") {
          actions.redo();
          return handled();
        }
        return; // any other modified key belongs to the app, not to us
      }
      if (e.altKey) return;

      if (ARROWS[e.key]) {
        moveCursor(...ARROWS[e.key]);
        return handled();
      }

      if (e.key === "Enter" || e.key === " ") {
        const at = hover.get() ?? HOME;
        drawAtCursor({ row: at.row, col: at.col });
        return handled();
      }

      const tool = TOOL_KEYS[e.key.toLowerCase()];
      if (tool) {
        actions.selectTool(e.shiftKey ? tool.shift ?? tool.plain : tool.plain);
        return handled();
      }

      switch (e.key) {
        case "x":
        case "X":
          actions.swapColors();
          return handled();
        case "[":
          actions.previousSprite();
          return handled();
        case "]":
          actions.nextSprite();
          return handled();
        case "+":
        case "=":
          actions.zoomIn();
          return handled();
        case "-":
        case "_":
          actions.zoomOut();
          return handled();
        case "0":
          actions.fit();
          return handled();
        default:
          return;
      }
    },
    [actions, drawAtCursor, hover, moveCursor]
  );
}
