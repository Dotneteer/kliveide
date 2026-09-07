import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

function mockIdeCommands(
  getCharSet: () => Record<number, { v?: string; t?: string; c?: string }> = () => ({
    0x41: { v: "A", t: "letter A" }
  })
) {
  vi.doMock("@renderer/appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      machineService: {
        getMachineInfo: () => ({
          machine: {
            charSet: getCharSet()
          }
        })
      }
    })
  }));
  vi.doMock("@renderer/appIde/services/ide-commands", () => ({
    toBin8: (value: number) => value.toString(2).padStart(8, "0"),
    toDecimal3: (value: number) => value.toString(10).padStart(3, "0"),
    toDecimal5: (value: number) => value.toString(10).padStart(5, "0"),
    toDecimal7: (value: number) => value.toString(10).padStart(7, "0"),
    toHexa2: (value: number) => value.toString(16).toUpperCase().padStart(2, "0"),
    toHexa4: (value: number) => value.toString(16).toUpperCase().padStart(4, "0"),
    toHexa6Dash: (value: number) => value.toString(16).toUpperCase().padStart(6, "0")
  }));
}

describe("MemoryDumpSection", () => {
  it("builds tooltip cache entries from the provided character set", async () => {
    mockIdeCommands();
    const {
      buildByteTooltipCache,
      getMemoryCharacterInfo
    } = await import("@renderer/features/memory/MemoryDumpSection");

    const cache = buildByteTooltipCache({
      0x41: { v: "A", t: "letter A" },
      0x80: { c: "graph", t: "ignored" }
    } as never);

    expect(cache[0x41]).toContain("$41");
    expect(cache[0x41]).toContain("A letter A");
    expect(cache[0x80]).toContain("(graphics)");
    expect(cache[0x00]).toContain("$00");

    const charset = { 0x41: { v: "A", t: "letter A" } };
    expect(getMemoryCharacterInfo(charset as never)).toBe(getMemoryCharacterInfo(charset as never));
    expect(getMemoryCharacterInfo()).toBe(getMemoryCharacterInfo());
  });

  it("maps pointer offsets to byte indexes using rendered text geometry", async () => {
    mockIdeCommands();
    const { getByteIndexAtOffset } = await import("@renderer/features/memory/MemoryDumpSection");

    expect(getByteIndexAtOffset(0, 230, 23, false, 8)).toBe(0);
    expect(getByteIndexAtOffset(25, 230, 23, false, 8)).toBeNull();
    expect(getByteIndexAtOffset(30, 230, 23, false, 8)).toBe(1);
    expect(getByteIndexAtOffset(35, 310, 31, true, 8)).toBeNull();
    expect(getByteIndexAtOffset(45, 310, 31, true, 8)).toBe(1);
    expect(getByteIndexAtOffset(5, 0, 23, false, 8)).toBeNull();
  });

  it("renders byte snapshots without measuring hidden DOM text", async () => {
    mockIdeCommands();
    const appendChild = vi.spyOn(document.body, "appendChild");
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");
    const container = document.createElement("div");

    const { getByText } = render(
      <MemoryDumpSection
        address={0x4000}
        bytes={[0x41]}
        decimalView={false}
        charDump={true}
        lastJumpAddress={-1}
      />,
      { container }
    );

    expect(getByText("41")).toBeTruthy();
    expect(getByText("A")).toBeTruthy();
    expect(appendChild).not.toHaveBeenCalled();
  });

  it("renders the bank prefix and address as compact cells", async () => {
    mockIdeCommands();
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");

    const { getByText } = render(
      <MemoryDumpSection
        showPartitions={true}
        partitionLabel="R0"
        address={0}
        bytes={[0x41]}
        decimalView={false}
        charDump={false}
        lastJumpAddress={-1}
      />
    );

    expect(getByText("R0").className).toContain("partitionLabel");
    expect(getByText(":").className).toContain("partitionColon");
    expect(getByText("0000").className).toContain("addressLabel");
  });

  it("renders decimal bank labels without inheriting generic label margins", async () => {
    mockIdeCommands();
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");

    const { getByText } = render(
      <MemoryDumpSection
        showPartitions={true}
        partitionLabel="0A"
        address={10}
        bytes={[0x41]}
        decimalView={true}
        charDump={false}
        lastJumpAddress={-1}
      />
    );

    expect(getByText("010").className).toContain("partitionLabel");
    expect(getByText("00010").className).toContain("addressLabel");
  });

  it("uses text geometry for context-menu edit addresses", async () => {
    mockIdeCommands();
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");
    const editClicked = vi.fn();

    const { getByText } = render(
      <MemoryDumpSection
        address={0x4000}
        bytes={[0x41, 0x42]}
        decimalView={false}
        charDump={false}
        lastJumpAddress={-1}
        editClicked={editClicked}
      />
    );

    const hexValues = getByText("41 42");
    vi.spyOn(hexValues, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 50,
      bottom: 16,
      width: 50,
      height: 16,
      toJSON: () => ({})
    });

    fireEvent.contextMenu(hexValues, { clientX: 35, clientY: 8 });

    expect(editClicked).toHaveBeenCalledWith(0x4001);
  });

  it("colours the hover tooltip's lines to match the column each one describes", async () => {
    mockIdeCommands(() => ({ 0x41: { v: "A", t: "letter A" } }));
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");

    const { getByText } = render(
      <MemoryDumpSection
        address={0x4000}
        bytes={[0x41, 0x42]}
        decimalView={false}
        charDump={false}
        lastJumpAddress={-1}
      />
    );

    const hexValues = getByText("41 42");
    vi.spyOn(hexValues, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 50,
      bottom: 16,
      width: 50,
      height: 16,
      toJSON: () => ({})
    });

    fireEvent.mouseMove(hexValues, { clientX: 5, clientY: 8 });

    // The tooltip is portaled (to #overlayRoot, or document.body as a fallback in this
    // provider-less render), so it lands outside RTL's own `container` - query the document.
    const header = document.body.querySelector('[class*="tooltipHeader"]');
    const value = document.body.querySelector('[class*="tooltipValue"]');
    const charDesc = document.body.querySelector('[class*="tooltipCharDesc"]');

    expect(header?.textContent).toBe("Value at $4000 (16384):");
    expect(value?.textContent).toBe("$41 (65, 01000001)");
    expect(charDesc?.textContent).toBe("A letter A");

    // The tooltip box itself carries the memory view's own styling (a darker surface, accent
    // border) rather than the app's generic shared `.tooltip` look - `.memoryTooltip` is merged
    // onto the same element `.tooltip` is on, not used instead of it.
    const tooltipBox = header?.parentElement;
    expect(tooltipBox?.className).toContain("tooltip_");
    expect(tooltipBox?.className).toContain("memoryTooltip");
  });

  it("updates character output when the active machine charset changes", async () => {
    let charset = {
      0x41: { v: "A", t: "letter A" }
    };
    mockIdeCommands(() => charset);
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");

    const { getByText, queryByText, rerender } = render(
      <MemoryDumpSection
        address={0x4000}
        bytes={[0x41]}
        decimalView={false}
        charDump={true}
        lastJumpAddress={-1}
      />
    );

    expect(getByText("A")).toBeTruthy();

    charset = {
      0x41: { v: "B", t: "letter B" }
    };
    rerender(
      <MemoryDumpSection
        address={0x4000}
        bytes={[0x41]}
        decimalView={false}
        charDump={true}
        lastJumpAddress={-1}
      />
    );

    expect(getByText("B")).toBeTruthy();
    expect(queryByText("A")).not.toBeInTheDocument();
  });

  it("renders each byte's own character when bytes come from a Uint8Array view, not a plain array", async () => {
    /*
     * The live Machine Memory panel (`MemoryPanel.tsx`) passes `bytes` as `memory.subarray(...)` -
     * a `Uint8Array` view, not a plain array, to avoid copying on every scroll. `CharDump` used to
     * build its `<span>`s with `bytes.map(...)`: fine for `Array.prototype.map`, but
     * `Uint8Array.prototype.map` builds a *new typed array* instead, coercing every callback
     * return value (a JSX element) to a number for storage - a React element coerces to `NaN`,
     * clamped to `0` - so every position showed "0" regardless of the byte's actual value. Only
     * the character column was affected: `HexValues` builds its string with an indexing `for`
     * loop, which behaves identically on both array kinds.
     */
    mockIdeCommands(() => ({
      0x41: { v: "A" },
      0x42: { v: "B" },
      0x43: { v: "C" }
    }));
    const { MemoryDumpSection } = await import("@renderer/features/memory/MemoryDumpSection");

    const memory = new Uint8Array(0x10000);
    memory[0x8000] = 0x41;
    memory[0x8001] = 0x42;
    memory[0x8002] = 0x43;
    const bytes = memory.subarray(0x8000, 0x8003);

    const { container } = render(
      <MemoryDumpSection
        address={0x8000}
        bytes={bytes as unknown as number[]}
        decimalView={false}
        charDump={true}
        lastJumpAddress={-1}
      />
    );

    expect(container.querySelector('[class*="hexValues"]')?.textContent).toBe("41 42 43");
    expect(container.querySelector('[class*="charValues"]')?.textContent).toBe("ABC");
  });
});
