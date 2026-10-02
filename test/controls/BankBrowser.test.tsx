import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@renderer/controls/Icon", () => ({
  Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
}));
// --- The list and details scroll in `ScrollViewer`s, which pick their scrollbar theme by tone
vi.mock("@renderer/theming/ThemeProvider", () => ({
  useTheme: () => ({ theme: { tone: "dark" } })
}));

import { ContextMenuItem } from "@renderer/controls/ContextMenu";
import {
  BankBrowser,
  BankChip,
  BankFacts,
  type BankBrowserItem
} from "@renderer/controls/bankBrowser/BankBrowser";

afterEach(() => cleanup());

/*
 * The shared bank browser shell (`.plans/Z88_SLOT_BROWSER_PLAN.md` §4.1). The NEX viewer's content
 * is covered by `NexBankBrowser.test.tsx`; this covers what the shell adds for any caller - group
 * headers in particular, which only the `.z88` viewer uses.
 */

type View = "memory" | "disassembly";
type Item = BankBrowserItem<View> & { group: string; note?: string };

const VIEW_NAMES: Record<View, string> = { memory: "Memory", disassembly: "Disassembly" };

const item = (bank: number, group: string, over: Partial<Item> = {}): Item => ({
  key: `${bank}`,
  bank,
  lastView: "disassembly",
  group,
  ...over
});

function renderShell(items: Item[], props: { selectedKey?: string; withMenu?: boolean } = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onFilterChange: vi.fn(),
    onPopOut: vi.fn(),
    onMenuItem: vi.fn()
  };
  render(
    <BankBrowser<Item, View>
      visibleItems={items}
      selectedKey={props.selectedKey}
      heading="Slots"
      summary="3 banks"
      filters={[
        { value: "all", text: "All" },
        { value: "rom", text: "ROM" }
      ]}
      filter="all"
      views={["memory", "disassembly"]}
      viewNames={VIEW_NAMES}
      onSelect={handlers.onSelect}
      onFilterChange={handlers.onFilterChange}
      onPopOut={handlers.onPopOut}
      groupOf={(i) => ({ key: i.group, label: `Group ${i.group}` })}
      renderRow={(i) => (i.note ? <BankChip>{i.note}</BankChip> : null)}
      renderDetails={(i) => (
        <BankFacts>
          <dt>Group</dt>
          <dd>{i.group}</dd>
        </BankFacts>
      )}
      renderRowMenuItems={
        props.withMenu
          ? (i, close) => (
              <ContextMenuItem
                text="Extra item"
                clicked={() => {
                  close();
                  handlers.onMenuItem(i.bank);
                }}
              />
            )
          : undefined
      }
      hint="A hint"
    />
  );
  return handlers;
}

describe("BankBrowser", () => {
  it("draws a header above each group, outside the options", () => {
    renderShell([item(0, "ROM"), item(1, "ROM"), item(0x20, "RAM", { note: "SR1" })]);
    const list = screen.getByRole("listbox", { name: "Bank list" });
    expect(within(list).getAllByRole("option").map((r) => r.getAttribute("data-bank"))).toEqual([
      "0",
      "1",
      "32"
    ]);
    expect(within(list).getByText("Group ROM")).toBeInTheDocument();
    expect(within(list).getByText("Group RAM")).toBeInTheDocument();
    expect(within(list).getAllByText(/^Group /)).toHaveLength(2);
    expect(within(screen.getAllByRole("option")[2]).getByText("SR1")).toBeInTheDocument();
  });

  it("steps over group headers with the keyboard and pops out with Enter", () => {
    const { onSelect, onPopOut } = renderShell(
      [item(0, "ROM"), item(1, "ROM"), item(0x20, "RAM", { lastView: "memory" })],
      { selectedKey: "1" }
    );
    const list = screen.getByRole("listbox", { name: "Bank list" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ bank: 0x20 }));
    fireEvent.keyDown(list, { key: "End" });
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ bank: 0x20 }));
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onPopOut).toHaveBeenLastCalledWith(expect.objectContaining({ bank: 1 }), "disassembly");
  });

  it("shows the selected item's details, with the caller's content and the hint", () => {
    renderShell([item(0, "ROM"), item(0x20, "RAM")], { selectedKey: "32" });
    const details = screen.getByRole("complementary", { name: "Bank $20 details" });
    expect(within(details).getByText("(32)")).toBeInTheDocument();
    expect(within(details).getByText("RAM")).toBeInTheDocument();
    expect(within(details).getByText("A hint")).toBeInTheDocument();
  });

  it("pops out in the last view or another one from the split button", async () => {
    const { onPopOut } = renderShell([item(0, "ROM", { lastView: "memory" })]);
    fireEvent.click(screen.getByRole("button", { name: "Pop out in Memory" }));
    expect(onPopOut).toHaveBeenLastCalledWith(expect.objectContaining({ bank: 0 }), "memory");
    fireEvent.click(screen.getByRole("button", { name: "Pop out in another view" }));
    const current = await screen.findByRole("menuitem", { name: /Pop Out in Memory/ });
    expect(current).toHaveTextContent("last used");
    fireEvent.click(screen.getByRole("menuitem", { name: "Pop Out in Disassembly" }));
    expect(onPopOut).toHaveBeenLastCalledWith(expect.objectContaining({ bank: 0 }), "disassembly");
  });

  it("adds the caller's items to a row's context menu", async () => {
    const { onMenuItem, onPopOut } = renderShell([item(0, "ROM"), item(1, "ROM")], {
      withMenu: true
    });
    fireEvent.contextMenu(screen.getAllByRole("option")[1]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Extra item" }));
    expect(onMenuItem).toHaveBeenCalledWith(1);
    fireEvent.contextMenu(screen.getAllByRole("option")[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pop Out in Disassembly" }));
    expect(onPopOut).toHaveBeenLastCalledWith(expect.objectContaining({ bank: 0 }), "disassembly");
  });

  /*
   * Bounded to the viewer's visible area, so the details never scroll away with a long list. jsdom
   * has no layout, so the scrolling ancestor's height is stubbed; the CSS that turns the property
   * into a height is checked in the running app.
   */
  it("takes its height from the viewer's scroll viewport", () => {
    const viewport = document.createElement("div");
    viewport.setAttribute("data-overlayscrollbars-viewport", "");
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 640 });
    document.body.appendChild(viewport);
    const handlers = { onSelect: vi.fn(), onFilterChange: vi.fn(), onPopOut: vi.fn() };
    render(
      <BankBrowser<Item, View>
        visibleItems={[item(0, "ROM")]}
        heading="Slots"
        summary=""
        filters={[]}
        filter="all"
        views={["memory", "disassembly"]}
        viewNames={VIEW_NAMES}
        {...handlers}
        renderRow={() => null}
        renderDetails={() => null}
      />,
      { container: viewport.appendChild(document.createElement("div")) }
    );
    const browser = screen.getByRole("region", { name: "Slots" });
    expect(browser.style.getPropertyValue("--bank-browser-height")).toBe("640px");
    viewport.remove();
  });

  it("reports filter clicks and says when nothing matches", () => {
    const { onFilterChange } = renderShell([]);
    expect(screen.getByText("No bank matches this filter.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ROM" }));
    expect(onFilterChange).toHaveBeenCalledWith("rom");
  });

  it("names its items and numbers them as the caller asks", () => {
    const items = [item(0, "a"), item(1, "a", { lastView: "memory" })];
    render(
      <BankBrowser<Item, View>
        visibleItems={items}
        selectedKey="1"
        heading="Blocks"
        summary=""
        filters={[]}
        filter="all"
        views={["memory", "disassembly"]}
        viewNames={VIEW_NAMES}
        onSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onPopOut={vi.fn()}
        renderRow={() => null}
        renderDetails={() => null}
        itemNoun="Block"
        formatNumber={(i) => `#${i.bank}`}
        viewsFor={(i) => (i.bank === 0 ? [] : ["memory"])}
      />
    );
    expect(screen.getByRole("listbox", { name: "Block list" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "#1 details" })).toBeInTheDocument();
    // --- A caller's own number has no decimal beside it
    expect(screen.queryByText("(1)")).toBeNull();
    // --- Block 0 has no views: no pop-out button on its row
    expect(screen.queryByRole("button", { name: "Pop out Block #0" })).toBeNull();
    expect(screen.getByRole("button", { name: "Pop out Block #1" })).toBeInTheDocument();
  });

  it("hides the details pop-out for an item with no views", () => {
    render(
      <BankBrowser<Item, View>
        visibleItems={[item(0, "a")]}
        heading="Blocks"
        summary=""
        filters={[]}
        filter="all"
        views={["memory"]}
        viewNames={VIEW_NAMES}
        onSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onPopOut={vi.fn()}
        renderRow={() => null}
        renderDetails={() => null}
        itemNoun="Block"
        viewsFor={() => []}
        hint="Pop out a block from its row's icon."
      />
    );
    expect(screen.queryByRole("button", { name: /^Pop out in/ })).toBeNull();
    expect(screen.queryByText("Pop out a block from its row's icon.")).toBeNull();
    expect(screen.getByText("Block $00")).toBeInTheDocument();
  });

  it("stacks by default, and never with layout sideBySide", () => {
    const props = {
      visibleItems: [item(0, "a")],
      heading: "Blocks",
      summary: "",
      filters: [],
      filter: "all",
      views: ["memory"] as View[],
      viewNames: VIEW_NAMES,
      onSelect: vi.fn(),
      onFilterChange: vi.fn(),
      onPopOut: vi.fn(),
      renderRow: () => null,
      renderDetails: () => null
    };
    const { unmount } = render(<BankBrowser<Item, View> {...props} />);
    expect(screen.getByRole("region", { name: "Blocks" }).className).not.toMatch(/sideBySide/);
    unmount();
    render(<BankBrowser<Item, View> {...props} layout="sideBySide" />);
    expect(screen.getByRole("region", { name: "Blocks" }).className).toMatch(/sideBySide/);
  });
});
