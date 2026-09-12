import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { SPRITE_SIZE } from "@renderer/features/sprite-editor/sprite-raster";
import { DEFAULT_SPRITE_TRANSPARENCY } from "@renderer/features/sprite-editor/sprite-file";
import { resetSpriteClipboard } from "@renderer/features/sprite-editor/sprite-clipboard";
import {
  DEFAULT_SHEET_HEIGHT,
  MIN_SHEET_HEIGHT
} from "@renderer/features/sprite-editor/sheet-metrics";

/*
 * What this file is for.
 *
 * Phase 1 of the sprite editor plan changed *when* the editor writes to disk, and nothing else
 * visible. The old editor rebuilt the whole file and awaited a non-debounced IPC save on every
 * pixel of a drag - and wrote the file merely for being opened. Those are behaviours, not pixels,
 * so they are pinned here rather than by a screenshot.
 */

const setDocumentViewState = vi.fn();
const saveFileContent = vi.fn().mockResolvedValue(undefined);

vi.mock("@renderer/appIde/services/DocumentServiceProvider", () => ({
  useDocumentHubService: () => ({ setDocumentViewState })
}));
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ projectService: { saveFileContent } })
}));
vi.mock("@renderer/controls/layout/Panel", () => ({
  Panel: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));
vi.mock("@renderer/controls/ScrollViewer", () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));
// A theme stub thin enough to be obviously inert, but complete enough for `Icon`: the sprite
// toolbars are all `@`-prefixed stock icons, which take the `getImage` path.
vi.mock("@renderer/theming/ThemeProvider", () => ({
  useTheme: () => ({
    theme: { tone: "dark" },
    getThemeProperty: () => "#ffffff",
    getIcon: () => ({ kind: "path", fill: "#ffffff", paint: "" }),
    getImage: () => ({ type: "svg+xml", data: "" })
  })
}));
// jsdom has no 2d canvas context, and the sprite strip is not what is under test here.
vi.mock("@renderer/controls/Next/ScreenCanvas", () => ({
  ScreenCanvas: () => <div data-testid="thumb" />
}));
vi.mock("@renderer/controls/Tooltip", () => ({
  TooltipFactory: () => null,
  Tooltip: () => null,
  useTooltipRef: () => ({ current: null })
}));

/*
 * The sprite palette now comes from the machine. `paletteInfo = null` makes the API throw the way
 * it does with no controller (or a machine that is not a Next), which is the editor's fallback path
 * and the default for every test that is not about the palette.
 */
let paletteInfo: Record<string, unknown> | null = null;
const getPalettedDeviceInfo = vi.fn(async () => {
  if (!paletteInfo) throw new Error("Machine controller not available");
  return paletteInfo;
});
vi.mock("@renderer/core/EmuApi", () => ({
  useEmuApi: () => ({ getPalettedDeviceInfo })
}));
vi.mock("@renderer/appIde/useStateRefresh", async () => {
  const React = await import("react");
  return {
    useEmuStateListener: (_api: unknown, cb: () => void) => {
      React.useEffect(() => {
        void cb();
      }, [cb]);
    }
  };
});

const { createSprFileEditorPanel } = await import(
  "@renderer/features/sprite-editor/SprFileEditorPanel"
);

/** A file of `count` sprites, each filled with a distinct value, plus optional trailing bytes. */
const fileOf = (count: number, extra = 0) => {
  const bytes = new Uint8Array(count * SPRITE_SIZE + extra);
  for (let i = 0; i < count; i++) bytes.fill(i + 1, i * SPRITE_SIZE, (i + 1) * SPRITE_SIZE);
  for (let i = 0; i < extra; i++) bytes[count * SPRITE_SIZE + i] = 0xa0 + i;
  return bytes;
};

const renderEditor = (contents: Uint8Array) =>
  render(
    createSprFileEditorPanel({
      document: { id: "spr-1" } as any,
      contents,
      viewState: {},
      apiLoaded: () => {}
    } as any)
  );

/** The 256 pixel `<rect>`s of the editable grid, in row-major order. */
const gridCells = (container: HTMLElement) => {
  const rects = [...container.querySelectorAll('[data-role="pixels"] rect')];
  expect(rects.length).toBe(SPRITE_SIZE);
  return rects;
};
const cellAt = (container: HTMLElement, row: number, col: number) =>
  gridCells(container)[row * 16 + col];

/**
 * The sheet browser's cells.
 *
 * They are `role="option"` inside a `role="listbox"`, so the tests address them the way a screen
 * reader would rather than through a `data-testid` on a mocked canvas.
 */
const sheetCells = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="option"]')] as HTMLElement[];

/** Pick the pencil, which is the tool whose old save-per-pixel behaviour this pins. */
const selectPencil = (container: HTMLElement) => {
  // `title` reaches the DOM as `aria-label` (IconButton.tsx). This used to match TWO buttons -
  // the pointer tool carried the pencil's label - and would silently have picked the wrong one.
  // `button()` still asserts exactly one match, so that regression stays covered.
  fireEvent.click(button(container, "Pencil tool"));
};

/** Let the palette fetch settle; it is a promise, so timers are not involved. */
const flushPalette = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  // Module state: a copy in one test would otherwise light up Paste in the next.
  resetSpriteClipboard();
  paletteInfo = null;
  getPalettedDeviceInfo.mockClear();
  setDocumentViewState.mockClear();
  saveFileContent.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("SpriteEditor - when the file is written", () => {
  it("does not write the file merely for being opened", () => {
    renderEditor(fileOf(3));
    vi.advanceTimersByTime(5000);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it("does not write the file when a different sprite is selected", () => {
    const { container } = renderEditor(fileOf(3));
    const cells = sheetCells(container);
    expect(cells.length).toBe(3);
    fireEvent.click(cells[2]);
    vi.advanceTimersByTime(5000);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  /*
   * The headline regression. Every accepted mouse-move used to rebuild the whole file and await
   * `saveFileContent`, which `ProjectService` runs undebounced - one full IPC round trip per pixel.
   */
  it("writes once for a whole stroke, not once per pixel", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);

    fireEvent.mouseDown(cellAt(container, 4, 4), { button: 0 });
    for (let col = 5; col <= 12; col++) {
      fireEvent.mouseEnter(cellAt(container, 4, col));
    }
    fireEvent.mouseUp(cellAt(container, 4, 12));

    // Nothing yet: the write is debounced past the end of the stroke.
    expect(saveFileContent).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(saveFileContent).toHaveBeenCalledTimes(1);
  });

  it("coalesces a burst of separate operations into one write", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);

    for (const col of [2, 4, 6]) {
      fireEvent.mouseDown(cellAt(container, 6, col), { button: 0 });
      fireEvent.mouseUp(cellAt(container, 6, col));
      vi.advanceTimersByTime(50); // well inside the debounce window
    }
    vi.advanceTimersByTime(1000);
    expect(saveFileContent).toHaveBeenCalledTimes(1);
  });

  it("writes a sheet of the right size, and preserves a partial tail", () => {
    const { container } = renderEditor(fileOf(2, 3));
    selectPencil(container);
    fireEvent.mouseDown(cellAt(container, 0, 0), { button: 0 });
    fireEvent.mouseUp(cellAt(container, 0, 0));
    vi.advanceTimersByTime(1000);

    expect(saveFileContent).toHaveBeenCalledTimes(1);
    const written = saveFileContent.mock.calls[0][1] as Uint8Array;
    expect(written.length).toBe(2 * SPRITE_SIZE + 3);
    expect([...written.subarray(2 * SPRITE_SIZE)]).toEqual([0xa0, 0xa1, 0xa2]);
  });

  it("does not write, or push an undo entry, for a click that drew nothing", () => {
    const { container } = renderEditor(fileOf(1));
    // The select tool is the default and draws nothing.
    fireEvent.mouseDown(cellAt(container, 3, 3), { button: 0 });
    fireEvent.mouseUp(cellAt(container, 3, 3));
    vi.advanceTimersByTime(1000);
    expect(saveFileContent).not.toHaveBeenCalled();
  });
});

describe("SpriteEditor - files that used to break it", () => {
  it("renders an empty file instead of crashing", () => {
    // `sprites` was `[]`, `spriteMap` was `undefined`, and the grid did `Array.from(undefined)`.
    const { container } = renderEditor(new Uint8Array(0));
    expect(gridCells(container).length).toBe(SPRITE_SIZE);
    expect(sheetCells(container).length).toBe(1);
  });

  it("renders a file whose length is not a multiple of the sprite size", () => {
    // This used to throw inside BinaryReader and report the WHOLE file invalid.
    const { container } = renderEditor(fileOf(2, 3));
    expect(sheetCells(container).length).toBe(2);
    expect(gridCells(container).length).toBe(SPRITE_SIZE);
  });

  it("renders a file shorter than one sprite", () => {
    const { container } = renderEditor(Uint8Array.from([1, 2, 3]));
    expect(sheetCells(container).length).toBe(1);
  });

  it("is still editable after opening an empty file", () => {
    const { container } = renderEditor(new Uint8Array(0));
    selectPencil(container);
    fireEvent.mouseDown(cellAt(container, 5, 5), { button: 0 });
    fireEvent.mouseUp(cellAt(container, 5, 5));
    vi.advanceTimersByTime(1000);

    expect(saveFileContent).toHaveBeenCalledTimes(1);
    const written = saveFileContent.mock.calls[0][1] as Uint8Array;
    expect(written.length).toBe(SPRITE_SIZE);
    expect(written[5 * 16 + 5]).not.toBe(DEFAULT_SPRITE_TRANSPARENCY);
  });
});

/* --------------------------------------------------------------------------------------------
 * Phase 2: the undo model, Escape, and the operations that never reached the disk.
 * ------------------------------------------------------------------------------------------ */

/** The "Sprite #N of M" readout, which is how the selection is observable from outside. */
const selectionLabel = (container: HTMLElement) =>
  [...container.querySelectorAll("*")]
    .map((e) => e.textContent ?? "")
    .find((t) => /^Sprite #\d+ of \d+$/.test(t));

/**
 * Buttons by the *start* of their label.
 *
 * Labels carry their shortcut and, for the drawing tools, a note about right-dragging - so an exact
 * match would pin the tests to the help text rather than to the command.
 */
const button = (container: HTMLElement, label: string) => {
  const matches = [...container.querySelectorAll("button[aria-label]")].filter((b) =>
    (b.getAttribute("aria-label") ?? "").startsWith(label)
  ) as HTMLButtonElement[];
  expect(matches.length, `expected exactly one button labelled "${label}…"`).toBe(1);
  return matches[0];
};

const click = (container: HTMLElement, label: string) => {
  const btn = button(container, label);
  expect(btn.disabled).toBe(false);
  fireEvent.click(btn);
};

/** Paint the selected sprite with a single click of the pencil. */
const paintPixel = (container: HTMLElement, row: number, col: number) => {
  fireEvent.mouseDown(cellAt(container, row, col), { button: 0 });
  fireEvent.mouseUp(cellAt(container, row, col));
};

const lastWrite = () =>
  saveFileContent.mock.calls[saveFileContent.mock.calls.length - 1][1] as Uint8Array;

describe("SpriteEditor - undo", () => {
  /*
   * THE data-loss bug. The edit record carried no sprite index and undo wrote through the
   * "currently selected sprite" path, so this exact sequence overwrote sprite 3 with sprite 1's
   * old bitmap.
   */
  it("undoes a pixel edit on the sprite it was made to, not the one now selected", () => {
    const { container } = renderEditor(fileOf(3));

    selectPencil(container);
    paintPixel(container, 4, 4); // edit sprite 0
    fireEvent.click(sheetCells(container)[2]); // now look at sprite 2
    expect(selectionLabel(container)).toBe("Sprite #3 of 3");

    click(container, "Undo");
    vi.advanceTimersByTime(1000);

    const written = lastWrite();
    // Sprite 0 is back to its original fill, and sprite 2 was never touched.
    expect([...written.subarray(0, SPRITE_SIZE)].every((v) => v === 1)).toBe(true);
    expect([...written.subarray(2 * SPRITE_SIZE, 3 * SPRITE_SIZE)].every((v) => v === 3)).toBe(true);
  });

  it("navigates to the sprite an undo affected", () => {
    const { container } = renderEditor(fileOf(3));
    selectPencil(container);
    paintPixel(container, 4, 4);
    fireEvent.click(sheetCells(container)[2]);
    expect(selectionLabel(container)).toBe("Sprite #3 of 3");

    click(container, "Undo");
    expect(selectionLabel(container)).toBe("Sprite #1 of 3");
  });

  // Undo, redo and Cut each mutated the sprite array and returned without scheduling a write.
  it("writes the file when an undo is performed", () => {
    const { container } = renderEditor(fileOf(2));
    selectPencil(container);
    paintPixel(container, 1, 1);
    vi.advanceTimersByTime(1000);
    saveFileContent.mockClear();

    click(container, "Undo");
    vi.advanceTimersByTime(1000);
    expect(saveFileContent).toHaveBeenCalledTimes(1);
  });

  it("writes the file when a sprite is deleted", () => {
    const { container } = renderEditor(fileOf(3));
    click(container, "Delete sprite");
    vi.advanceTimersByTime(1000);

    expect(saveFileContent).toHaveBeenCalledTimes(1);
    expect(lastWrite().length).toBe(2 * SPRITE_SIZE);
  });

  it("restores a deleted sprite on undo, and writes that too", () => {
    const { container } = renderEditor(fileOf(3));
    click(container, "Delete sprite");
    vi.advanceTimersByTime(1000);
    click(container, "Undo");
    vi.advanceTimersByTime(1000);

    expect(saveFileContent).toHaveBeenCalledTimes(2);
    expect(lastWrite().length).toBe(3 * SPRITE_SIZE);
  });

  it("disables Undo and Redo at the ends of the history", () => {
    const { container } = renderEditor(fileOf(2));
    const undoBtn = () => button(container, "Undo");
    const redoBtn = () => button(container, "Redo");

    expect(undoBtn().disabled).toBe(true);
    expect(redoBtn().disabled).toBe(true);

    selectPencil(container);
    paintPixel(container, 2, 2);
    expect(undoBtn().disabled).toBe(false);
    expect(redoBtn().disabled).toBe(true);

    click(container, "Undo");
    expect(undoBtn().disabled).toBe(true);
    expect(redoBtn().disabled).toBe(false);
  });
});

describe("SpriteEditor - sheet operations", () => {
  it("duplicates AFTER the selection and selects the copy", () => {
    // Duplicate and Add both used to insert *before* the selection.
    const { container } = renderEditor(fileOf(3));
    expect(selectionLabel(container)).toBe("Sprite #1 of 3");

    click(container, "Duplicate sprite");
    vi.advanceTimersByTime(1000);

    expect(selectionLabel(container)).toBe("Sprite #2 of 4");
    const written = lastWrite();
    expect(written.length).toBe(4 * SPRITE_SIZE);
    // The copy sits at index 1, between the original and what used to be sprite 2.
    expect(written[0]).toBe(1);
    expect(written[SPRITE_SIZE]).toBe(1);
    expect(written[2 * SPRITE_SIZE]).toBe(2);
  });

  it("adds a blank sprite after the selection", () => {
    const { container } = renderEditor(fileOf(2));
    click(container, "Add new sprite");
    vi.advanceTimersByTime(1000);

    expect(selectionLabel(container)).toBe("Sprite #2 of 3");
    const written = lastWrite();
    expect(written[SPRITE_SIZE]).toBe(DEFAULT_SPRITE_TRANSPARENCY);
  });

  it("refuses to delete the only sprite", () => {
    const { container } = renderEditor(fileOf(1));
    expect(button(container, "Delete sprite").disabled).toBe(true);
  });
});

describe("SpriteEditor - Escape", () => {
  const grid = (container: HTMLElement) =>
    (container.querySelector("rect") as SVGElement).closest("[tabindex]") as HTMLElement;

  /*
   * Escape used to write `vs.currentTool = "pointer"` straight into the view state without calling
   * `setCurrentTool`, so the toolbar and the grid kept the old tool - and the view-state sync
   * effect then overwrote the value again. It did nothing at all except cancel the drag.
   */
  it("cancels a drag in progress without committing an edit or a write", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);

    fireEvent.mouseDown(cellAt(container, 7, 7), { button: 0 });
    fireEvent.keyDown(grid(container), { key: "Escape" });
    fireEvent.mouseUp(cellAt(container, 7, 7));
    vi.advanceTimersByTime(1000);

    expect(saveFileContent).not.toHaveBeenCalled();
    expect(button(container, "Undo").disabled).toBe(true);
  });

  it("keeps the tool while cancelling a drag, and backs out to Select when nothing is in flight", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);
    const pencil = () => button(container, "Pencil tool");
    const pointer = () => button(container, "Select tool");
    expect(pencil().getAttribute("aria-pressed")).toBe("true");

    // Escape during a drag cancels the stroke but must not take the tool away.
    fireEvent.mouseDown(cellAt(container, 7, 7), { button: 0 });
    fireEvent.keyDown(grid(container), { key: "Escape" });
    expect(pencil().getAttribute("aria-pressed")).toBe("true");

    // A second Escape, with nothing in flight, backs out to the pointer.
    fireEvent.keyDown(grid(container), { key: "Escape" });
    expect(pointer().getAttribute("aria-pressed")).toBe("true");
    expect(pencil().getAttribute("aria-pressed")).toBe("false");
  });
});

/* --------------------------------------------------------------------------------------------
 * Phase 4: the palette comes from the machine, not from an invented ramp.
 * ------------------------------------------------------------------------------------------ */

/**
 * A palette in the layout `PaletteDevice` actually stores - straight 9-bit RGB333 - so these tests
 * exercise the `paletteCodeFromDeviceValue` conversion rather than assuming it away. The two banks
 * are given different colours so switching bank is observable.
 */
const deviceInfo = (overrides: Record<string, unknown> = {}) => ({
  // Device layout: RRRGGGBBB. 0b111_000_000 = pure red, 0b000_000_111 = pure blue.
  spriteFirst: Array.from({ length: 256 }, (_, i) => (i === 1 ? 0b111_000_000 : i)),
  spriteSecond: Array.from({ length: 256 }, (_, i) => (i === 1 ? 0b000_000_111 : i)),
  spriteTransparencyIndex: 0xe3,
  reg43Value: 0,
  ...overrides
});

const swatch = (container: HTMLElement, index: number) =>
  container.querySelector(
    `[role="gridcell"][aria-label="$${index.toString(16).toUpperCase().padStart(2, "0")}"]`
  ) as HTMLElement;

const bankButton = (container: HTMLElement, name: RegExp) =>
  [...container.querySelectorAll("button[aria-label]")].find((b) =>
    name.test(b.getAttribute("aria-label") ?? "")
  ) as HTMLButtonElement;

describe("SpriteEditor - the sprite palette", () => {
  it("falls back to the index ramp with no machine, and says so", async () => {
    // A silently-wrong palette still looks like a palette; the fallback has to be visible.
    const { container } = renderEditor(fileOf(1));
    await flushPalette();
    expect(container.textContent).toContain("No machine");
    /*
     * $01 in the ramp is blue level **2**, not 1 - and that is the ramp's whole problem in one
     * value. The low blue bit lives in bit 8 of the register layout, which an index 0..255 never
     * sets, so the ramp can only produce even blue levels: four of the Next's eight, no pure blue
     * and no pure white.
     */
    expect(swatch(container, 1).style.backgroundColor).toBe("rgb(0, 0, 73)");
  });

  it("draws the machine's sprite palette, converted out of the device layout", async () => {
    paletteInfo = deviceInfo();
    const { container } = renderEditor(fileOf(1));
    await flushPalette();

    expect(container.textContent).not.toContain("No machine");
    expect(container.textContent).toContain("Sprite palette");
    // 0b111_000_000 is pure red once rotated into the register layout. Feeding the device value
    // straight through - which is the bug this conversion exists to prevent - would give #240000.
    expect(swatch(container, 1).style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("shows the other bank when it is pinned, and marks which one is live", async () => {
    paletteInfo = deviceInfo();
    const { container } = renderEditor(fileOf(1));
    await flushPalette();

    const first = bankButton(container, /^First sprite palette/);
    const second = bankButton(container, /^Second sprite palette/);
    // Reg $43 bit 3 clear means bank 1 is live, and the view follows it by default.
    expect(first.getAttribute("aria-label")).toContain("(live)");
    expect(first.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(second);
    expect(second.getAttribute("aria-pressed")).toBe("true");
    // The second bank paints $01 pure blue - a colour the index ramp cannot even express.
    expect(swatch(container, 1).style.backgroundColor).toBe("rgb(0, 0, 255)");
    // The live marker stays on the bank the machine is using, which is now not the one shown.
    expect(first.getAttribute("aria-label")).toContain("(live)");
    expect(second.getAttribute("aria-label")).not.toContain("(live)");
  });

  it("follows the live bank the machine selects", async () => {
    paletteInfo = deviceInfo({ reg43Value: 0x08 }); // bit 3 set: second bank is live
    const { container } = renderEditor(fileOf(1));
    await flushPalette();

    expect(bankButton(container, /^Second sprite palette/).getAttribute("aria-label")).toContain(
      "(live)"
    );
    expect(swatch(container, 1).style.backgroundColor).toBe("rgb(0, 0, 255)");
  });

  it("takes the transparency index from the machine, not from a hardcoded 0xE3", async () => {
    // Eight separate `0xe3` literals used to decide this.
    paletteInfo = deviceInfo({ spriteTransparencyIndex: 0x07 });
    const { container } = renderEditor(fileOf(1));
    await flushPalette();

    click(container, "Add new sprite");
    vi.advanceTimersByTime(1000);
    const written = lastWrite();
    expect(written[SPRITE_SIZE]).toBe(0x07);
    expect(written[SPRITE_SIZE]).not.toBe(DEFAULT_SPRITE_TRANSPARENCY);
  });

  it("shows the pen colour as the palette's selection", async () => {
    // `NextPaletteViewer` has always accepted `selectedIndex`; the editor never passed it, so the
    // palette showed no selection at all - including the colour restored from the view state.
    paletteInfo = deviceInfo();
    const { container } = renderEditor(fileOf(1));
    await flushPalette();

    const selected = container.querySelectorAll('[role="gridcell"][aria-selected="true"]');
    expect(selected.length).toBe(1);
    expect(selected[0].getAttribute("aria-label")).toBe("$0F"); // the default pen colour
  });
});

/* --------------------------------------------------------------------------------------------
 * Phase 6: the keyboard. The editor previously had none at all - not a tool shortcut, not undo,
 * not an arrow key.
 * ------------------------------------------------------------------------------------------ */

/** The editor root, which is where the shortcuts live so they work wherever focus is inside it. */
const editorRoot = (container: HTMLElement) =>
  (container.querySelector('[data-role="pixels"]') as SVGElement).closest(
    "[tabindex='-1']"
  ) as HTMLElement;

const press = (container: HTMLElement, key: string, init: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(editorRoot(container), { key, ...init });

const pressed = (container: HTMLElement, label: string) =>
  button(container, label).getAttribute("aria-pressed");

describe("SpriteEditor - keyboard", () => {
  it("selects tools by letter, with Shift for the filled variants", () => {
    const { container } = renderEditor(fileOf(1));
    const cases: Array<[string, boolean, string]> = [
      ["p", false, "Pencil tool"],
      ["l", false, "Line tool"],
      ["r", false, "Rectangle tool"],
      ["r", true, "Filled rectangle tool"],
      ["e", false, "Circle tool"],
      ["e", true, "Filled circle tool"],
      ["f", false, "Paint tool"],
      ["m", false, "Select tool"]
    ];
    for (const [key, shift, label] of cases) {
      press(container, key, { shiftKey: shift });
      expect(pressed(container, label), `${shift ? "Shift+" : ""}${key}`).toBe("true");
    }
  });

  it("swaps the pen and fill colours with X", () => {
    const { container } = renderEditor(fileOf(1));
    const chips = () =>
      [...container.querySelectorAll("[class*=colorSample]")].map(
        (e) => (e as HTMLElement).style.backgroundColor
      );
    const [penBefore, fillBefore] = chips();
    expect(penBefore).not.toBe(fillBefore);
    press(container, "x");
    expect(chips()[0]).toBe(fillBefore);
    expect(chips()[1]).toBe(penBefore);
  });

  it("undoes and redoes with Ctrl+Z and Ctrl+Shift+Z", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);
    paintPixel(container, 4, 4);
    expect(button(container, "Undo").disabled).toBe(false);

    press(container, "z", { ctrlKey: true });
    expect(button(container, "Undo").disabled).toBe(true);
    expect(button(container, "Redo").disabled).toBe(false);

    press(container, "z", { ctrlKey: true, shiftKey: true });
    expect(button(container, "Undo").disabled).toBe(false);
  });

  it("accepts Cmd+Z and Ctrl+Y too", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);
    paintPixel(container, 4, 4);
    press(container, "z", { metaKey: true });
    expect(button(container, "Undo").disabled).toBe(true);
    press(container, "y", { ctrlKey: true });
    expect(button(container, "Undo").disabled).toBe(false);
  });

  it("steps through the sheet with [ and ]", () => {
    const { container } = renderEditor(fileOf(4));
    expect(selectionLabel(container)).toBe("Sprite #1 of 4");
    press(container, "]");
    expect(selectionLabel(container)).toBe("Sprite #2 of 4");
    press(container, "]");
    expect(selectionLabel(container)).toBe("Sprite #3 of 4");
    press(container, "[");
    expect(selectionLabel(container)).toBe("Sprite #2 of 4");
  });

  it("clamps sheet navigation at both ends", () => {
    const { container } = renderEditor(fileOf(2));
    press(container, "[");
    expect(selectionLabel(container)).toBe("Sprite #1 of 2");
    press(container, "]");
    press(container, "]");
    press(container, "]");
    expect(selectionLabel(container)).toBe("Sprite #2 of 2");
  });

  it("moves the cursor with the arrow keys and paints with Enter", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);
    // The first arrow summons the cursor to the centre (8,8) without moving it; the next two move.
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    press(container, "ArrowDown");
    press(container, "Enter");
    vi.advanceTimersByTime(1000);

    const written = lastWrite();
    const painted = [...written.subarray(0, SPRITE_SIZE)]
      .map((v, i) => (v !== 1 ? i : -1))
      .filter((i) => i >= 0);
    expect(painted.length).toBe(1);
    expect(painted[0]).toBe(9 * 16 + 9);
  });

  it("paints with Space as well, and the cursor cannot leave the sprite", () => {
    const { container } = renderEditor(fileOf(1));
    selectPencil(container);
    for (let i = 0; i < 20; i++) press(container, "ArrowLeft");
    for (let i = 0; i < 20; i++) press(container, "ArrowUp");
    press(container, " ");
    vi.advanceTimersByTime(1000);

    const written = lastWrite();
    // Clamped to the top-left corner, not wrapped and not off the end.
    expect(written[0]).not.toBe(1);
    expect([...written.subarray(1, SPRITE_SIZE)].every((v) => v === 1)).toBe(true);
  });

  it("does nothing when the tool draws nothing", () => {
    const { container } = renderEditor(fileOf(1));
    press(container, "m"); // select
    press(container, "Enter");
    vi.advanceTimersByTime(1000);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  /*
   * Only keys the editor actually handles are swallowed, so the app's own accelerators still work
   * with the editor focused.
   */
  it("leaves unclaimed keys to the app", () => {
    const { container } = renderEditor(fileOf(1));
    const root = editorRoot(container);
    for (const [key, init] of [
      ["F5", {}],
      ["s", { ctrlKey: true }],
      ["p", { altKey: true }],
      ["q", {}]
    ] as Array<[string, KeyboardEventInit]>) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
      root.dispatchEvent(event);
      expect(event.defaultPrevented, `${key} should not be swallowed`).toBe(false);
    }
  });

  it("claims the keys it does handle", () => {
    const { container } = renderEditor(fileOf(1));
    const root = editorRoot(container);
    for (const [key, init] of [
      ["p", {}],
      ["ArrowUp", {}],
      ["]", {}],
      ["z", { ctrlKey: true }]
    ] as Array<[string, KeyboardEventInit]>) {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
      root.dispatchEvent(event);
      expect(event.defaultPrevented, `${key} should be handled`).toBe(true);
    }
  });
});

describe("SpriteEditor - discoverability", () => {
  it("publishes the shortcut in every tool's label", () => {
    const { container } = renderEditor(fileOf(1));
    for (const [label, hint] of [
      ["Pencil tool", "(P)"],
      ["Line tool", "(L)"],
      ["Filled rectangle tool", "(Shift+R)"],
      ["Filled circle tool", "(Shift+E)"],
      ["Paint tool", "(F)"],
      ["Undo", "(Ctrl+Z)"],
      ["Swap pen and fill colors", "(X)"]
    ]) {
      expect(button(container, label).getAttribute("aria-label")).toContain(hint);
    }
  });

  it("says out loud that right-dragging paints with the fill colour", () => {
    // True since long before this work, and mentioned nowhere in the UI.
    const { container } = renderEditor(fileOf(1));
    expect(button(container, "Pencil tool").getAttribute("aria-label")).toContain("Right-drag");
  });
});

/* --------------------------------------------------------------------------------------------
 * Phase 7: the two features that render a sprite other than the selected one.
 * ------------------------------------------------------------------------------------------ */

/** Sprites where sprite 1 is fully transparent and sprite 2 has a distinctive block. */
const onionFile = () => {
  const bytes = new Uint8Array(2 * SPRITE_SIZE).fill(DEFAULT_SPRITE_TRANSPARENCY);
  // Sprite 1 (index 0) is the "previous" frame: give it four opaque pixels.
  for (const i of [0, 1, 16, 17]) bytes[i] = 0x20;
  // Sprite 2 (index 1) is the one being edited: one opaque pixel, overlapping the first of those.
  bytes[SPRITE_SIZE + 0] = 0x30;
  return bytes;
};

const onionRects = (container: HTMLElement) =>
  [...container.querySelectorAll("g[opacity] rect")] as SVGElement[];

describe("SpriteEditor - onion skin", () => {
  it("is off by default, and unavailable on the first sprite", () => {
    const { container } = renderEditor(onionFile());
    const btn = button(container, "Onion skin");
    expect(btn.disabled).toBe(true); // no previous frame to ghost
    expect(onionRects(container).length).toBe(0);
  });

  it("ghosts the previous sprite through this one's transparent pixels only", () => {
    const { container } = renderEditor(onionFile());
    fireEvent.click(sheetCells(container)[1]); // select sprite 2
    click(container, "Show onion skin");

    /*
     * The previous sprite has four opaque pixels; one of them is underneath an opaque pixel of the
     * current sprite, so three ghosts are drawn. Drawing the fourth would put the neighbouring
     * frame on top of the work in progress.
     */
    expect(onionRects(container).length).toBe(3);
  });

  it("hides again when toggled off", () => {
    const { container } = renderEditor(onionFile());
    fireEvent.click(sheetCells(container)[1]);
    click(container, "Show onion skin");
    expect(onionRects(container).length).toBe(3);
    click(container, "Hide onion skin");
    expect(onionRects(container).length).toBe(0);
  });

  it("follows the selection", () => {
    const { container } = renderEditor(fileOf(3));
    fireEvent.click(sheetCells(container)[1]);
    click(container, "Show onion skin");
    // Sprite 1 is a solid fill, so every pixel of sprite 2 is opaque and nothing shows through.
    // Moving to a sprite with no predecessor must disable the control rather than ghost nothing.
    fireEvent.click(sheetCells(container)[0]);
    expect(button(container, "Onion skin").disabled).toBe(true);
  });
});

describe("SpriteEditor - animation preview", () => {
  it("offers playback only for a sheet with more than one sprite", () => {
    const single = renderEditor(fileOf(1));
    expect(button(single.container, "Play the sheet").disabled).toBe(true);
    cleanup();
    const many = renderEditor(fileOf(3));
    expect(button(many.container, "Play the sheet").disabled).toBe(false);
  });

  it("cycles the frame rate from its own button", () => {
    const { container } = renderEditor(fileOf(3));
    const fps = () =>
      (container.querySelector("[class*=fpsButton]") as HTMLElement).textContent;
    expect(fps()).toBe("12 fps");
    fireEvent.click(container.querySelector("[class*=fpsButton]") as HTMLElement);
    expect(fps()).toBe("24 fps");
  });

  it("restores a persisted frame rate", () => {
    const { container } = render(
      createSprFileEditorPanel({
        document: { id: "spr-1" } as any,
        contents: fileOf(3),
        viewState: { animationFps: 8 },
        apiLoaded: () => {}
      } as any)
    );
    expect((container.querySelector("[class*=fpsButton]") as HTMLElement).textContent).toBe("8 fps");
  });

  it("swaps the play control for a stop control while running", () => {
    const { container } = renderEditor(fileOf(3));
    click(container, "Play the sheet");
    expect(button(container, "Stop the sheet")).toBeTruthy();
    click(container, "Stop the sheet");
    expect(button(container, "Play the sheet")).toBeTruthy();
  });
});

/* --------------------------------------------------------------------------------------------
 * Phase 8: the select tool and a real clipboard. "Cut sprite" used to be a delete with a scissors
 * icon and no paste anywhere in the editor.
 * ------------------------------------------------------------------------------------------ */

/** Drag the select tool across a rectangle of the canvas. */
const dragSelect = (
  container: HTMLElement,
  from: [number, number],
  to: [number, number]
) => {
  press(container, "m"); // select tool
  fireEvent.mouseDown(cellAt(container, from[0], from[1]), { button: 0 });
  fireEvent.mouseEnter(cellAt(container, to[0], to[1]));
  fireEvent.mouseUp(cellAt(container, to[0], to[1]));
};

/** The dashed selection outline, if one is drawn. */
const selectionOutline = (container: HTMLElement) =>
  container.querySelector("rect[stroke-dasharray]") as SVGElement | null;

describe("SpriteEditor - selection", () => {
  it("marks a region by dragging the select tool", () => {
    const { container } = renderEditor(fileOf(1));
    expect(selectionOutline(container)).toBeNull();
    dragSelect(container, [2, 3], [6, 8]);
    expect(selectionOutline(container)).not.toBeNull();
  });

  it("marking a region is not an edit", () => {
    // The select tool marks; it must not push an undo entry or write the file.
    const { container } = renderEditor(fileOf(1));
    dragSelect(container, [2, 2], [5, 5]);
    vi.advanceTimersByTime(1000);
    expect(saveFileContent).not.toHaveBeenCalled();
    expect(button(container, "Undo").disabled).toBe(true);
  });

  it("selects everything with Ctrl+A and clears with Escape", () => {
    const { container } = renderEditor(fileOf(1));
    press(container, "a", { ctrlKey: true });
    expect(selectionOutline(container)).not.toBeNull();
    press(container, "Escape");
    expect(selectionOutline(container)).toBeNull();
  });

  it("drops the selection when a different sprite is chosen", () => {
    // A region marked on one sprite means nothing on another.
    const { container } = renderEditor(fileOf(2));
    dragSelect(container, [1, 1], [4, 4]);
    expect(selectionOutline(container)).not.toBeNull();
    fireEvent.click(sheetCells(container)[1]);
    expect(selectionOutline(container)).toBeNull();
  });
});

describe("SpriteEditor - region clipboard", () => {
  it("cuts a region to the transparency index, and pastes it back somewhere else", () => {
    const { container } = renderEditor(fileOf(1)); // every pixel is 1
    dragSelect(container, [0, 0], [1, 1]); // a 2x2 block
    press(container, "x", { ctrlKey: true });
    vi.advanceTimersByTime(1000);

    let written = lastWrite();
    // The cut blanks the region and leaves everything else alone.
    expect(written[0]).toBe(DEFAULT_SPRITE_TRANSPARENCY);
    expect(written[17]).toBe(DEFAULT_SPRITE_TRANSPARENCY);
    expect(written[2]).toBe(1);

    // Paste floats, then Enter puts it down at the selection anchor.
    press(container, "v", { ctrlKey: true });
    press(container, "ArrowRight");
    press(container, "ArrowRight");
    press(container, "Enter");
    vi.advanceTimersByTime(1000);

    written = lastWrite();
    expect(written[2]).toBe(1); // the pasted block landed two columns right
    expect(written[3]).toBe(1);
  });

  it("a floating paste touches nothing until it is committed", () => {
    const { container } = renderEditor(fileOf(1));
    dragSelect(container, [0, 0], [1, 1]);
    press(container, "c", { ctrlKey: true });
    saveFileContent.mockClear();

    press(container, "v", { ctrlKey: true });
    press(container, "ArrowDown");
    vi.advanceTimersByTime(1000);
    // Nudging a float is not an edit.
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it("Escape cancels a floating paste and leaves no trace", () => {
    const { container } = renderEditor(fileOf(1));
    dragSelect(container, [0, 0], [1, 1]);
    press(container, "x", { ctrlKey: true });
    vi.advanceTimersByTime(1000);
    const afterCut = [...lastWrite()];
    saveFileContent.mockClear();

    press(container, "v", { ctrlKey: true });
    press(container, "ArrowDown");
    press(container, "Escape");
    vi.advanceTimersByTime(1000);

    expect(saveFileContent).not.toHaveBeenCalled();
    // And a second Escape backs out of the selection rather than doing nothing.
    press(container, "Escape");
    expect(selectionOutline(container)).toBeNull();
    expect(afterCut.length).toBe(SPRITE_SIZE);
  });

  it("Delete clears the region without touching the sheet", () => {
    const { container } = renderEditor(fileOf(3));
    dragSelect(container, [0, 0], [0, 0]);
    press(container, "Delete");
    vi.advanceTimersByTime(1000);

    const written = lastWrite();
    expect(written.length).toBe(3 * SPRITE_SIZE); // still three sprites
    expect(written[0]).toBe(DEFAULT_SPRITE_TRANSPARENCY);
  });
});

describe("SpriteEditor - sheet clipboard", () => {
  it("Cut removes the sprite when nothing is marked, and Paste brings it back", () => {
    const { container } = renderEditor(fileOf(3));
    press(container, "x", { ctrlKey: true });
    vi.advanceTimersByTime(1000);
    expect(lastWrite().length).toBe(2 * SPRITE_SIZE);

    press(container, "v", { ctrlKey: true });
    vi.advanceTimersByTime(1000);
    expect(lastWrite().length).toBe(3 * SPRITE_SIZE);
  });

  it("pastes a sprite as a NEW sprite rather than over the current one", () => {
    // Silently replacing what someone is working on is not what Paste means.
    const { container } = renderEditor(fileOf(2));
    press(container, "c", { ctrlKey: true }); // copy sprite 1 (filled with 1)
    fireEvent.click(sheetCells(container)[1]); // look at sprite 2 (filled with 2)
    press(container, "v", { ctrlKey: true });
    vi.advanceTimersByTime(1000);

    const written = lastWrite();
    expect(written.length).toBe(3 * SPRITE_SIZE);
    expect(written[SPRITE_SIZE]).toBe(2); // sprite 2 is untouched
    expect(written[2 * SPRITE_SIZE]).toBe(1); // the copy landed after it
  });

  it("enables Paste only once something has been copied", () => {
    const { container } = renderEditor(fileOf(2));
    expect(button(container, "Paste").disabled).toBe(true);
    press(container, "c", { ctrlKey: true });
    expect(button(container, "Paste").disabled).toBe(false);
  });

  it("Cut, Copy and Delete say which thing they will act on", () => {
    const { container } = renderEditor(fileOf(2));
    expect(button(container, "Cut sprite").getAttribute("aria-label")).toContain("Ctrl+X");
    dragSelect(container, [1, 1], [3, 3]);
    // With a region marked the same buttons change what they mean, and say so.
    expect(button(container, "Cut region")).toBeTruthy();
    expect(button(container, "Copy region")).toBeTruthy();
    expect(button(container, "Clear region")).toBeTruthy();
  });
});

/* --------------------------------------------------------------------------------------------
 * The sheet pane's height: two rows by default, and draggable.
 * ------------------------------------------------------------------------------------------ */

const editorEl = (container: HTMLElement) => editorRoot(container);
const sheetHeight = (container: HTMLElement) =>
  editorEl(container).style.getPropertyValue("--sheet-height");
const resizer = (container: HTMLElement) =>
  container.querySelector('[role="separator"]') as HTMLElement;

/** jsdom reports 0 for every measured size, so the clamp needs a height to work against. */
const withEditorHeight = (container: HTMLElement, px: number) =>
  Object.defineProperty(editorEl(container), "clientHeight", { value: px, configurable: true });

const dragResizer = (container: HTMLElement, dy: number) => {
  const el = resizer(container);
  (el as any).setPointerCapture = () => {};
  (el as any).hasPointerCapture = () => false;
  (el as any).releasePointerCapture = () => {};
  fireEvent.pointerDown(el, { button: 0, clientY: 400, pointerId: 1 });
  fireEvent.pointerMove(el, { clientY: 400 + dy, pointerId: 1 });
  fireEvent.pointerUp(el, { clientY: 400 + dy, pointerId: 1 });
};

describe("SpriteEditor - sheet height", () => {
  it("shows two rows of thumbnails by default", () => {
    const { container } = renderEditor(fileOf(20));
    expect(sheetHeight(container)).toBe(`${DEFAULT_SHEET_HEIGHT}px`);
  });

  it("restores a height the user dragged to", () => {
    const { container } = render(
      createSprFileEditorPanel({
        document: { id: "spr-1" } as any,
        contents: fileOf(20),
        viewState: { sheetHeight: 300 },
        apiLoaded: () => {}
      } as any)
    );
    expect(sheetHeight(container)).toBe("300px");
  });

  it("grows when the handle is dragged up, and persists on release", () => {
    const { container } = renderEditor(fileOf(20));
    withEditorHeight(container, 900);
    // The handle is on the pane's top edge, so dragging *up* makes the sheet taller.
    dragResizer(container, -80);
    expect(sheetHeight(container)).toBe(`${DEFAULT_SHEET_HEIGHT + 80}px`);
    expect(setDocumentViewState).toHaveBeenCalled();
  });

  it("shrinks when dragged down, but never past one whole row", () => {
    // A clipped row plus a scrollbar is what the stale `max-height: 42%` produced, and it read as
    // broken rather than as scrollable.
    const { container } = renderEditor(fileOf(20));
    withEditorHeight(container, 900);
    dragResizer(container, 5000);
    expect(sheetHeight(container)).toBe(`${MIN_SHEET_HEIGHT}px`);
  });

  it("leaves the canvas its floor however far the handle is dragged", () => {
    const { container } = renderEditor(fileOf(20));
    withEditorHeight(container, 400);
    dragResizer(container, -5000);
    // 400 - 27 of toolbar - 140 of stage minimum.
    expect(sheetHeight(container)).toBe("233px");
  });

  it("double-clicking the handle restores the two-row default", () => {
    const { container } = renderEditor(fileOf(20));
    withEditorHeight(container, 900);
    dragResizer(container, -120);
    expect(sheetHeight(container)).not.toBe(`${DEFAULT_SHEET_HEIGHT}px`);
    fireEvent.doubleClick(resizer(container));
    expect(sheetHeight(container)).toBe(`${DEFAULT_SHEET_HEIGHT}px`);
  });

  it("announces the handle as a separator with the row count it is showing", () => {
    const { container } = renderEditor(fileOf(20));
    const el = resizer(container);
    expect(el.getAttribute("aria-orientation")).toBe("horizontal");
    expect(el.getAttribute("aria-valuenow")).toBe("3"); // 176px / 63px, rounded
  });
});
