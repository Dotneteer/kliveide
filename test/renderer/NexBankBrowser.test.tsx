import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/controls/Icon", () => ({
  Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
}));

import {
  NexBankBrowser,
  type NexBankBrowserItem
} from "@renderer/appIde/DocumentPanels/Next/NexBankBrowser";
import type { BankBreakpointSummary } from "@renderer/appIde/DocumentPanels/Next/nexBankGutter";

afterEach(() => cleanup());

const bps = (over: Partial<BankBreakpointSummary>): BankBreakpointSummary => ({
  total: 0,
  exec: 0,
  memRead: 0,
  memWrite: 0,
  disabled: 0,
  disabledByKind: { exec: 0, memRead: 0, memWrite: 0 },
  ...over
});

const item = (bank: number, over: Partial<NexBankBrowserItem> = {}): NexBankBrowserItem => ({
  bank,
  size: 0x4000,
  empty: false,
  annotated: false,
  hasAnnotation: true,
  listedAt: 0xc000,
  lastView: "disassembly",
  mix: { disassemble: 0x4000, bytes: 0, words: 0, skip: 0 },
  labels: [],
  ...over
});

function renderBrowser(
  items: NexBankBrowserItem[],
  props: Partial<Parameters<typeof NexBankBrowser>[0]> = {}
) {
  const handlers = {
    onSelect: vi.fn(),
    onFilterChange: vi.fn(),
    onPopOut: vi.fn(),
    onEditComment: vi.fn(),
    onClearComment: vi.fn()
  };
  const utils = render(
    <NexBankBrowser items={items} filter="all" spritesAvailable={true} {...handlers} {...props} />
  );
  return { ...utils, ...handlers };
}

describe("NexBankBrowser", () => {
  it("lists every bank with its marks and summarises them", () => {
    renderBrowser([
      item(5, { pc: 0x5c50, breakpoints: bps({ total: 3, exec: 3 }) }),
      item(2, { sp: 0xbf2d }),
      item(0, { empty: true })
    ]);
    const rows = screen.getAllByRole("option");
    expect(rows.map((r) => r.getAttribute("data-bank"))).toEqual(["5", "2", "0"]);
    expect(within(rows[0]).getByText("PC $5C50")).toBeInTheDocument();
    const chip = within(rows[0]).getByRole("img", {
      name: "3 breakpoints in this bank — 3 execution"
    });
    expect(chip).toHaveTextContent("BP3");
    expect(within(chip).getByTestId("icon-bp-exec")).toBeInTheDocument();
    expect(within(rows[1]).getByText("SP $BF2D")).toBeInTheDocument();
    expect(within(rows[2]).getByText("empty")).toBeInTheDocument();
    expect(screen.getByText("3 banks · 48 KB · 1 with breakpoints")).toBeInTheDocument();
  });

  it("selects the first bank when none is selected, and the chosen one otherwise", () => {
    const { rerender, onSelect, onPopOut, onEditComment, onClearComment, onFilterChange } =
      renderBrowser([item(5), item(2)]);
    expect(screen.getByRole("complementary", { name: "Bank $05 details" })).toBeInTheDocument();
    rerender(
      <NexBankBrowser
        items={[item(5), item(2)]}
        selectedBank={2}
        filter="all"
        spritesAvailable={true}
        {...{ onSelect, onPopOut, onEditComment, onClearComment, onFilterChange }}
      />
    );
    expect(screen.getByRole("complementary", { name: "Bank $02 details" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });

  it("moves the selection with the arrow keys and pops out with Enter", () => {
    const { onSelect, onPopOut } = renderBrowser([item(5), item(2), item(0)], { selectedBank: 2 });
    const list = screen.getByRole("listbox", { name: "Bank list" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(list, { key: "Home" });
    expect(onSelect).toHaveBeenLastCalledWith(5);
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onPopOut).toHaveBeenLastCalledWith(2, "disassembly");
  });

  it("pops out from a row's icon without selecting through it", () => {
    const { onPopOut } = renderBrowser([item(5, { lastView: "sprites" }), item(2)]);
    fireEvent.click(screen.getByRole("button", { name: "Pop out Bank $02" }));
    expect(onPopOut).toHaveBeenCalledWith(2, "disassembly");
    fireEvent.doubleClick(screen.getAllByRole("option")[0]);
    expect(onPopOut).toHaveBeenLastCalledWith(5, "sprites");
  });

  it("filters to non-empty or annotated banks, and says when nothing matches", () => {
    const { rerender, onFilterChange, ...rest } = renderBrowser([
      item(5, { annotated: true }),
      item(0, { empty: true })
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Non-empty" }));
    expect(onFilterChange).toHaveBeenCalledWith("nonEmpty");
    const props = {
      onFilterChange,
      onSelect: rest.onSelect,
      onPopOut: rest.onPopOut,
      onEditComment: rest.onEditComment,
      onClearComment: rest.onClearComment
    };
    rerender(
      <NexBankBrowser
        items={[item(5, { annotated: true }), item(0, { empty: true })]}
        filter="nonEmpty"
        spritesAvailable={true}
        {...props}
      />
    );
    expect(screen.getAllByRole("option").map((r) => r.getAttribute("data-bank"))).toEqual(["5"]);
    rerender(
      <NexBankBrowser
        items={[item(0, { empty: true })]}
        filter="annotated"
        spritesAvailable={true}
        {...props}
      />
    );
    expect(screen.getByText("No bank matches this filter.")).toBeInTheDocument();
  });

  it("labels the breakpoint chip and spells the kinds out in the details", () => {
    renderBrowser([
      item(5, {
        breakpoints: bps({
          total: 3,
          exec: 2,
          memWrite: 1,
          disabled: 1,
          disabledByKind: { exec: 1, memRead: 0, memWrite: 0 }
        })
      }),
      item(2, {
        breakpoints: bps({
          total: 2,
          exec: 2,
          disabled: 2,
          disabledByKind: { exec: 2, memRead: 0, memWrite: 0 }
        })
      })
    ]);
    const [row5, row2] = screen.getAllByRole("option");
    const chip5 = within(row5).getByRole("img", { name: /^3 breakpoints in this bank/ });
    // --- Only the enabled ones: one exec, one write.
    expect(chip5).toHaveTextContent("BP11");
    expect(within(chip5).getByTestId("icon-bp-mem-write")).toBeInTheDocument();
    // --- All disabled: still shown, with their count.
    expect(
      within(row2).getByRole("img", { name: /^2 breakpoints in this bank/ })
    ).toHaveTextContent("BP2");

    const panel = screen.getByRole("complementary", { name: "Bank $05 details" });
    expect(within(panel).queryByRole("img", { name: /breakpoints in this bank/ })).toBeNull();
    expect(within(panel).getByText("Breakpoints")).toBeInTheDocument();
    expect(within(panel).getByText("2 execution (1 disabled)")).toBeInTheDocument();
    expect(within(panel).getByText("1 memory write")).toBeInTheDocument();
  });

  it("caps the label list and counts the rest", () => {
    const labels = Array.from({ length: 20 }, (_, i) => ({
      name: `L${i}`,
      address: 0xc000 + i,
      scope: "global" as const
    }));
    renderBrowser([item(5, { labels })]);
    const panel = screen.getByRole("complementary", { name: "Bank $05 details" });
    expect(within(panel).getByText("Labels (20)")).toBeInTheDocument();
    expect(within(panel).getByText("L15")).toBeInTheDocument();
    expect(within(panel).queryByText("L16")).toBeNull();
    expect(within(panel).getByText("+4 more")).toBeInTheDocument();
  });

  it("names the region types in the content mix", () => {
    renderBrowser([item(5, { mix: { disassemble: 0x1000, bytes: 0x3000, words: 0, skip: 0 } })]);
    const panel = screen.getByRole("complementary", { name: "Bank $05 details" });
    expect(within(panel).getByText("Code 25%")).toBeInTheDocument();
    expect(within(panel).getByText("Bytes 75%")).toBeInTheDocument();
    expect(
      within(panel).getByRole("img", { name: "Code 25%, Bytes 75%, Words 0%, Skip 0%" })
    ).toBeInTheDocument();
  });
});
