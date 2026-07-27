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
});
