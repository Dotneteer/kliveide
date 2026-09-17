import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- `ScrollViewer` picks its scrollbar theme from the app theme.
vi.mock("@renderer/theming/ThemeProvider", () => ({
  useTheme: () => ({ theme: { tone: "dark" } })
}));
vi.mock("@renderer/controls/Dropdown", () => ({
  default: ({ ariaLabel, onChanged }: { ariaLabel?: string; onChanged?: (v: string) => void }) => (
    <button type="button" aria-label={ariaLabel} onClick={() => onChanged?.("15")}>
      dropdown
    </button>
  )
}));
vi.mock("@renderer/controls/LabeledSwitch", () => ({
  LabeledSwitch: ({ label, clicked, value }: { label: string; value: boolean; clicked?: (v: boolean) => void }) => (
    <button type="button" onClick={() => clicked?.(!value)}>
      {label}
    </button>
  )
}));
vi.mock("@renderer/controls/AddressInput", () => ({
  AddressInput: ({ onAddressSent }: { onAddressSent?: (a: number) => Promise<void> }) => (
    <button type="button" data-testid="go-to" onClick={() => void onAddressSent?.(0x4805)}>
      go
    </button>
  )
}));
vi.mock("@renderer/controls/ContextMenu", () => ({
  ContextMenu: ({ children, state }: { children: ReactNode; state: { contextVisible: boolean } }) =>
    state.contextVisible ? <div role="menu">{children}</div> : null,
  ContextMenuItem: ({ text, disabled, clicked }: { text: string; disabled?: boolean; clicked?: () => void }) => (
    <button type="button" role="menuitem" disabled={disabled} onClick={clicked}>
      {text}
    </button>
  ),
  ContextMenuSeparator: () => <hr />,
  useContextMenuState: () => {
    const React = require("react");
    const [state, setState] = React.useState({ contextVisible: false });
    return [
      state,
      { show: () => setState({ contextVisible: true }), conceal: () => setState({ contextVisible: false }) }
    ];
  }
}));

import {
  DEFAULT_SPRITES_LOOK,
  NEX_RESET_PALETTE,
  NexBankSpritesToolbar,
  NexBankSpritesView,
  patternForAddress,
  spanHasRegionType,
  type NexSpritesLook,
  type NexSpritesPaletteInfo
} from "@renderer/appIde/DocumentPanels/Next/NexBankSpritesView";

const draws: { data: Uint8ClampedArray }[] = [];

beforeEach(() => {
  draws.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: (image: { data: Uint8ClampedArray }) => draws.push(image)
  })) as any);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const paletteInfo = (over: Partial<NexSpritesPaletteInfo> = {}): NexSpritesPaletteInfo => ({
  palette: NEX_RESET_PALETTE,
  transparencyIndex: 0xe3,
  source: "machine",
  liveBank: 1,
  ...over
});

function bankWithSprites(): Uint8Array {
  const bytes = new Uint8Array(0x4000);
  bytes.fill(0xe3, 0x800, 0x900); // pattern #8: blank (all transparent)
  bytes.fill(0xe0, 0x900, 0xa00); // pattern #9: all red
  bytes[0x900] = 0xe3;
  return bytes;
}

function renderView(props: Partial<Parameters<typeof NexBankSpritesView>[0]> = {}) {
  const onLookChange = vi.fn();
  const onMarkSpan = vi.fn();
  const onShowIn = vi.fn();
  const onBankComment = vi.fn();
  const look: NexSpritesLook = { ...DEFAULT_SPRITES_LOOK, ...(props.look ?? {}) };
  const utils = render(
    <NexBankSpritesView
      bank={10}
      bytes={bankWithSprites()}
      addressBase={0x4000}
      format="8bit"
      offset={0}
      paletteInfo={paletteInfo()}
      canAnnotate={true}
      onLookChange={onLookChange}
      onMarkSpan={onMarkSpan}
      onShowIn={onShowIn}
      onBankComment={onBankComment}
      {...props}
      look={look}
    />
  );
  return { ...utils, onLookChange, onMarkSpan, onShowIn, onBankComment };
}

describe("NexBankSpritesView sheet", () => {
  it("shows one cell per whole pattern, labelled with number and bank offset", () => {
    renderView();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(64);
    expect(options[9]).toHaveTextContent("#9 $0900");
  });

  it("lays 4-bit patterns out at 128 bytes from the offset", () => {
    renderView({ format: "4bit", offset: 3 });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(127);
    expect(options[1]).toHaveTextContent("#1 $0083");
  });

  it("says so when no whole pattern fits", () => {
    renderView({ offset: 0x3f01 });
    expect(screen.getByText("No whole pattern fits after this offset.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pattern inspector")).toBeNull();
  });

  it("dims a blank pattern", () => {
    renderView();
    expect(screen.getAllByRole("option")[8].className).toContain("cellBlank");
    expect(screen.getAllByRole("option")[9].className).not.toContain("cellBlank");
  });

  it("draws transparent pixels see-through with the checker, and in the palette colour without", () => {
    renderView({ look: { ...DEFAULT_SPRITES_LOOK, showTransparent: true } });
    // --- Pattern #9's first pixel is transparent: alpha 0.
    const withChecker = draws[9].data;
    expect(withChecker[3]).toBe(0);
    cleanup();
    draws.length = 0;
    renderView({ look: { ...DEFAULT_SPRITES_LOOK, showTransparent: false } });
    expect(draws[9].data[3]).toBe(255);
  });

  it("selects on click and extends with Shift+click", () => {
    const { onLookChange } = renderView({ look: { ...DEFAULT_SPRITES_LOOK, anchor: 2, active: 2 } });
    fireEvent.click(screen.getAllByRole("option")[5]);
    expect(onLookChange).toHaveBeenLastCalledWith({ active: 5, anchor: 5 });
    fireEvent.click(screen.getAllByRole("option")[5], { shiftKey: true });
    expect(onLookChange).toHaveBeenLastCalledWith({ active: 5, anchor: 2 });
  });

  it("moves with the arrow keys, clamped to the sheet", () => {
    const { onLookChange } = renderView({ look: { ...DEFAULT_SPRITES_LOOK, anchor: 0, active: 0 } });
    const sheet = screen.getByTestId("nex-sprites-sheet");
    fireEvent.keyDown(sheet, { key: "ArrowRight" });
    expect(onLookChange).toHaveBeenLastCalledWith({ active: 1, anchor: 1 });
    fireEvent.keyDown(sheet, { key: "ArrowLeft" });
    expect(onLookChange).toHaveBeenLastCalledWith({ active: 0, anchor: 0 });
    fireEvent.keyDown(sheet, { key: "End", shiftKey: true });
    expect(onLookChange).toHaveBeenLastCalledWith({ active: 63, anchor: 0 });
  });

  it("opens Memory on Enter or double-click, Disassembly on Shift+Enter, and Bank Comment on B", () => {
    const { onShowIn, onBankComment } = renderView({
      look: { ...DEFAULT_SPRITES_LOOK, anchor: 9, active: 9 }
    });
    const sheet = screen.getByTestId("nex-sprites-sheet");
    fireEvent.keyDown(sheet, { key: "Enter" });
    expect(onShowIn).toHaveBeenLastCalledWith("memory", 0x900);
    fireEvent.keyDown(sheet, { key: "Enter", shiftKey: true });
    expect(onShowIn).toHaveBeenLastCalledWith("disassembly", 0x900);
    fireEvent.doubleClick(screen.getAllByRole("option")[3]);
    expect(onShowIn).toHaveBeenLastCalledWith("memory", 0x300);
    fireEvent.keyDown(sheet, { key: "b" });
    expect(onBankComment).toHaveBeenCalledTimes(1);
  });

  it("marks cells whose bytes are already a bytes region", () => {
    renderView({ regions: [{ start: 0x900, end: 0x9ff, type: "bytes" }] });
    const cells = screen.getAllByRole("option");
    expect(within(cells[9]).getByLabelText("Marked as bytes")).toBeInTheDocument();
    expect(within(cells[8]).queryByLabelText("Marked as bytes")).toBeNull();
  });
});

describe("NexBankSpritesView inspector", () => {
  it("describes the selected pattern", () => {
    renderView({ look: { ...DEFAULT_SPRITES_LOOK, anchor: 9, active: 9 } });
    const inspector = screen.getByLabelText("Pattern inspector");
    expect(inspector).toHaveTextContent("Pattern #9");
    expect(inspector).toHaveTextContent("$0900–$09FF");
    expect(inspector).toHaveTextContent("$4900");
    expect(inspector).toHaveTextContent("Primary");
    expect(within(inspector).getByTestId("nex-sprite-hint")).toHaveTextContent(
      "1 colour, 1 transparent pixel."
    );
    expect(inspector).toHaveTextContent("$E0");
  });

  it("names a range and marks all of it as bytes", () => {
    const { onMarkSpan } = renderView({ look: { ...DEFAULT_SPRITES_LOOK, anchor: 10, active: 8 } });
    const inspector = screen.getByLabelText("Pattern inspector");
    expect(inspector).toHaveTextContent("Patterns #8–#10 (3)");
    fireEvent.click(within(inspector).getByRole("button", { name: "Mark as Bytes" }));
    expect(onMarkSpan).toHaveBeenCalledWith(0x800, 0xaff, "bytes");
  });

  it("offers the way back once the selection is marked", () => {
    const { onMarkSpan } = renderView({
      look: { ...DEFAULT_SPRITES_LOOK, anchor: 9, active: 9 },
      regions: [{ start: 0x800, end: 0xbff, type: "bytes" }]
    });
    const inspector = screen.getByLabelText("Pattern inspector");
    expect(within(inspector).getByRole("button", { name: "Marked as Bytes" })).toBeDisabled();
    fireEvent.click(within(inspector).getByRole("button", { name: "Mark as Disassembly" }));
    expect(onMarkSpan).toHaveBeenCalledWith(0x900, 0x9ff, "disassemble");
  });

  it("cannot mark without an annotation file", () => {
    renderView({ canAnnotate: false });
    expect(
      within(screen.getByLabelText("Pattern inspector")).getByRole("button", { name: "Mark as Bytes" })
    ).toBeDisabled();
  });

  it("marks from a cell's context menu, selecting the cell first", () => {
    const { onLookChange } = renderView({ look: { ...DEFAULT_SPRITES_LOOK, anchor: 0, active: 0 } });
    fireEvent.contextMenu(screen.getAllByRole("option")[9]);
    expect(onLookChange).toHaveBeenLastCalledWith({ active: 9, anchor: 9 });
    expect(screen.getByRole("menuitem", { name: "Mark as Bytes" })).toBeInTheDocument();
  });

  it("calls a code-like pattern noisy", () => {
    const bytes = new Uint8Array(0x4000).map((_, i) => (i * 37) & 0xff);
    renderView({ bytes });
    expect(screen.getByTestId("nex-sprite-hint")).toHaveTextContent("more likely code or packed data");
  });
});

describe("NexBankSpritesToolbar", () => {
  function renderToolbar(over: Partial<Parameters<typeof NexBankSpritesToolbar>[0]> = {}) {
    const handlers = {
      onFormatChange: vi.fn(),
      onOffsetChange: vi.fn(),
      onLookChange: vi.fn(),
      onGoToAddress: vi.fn()
    };
    render(
      <NexBankSpritesToolbar
        format="8bit"
        offset={0x800}
        look={DEFAULT_SPRITES_LOOK}
        paletteInfo={paletteInfo()}
        decimalView={false}
        {...handlers}
        {...over}
      />
    );
    return handlers;
  }

  it("switches between the primary and secondary palettes, ringing the live one", () => {
    const { onLookChange } = renderToolbar();
    const primary = screen.getByRole("button", { name: "Primary" });
    const secondary = screen.getByRole("button", { name: "Secondary" });
    expect(primary).toHaveAttribute("aria-pressed", "true");
    expect(secondary.className).toContain("segmentLive");
    fireEvent.click(secondary);
    expect(onLookChange).toHaveBeenCalledWith({ palette: 1 });
  });

  it("says when there is no machine to read the palettes from", () => {
    renderToolbar({ paletteInfo: paletteInfo({ source: "default", liveBank: undefined }) });
    expect(screen.getByText("Default palette")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Secondary" }).className).not.toContain("segmentLive");
  });

  it("changes format, and offers the 4-bit palette offset only for 4-bit", () => {
    const { onFormatChange } = renderToolbar();
    expect(screen.queryByLabelText("4-bit palette offset")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "4-bit" }));
    expect(onFormatChange).toHaveBeenCalledWith("4bit");
    cleanup();
    const { onLookChange } = renderToolbar({ format: "4bit" });
    fireEvent.click(screen.getByLabelText("4-bit palette offset"));
    expect(onLookChange).toHaveBeenCalledWith({ paletteOffset: 15 });
  });

  it("nudges the offset by a byte or a pattern, clamped to the bank", () => {
    const { onOffsetChange } = renderToolbar({ format: "4bit", offset: 0x40 });
    fireEvent.click(screen.getByTitle("Forward one byte"));
    expect(onOffsetChange).toHaveBeenLastCalledWith(0x41);
    fireEvent.click(screen.getByTitle("Back one pattern"));
    expect(onOffsetChange).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByTitle("Forward one pattern"));
    expect(onOffsetChange).toHaveBeenLastCalledWith(0xc0);
  });

  it("commits a typed offset on Enter, in hex or decimal, and resets nonsense", () => {
    const { onOffsetChange } = renderToolbar();
    const input = screen.getByLabelText("Sprite start offset");
    expect(input).toHaveValue("$0800");
    fireEvent.change(input, { target: { value: "$0803" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onOffsetChange).toHaveBeenLastCalledWith(0x803);
    fireEvent.change(input, { target: { value: "2051" } });
    fireEvent.blur(input);
    expect(onOffsetChange).toHaveBeenLastCalledWith(2051);
    onOffsetChange.mockClear();
    fireEvent.change(input, { target: { value: "$zz" } });
    fireEvent.blur(input);
    expect(onOffsetChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("$0800");
  });

  it("changes zoom and the checker, and goes to an address", () => {
    const { onLookChange, onGoToAddress } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "4×" }));
    expect(onLookChange).toHaveBeenCalledWith({ zoom: 4 });
    fireEvent.click(screen.getByRole("button", { name: "Checker" }));
    expect(onLookChange).toHaveBeenCalledWith({ showTransparent: false });
    fireEvent.click(screen.getByTestId("go-to"));
    expect(onGoToAddress).toHaveBeenCalledWith(0x4805);
  });
});

describe("helpers", () => {
  it("finds the pattern holding a listed address", () => {
    expect(patternForAddress(0x4905, 0x4000, "8bit", 0)).toBe(9);
    expect(patternForAddress(0x4002, 0x4000, "8bit", 3)).toBeUndefined();
    expect(patternForAddress(0x8000, 0x4000, "8bit", 0)).toBeUndefined();
  });

  it("checks a span against a region type", () => {
    const regions = [{ start: 0x800, end: 0x9ff, type: "bytes" as const }];
    expect(spanHasRegionType(regions, 0x900, 0x9ff, "bytes")).toBe(true);
    expect(spanHasRegionType(regions, 0x900, 0xa00, "bytes")).toBe(false);
    expect(spanHasRegionType(undefined, 0, 1, "bytes")).toBe(false);
  });

  it("builds the Next reset palette with the low blue bit as B1 | B0", () => {
    expect(NEX_RESET_PALETTE[0x00]).toBe(0x000);
    expect(NEX_RESET_PALETTE[0x03]).toBe(0x103);
    expect(NEX_RESET_PALETTE[0xe0]).toBe(0x0e0);
    expect(NEX_RESET_PALETTE[0xff]).toBe(0x1ff);
  });
});

describe("NexBankSpritesView scrolling", () => {
  it("scrolls the sheet and the inspector with the app's overlay scrollbars", () => {
    renderView({ look: { ...DEFAULT_SPRITES_LOOK, anchor: 9, active: 9 } });
    const sheet = screen.getByTestId("nex-sprites-sheet");
    const inspector = screen.getByLabelText("Pattern inspector");
    // --- Both sit inside an OverlayScrollbars host rather than scrolling natively.
    expect(sheet.closest("[data-overlayscrollbars-initialize], [data-overlayscrollbars]")).not.toBeNull();
    expect(
      inspector.querySelector("[data-overlayscrollbars-initialize], [data-overlayscrollbars]")
    ).not.toBeNull();
  });
});
