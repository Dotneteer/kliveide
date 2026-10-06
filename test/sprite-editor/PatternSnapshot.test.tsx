import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { SPRITE_SIZE } from "@renderer/features/sprite-editor/sprite-raster";
import { resetSpriteClipboard, spriteClipboard } from "@renderer/features/sprite-editor/sprite-clipboard";
import { serializeSprFile } from "@renderer/features/sprite-editor/sprite-file";
import {
  openPatternSnapshot,
  patternSnapshotBytes,
  patternSnapshotViewState
} from "@renderer/features/sprites/patternSnapshot";

/*
 * A sprite pattern popped out of the Sprite Inspector into a read-only sprite editor: the bytes are
 * the pattern as its sprite shows it, and nothing in the editor can change them or write anything.
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

const { createPatternSnapshotPanel } = await import("@renderer/features/sprites/PatternSnapshotPanel");

const VIEW_STATE = { snapshotTitle: "Pattern 40 · 8-bit", snapshotDetail: "palette offset 0 · taken 12:00:00" };

const renderSnapshot = (sprite: Uint8Array) =>
  render(
    createPatternSnapshotPanel({
      document: { id: "spritePatternSnapshot-8bit-40", name: "Pattern 40 (snapshot)" } as any,
      contents: serializeSprFile([sprite]),
      viewState: VIEW_STATE,
      apiLoaded: () => {}
    } as any)
  );

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-role="pixels"] rect')].map((r) => r.getAttribute("fill"));

const editorRoot = (container: HTMLElement) =>
  (container.querySelector('[data-role="pixels"]') as SVGElement).closest("[tabindex='-1']") as HTMLElement;

const press = (container: HTMLElement, key: string, init: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(editorRoot(container), { key, ...init });

beforeEach(() => {
  vi.useFakeTimers();
  resetSpriteClipboard();
  paletteInfo = null;
  saveFileContent.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("patternSnapshotBytes", () => {
  const patterns = new Uint8Array(0x4000);
  patterns.set([0x12, 0xe3, 0xf0], 40 * 256); // --- 8-bit pattern 40: two opaque bytes and $E3
  patterns.set([0x1e, 0xe3], 81 * 128); // --- 4-bit pattern 81: nibbles 1, E, E, 3 (3 = $4B's low nibble)

  it("copies an 8-bit pattern unchanged at offset 0, and adds the offset to the high nibble", () => {
    const base = { patterns, format: "8bit" as const, pattern: 40, transparencyIndex: 0xe3 };
    expect([...patternSnapshotBytes({ ...base, paletteOffset: 0 }).slice(0, 3)]).toEqual([0x12, 0xe3, 0xf0]);
    // --- the transparent byte stays the transparency index; the others take the offset
    expect([...patternSnapshotBytes({ ...base, paletteOffset: 2 }).slice(0, 3)]).toEqual([0x32, 0xe3, 0x10]);
  });

  it("expands a 4-bit pattern with its palette offset; the transparent nibble is $4B", () => {
    const bytes = patternSnapshotBytes({ patterns, format: "4bit", pattern: 81, paletteOffset: 5, transparencyIndex: 0xe3 });
    expect(bytes.length).toBe(SPRITE_SIZE);
    expect([...bytes.slice(0, 4)]).toEqual([0x51, 0x5e, 0x5e, 0xe3]);
  });

  it("titles the snapshot with the pattern, the format and the sprite", () => {
    const vs = patternSnapshotViewState({
      patterns,
      format: "4bit",
      pattern: 81,
      paletteOffset: 5,
      transparencyIndex: 0xe3,
      sprite: 9,
      takenAt: new Date(2026, 9, 6, 14, 5, 9)
    });
    expect(vs.snapshotTitle).toBe("Pattern 81 (40·hi) · 4-bit");
    expect(vs.snapshotDetail).toMatch(/^as sprite #9 shows it · palette offset 5 · taken /);
  });
});

describe("openPatternSnapshot", () => {
  it("opens an in-memory document, and retakes an open one rather than adding a tab", async () => {
    const open = new Set<string>();
    const hub = {
      isOpen: vi.fn((id: string) => open.has(id)),
      closeDocument: vi.fn(async (id: string) => void open.delete(id)),
      openDocument: vi.fn(async (doc: { id: string }) => void open.add(doc.id))
    };
    const r = { patterns: new Uint8Array(0x4000), format: "8bit" as const, pattern: 3, paletteOffset: 0, transparencyIndex: 0xe3 };
    await openPatternSnapshot(hub as any, r);
    await openPatternSnapshot(hub as any, r);
    expect(hub.closeDocument).toHaveBeenCalledTimes(1);
    expect(hub.openDocument).toHaveBeenCalledTimes(2);
    const [doc, viewState, temporary] = hub.openDocument.mock.calls[1] as any[];
    expect(doc).toMatchObject({ id: "spritePatternSnapshot-8bit-3", type: "SpritePatternSnapshot" });
    expect(doc.contents.length).toBe(SPRITE_SIZE);
    expect(viewState.snapshotTitle).toBe("Pattern 3 · 8-bit");
    expect(temporary).toBe(false);
  });
});

describe("the read-only sprite editor", () => {
  const sprite = Uint8Array.from({ length: SPRITE_SIZE }, (_, i) => i & 0xff);

  it("says it is a read-only snapshot and offers no drawing tools or pen colours", () => {
    const { container, getByRole } = renderSnapshot(sprite);
    const bar = getByRole("toolbar", { name: "Read-only snapshot" });
    expect(bar.textContent).toContain("Read-only");
    expect(bar.textContent).toContain("Pattern 40 · 8-bit");
    expect(bar.textContent).toContain("taken 12:00:00");
    expect(container.querySelector('button[aria-label^="Pencil tool"]')).toBeNull();
    expect(container.querySelector('button[aria-label^="Undo"]')).toBeNull();
    expect(container.textContent).not.toContain("Pen");
  });

  it("ignores every edit - tools, drawing, delete, cut, paste, undo, drag - and never saves", async () => {
    const { container } = renderSnapshot(sprite);
    await act(async () => {
      await Promise.resolve();
    });
    const before = fills(container);
    expect(before.length).toBe(SPRITE_SIZE);

    // --- A tool key, then a stroke: the grid stays a selector
    press(container, "p");
    const cell = container.querySelectorAll('[data-role="pixels"] rect')[17];
    fireEvent.mouseDown(cell, { button: 0 });
    fireEvent.mouseUp(cell);
    press(container, "Enter");
    // --- Select all, then delete, cut, paste, undo
    press(container, "a", { ctrlKey: true });
    press(container, "Delete");
    press(container, "x", { ctrlKey: true });
    press(container, "v", { ctrlKey: true });
    press(container, "z", { ctrlKey: true });
    vi.advanceTimersByTime(2000);

    expect(fills(container)).toEqual(before);
    expect(saveFileContent).not.toHaveBeenCalled();
  });

  it("still copies: the sprite reaches the clipboard for pasting into an editable sheet", () => {
    const { container } = renderSnapshot(sprite);
    fireEvent.click(container.querySelector('button[aria-label^="Copy the selection"]')!);
    expect([...spriteClipboard.get().sprite!]).toEqual([...sprite]);
  });
});
