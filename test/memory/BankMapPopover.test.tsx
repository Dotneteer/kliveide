import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";

import { nextPartitionInfo, partitionIndex, spectrumPartitionInfo } from "@common/annotations/partitionInfo";
import { nextPartitionGroups, nextPartitionLabels } from "@emu/machines/zxNext/nextMachineInfo";
import type { ReactNode } from "react";

// --- The map's grid scrolls in a ScrollViewer, which needs the theme
vi.mock("@renderer/controls/ScrollViewer", () => ({
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}));

import { BankMapPopover, PartitionRow } from "@renderer/features/memoryMap/PartitionRow";
import { pagedSlotsOf } from "@renderer/features/memoryMap/memoryMapModel";

afterEach(() => cleanup());

const NEXT = nextPartitionInfo({ labels: nextPartitionLabels(), groups: nextPartitionGroups() });
const NEXT_PARTS = partitionIndex(NEXT);
const PAGING = [-1, -1, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01];

function renderMap(onSelect = vi.fn(), onClose = vi.fn()) {
  const result = render(
    <BankMapPopover
      set={NEXT}
      partitions={NEXT_PARTS}
      current={0x04}
      paged={pagedSlotsOf(PAGING)}
      roles={{ 0x0a: ["ulaScreen"], 0x10: ["layer2"] }}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
  const dialog = result.getByRole("dialog");
  const current = () => dialog.querySelector("[class*='mapCellCurrent']")?.textContent;
  return { ...result, dialog, current, onSelect, onClose };
}

describe("BankMapPopover", () => {
  it("starts on the current partition and moves with the arrows", () => {
    const { dialog, current } = renderMap();
    expect(current()).toMatch(/^04/);
    fireEvent.keyDown(dialog, { key: "ArrowDown" });
    expect(current()).toMatch(/^14/);
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    fireEvent.keyDown(dialog, { key: "ArrowUp" });
    expect(current()).toMatch(/^M4/);
  });

  it("opens the focused partition with Enter and closes with Esc", () => {
    const { dialog, onSelect, onClose } = renderMap();
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    fireEvent.keyDown(dialog, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(0x05);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("fades what the filter does not match and moves to the first match", () => {
    const { dialog, current, getByPlaceholderText } = renderMap();
    fireEvent.change(getByPlaceholderText(/screen/), { target: { value: "layer" } });
    const faded = dialog.querySelectorAll("[class*='mapCellFaded']").length;
    expect(faded).toBe(NEXT.partitions.length - 1);
    expect(current()).toMatch(/^10/);
    expect(screen.getByText(/1 of 247 partitions/)).toBeTruthy();
  });

  it("marks paged-in partitions with their slots", () => {
    const { dialog } = renderMap();
    const cell = dialog.querySelector("[data-part='4']")!;
    expect(cell.textContent).toBe("044");
    expect(dialog.querySelector("[data-part='-1']")!.textContent).toBe("R00·1");
  });
});

describe("PartitionRow", () => {
  const SP128 = spectrumPartitionInfo({
    labels: { [-2]: "R1", [-1]: "R0", 0: "B0", 1: "B1", 2: "B2", 3: "B3", 4: "B4", 5: "B5", 6: "B6", 7: "B7" }
  });

  it("lists a 128K's ten partitions as chips", () => {
    const onSelect = vi.fn();
    const { getAllByRole } = render(
      <PartitionRow
        set={SP128}
        partitions={partitionIndex(SP128)}
        current={undefined}
        paged={pagedSlotsOf([-2, -2, 5, 5, 2, 2, 0, 0])}
        recent={[]}
        bankMapOpen={false}
        onBankMapOpenChange={() => {}}
        onSelect={onSelect}
      />
    );
    const chips = getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["64K", "R0", "R10", "B03", "B1", "B22", "B3", "B4", "B51", "B6", "B7"]);
    fireEvent.click(chips[6]);
    expect(onSelect).toHaveBeenCalledWith(3);
  });

  it("gives the Next Paged in, Recent and the Bank map", () => {
    const onOpen = vi.fn();
    const { getByText, getAllByRole } = render(
      <PartitionRow
        set={NEXT}
        partitions={NEXT_PARTS}
        current={undefined}
        paged={pagedSlotsOf(PAGING)}
        recent={[0x12, -11]}
        bankMapOpen={false}
        onBankMapOpenChange={onOpen}
        onSelect={() => {}}
      />
    );
    expect(getByText("Paged in")).toBeTruthy();
    expect(getByText("Recent")).toBeTruthy();
    const texts = getAllByRole("button").map((c) => c.textContent);
    expect(texts).toContain("R00·1");
    expect(texts).toContain("M3");
    fireEvent.click(getByText("Bank map"));
    expect(onOpen).toHaveBeenCalledWith(true);
  });
});
