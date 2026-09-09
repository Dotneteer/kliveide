import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveDisassemblyRowViewModel,
  DisassemblyRow
} from "@renderer/appIde/DocumentPanels/DisassemblyRow";

vi.mock("@renderer/appIde/DocumentPanels/BreakpointIndicator", () => ({
  BreakpointIndicator: () => null
}));

afterEach(() => {
  cleanup();
});

describe("deriveDisassemblyRowViewModel", () => {
  it("formats hex row values and breakpoint metadata", () => {
    expect(
      deriveDisassemblyRowViewModel({
        bankLabel: true,
        breakpoint: {
          address: 0x6000,
          partition: 0,
          resource: "memory"
        },
        currentSegment: 0,
        decimalView: false,
        isFullView: true,
        item: {
          address: 0x6000,
          hasLabel: true,
          instruction: "LD A,1",
          opCodes: [0x3e, 0x01],
          tstates: 7
        },
        mem64kLabels: ["", "", "", "R0"],
        partitionLabels: { 0: "R0" },
        pausedPc: 0x6000,
        showBanks: true
      })
    ).toEqual(
      expect.objectContaining({
        addressText: "6000",
        breakpointAddress: "0:$6000",
        breakpointPartition: "R0",
        execPoint: true,
        hasBreakpoint: true,
        labelText: "L6000:",
        opCodes: "3E 01",
        partitionLabel: "R0",
        tstates: "7"
      })
    );
  });

  it("formats decimal opcode, address, and partition values", () => {
    expect(
      deriveDisassemblyRowViewModel({
        bankLabel: true,
        currentSegment: 0,
        decimalView: true,
        isFullView: false,
        item: {
          address: 0x0010,
          instruction: "NOP",
          opCodes: [0x00, 0xff]
        },
        mem64kLabels: [],
        partitionLabels: { 0: "0A" },
        pausedPc: 0x2000,
        showBanks: true
      })
    ).toEqual(
      expect.objectContaining({
        addressText: "00016",
        execPoint: false,
        opCodes: "000 255",
        partitionLabel: "010",
        useWidePartitions: true
      })
    );
  });

  it("renders bank prefix and address as compact cells", () => {
    const { getByText } = render(
      <DisassemblyRow
        bankLabel={true}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        partitionWidthCh={2}
        isFullView={true}
        item={{
          address: 0x6000,
          instruction: "NOP",
          opCodes: [0x00]
        }}
        mem64kLabels={["", "", "", "R0"]}
        partitionLabels={{ 0: "R0" }}
        pausedPc={0x0000}
        rowHeight={18}
        showBanks={true}
      />
    );

    expect(getByText("R0").className).toContain("partitionLabel");
    expect(getByText(":").className).toContain("partitionColon");
    expect(getByText("6000").className).toContain("addressLabel");
  });

  /**
   * The hard-comment column is shared, not per-row.
   *
   * Sizing it to each row's own text left the list ragged: a row carrying a comment ran past its
   * neighbours, and once the panel was narrow enough to scroll, the zebra stripes ended at
   * different x positions. `DisassemblyPanel` takes the widest comment in the listing and every row
   * reserves exactly that, so a row without one still ends where its neighbours do.
   */
  const renderRow = (props: { commentWidthCh: number; hardComment?: string }) =>
    render(
      <DisassemblyRow
        bankLabel={false}
        commentWidthCh={props.commentWidthCh}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={false}
        item={{
          address: 0x6000,
          hardComment: props.hardComment,
          instruction: "NOP",
          opCodes: [0x00]
        }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={0x0000}
        rowHeight={18}
        showBanks={false}
      />
    );

  /*
   * The row draws two low-emphasis cells: the opcode bytes and, last, the hard comment. Both are
   * `DataSecondary`, so this takes them in order rather than by class alone — index 0 is always the
   * opcodes, and a second entry exists only when the comment column is being reserved.
   */
  const secondaryCells = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("span")).filter((el) =>
      el.className.includes("dataSecondary")
    );
  const commentCell = (container: HTMLElement) => secondaryCells(container)[1];

  it("reserves the shared comment width even on a row that has no comment", () => {
    const withComment = renderRow({ commentWidthCh: 28, hardComment: "(Invoke ROM 3 subroutine)" });
    const commented = commentCell(withComment.container);
    expect(commented?.textContent).toBe("; (Invoke ROM 3 subroutine)");
    expect(commented?.style.width).toBe("28ch");
    cleanup();

    // --- Same width, no text: this is what keeps the two rows ending at the same x.
    const withoutComment = renderRow({ commentWidthCh: 28 });
    const bare = commentCell(withoutComment.container);
    expect(bare?.textContent).toBe("");
    expect(bare?.style.width).toBe("28ch");
  });

  it("omits the comment column entirely when no row in the listing has a comment", () => {
    // --- 0 is what the panel derives for a listing with no comments, and it must cost nothing:
    // --- an empty cell of width 0 would still add its borders and flex participation.
    const { container } = renderRow({ commentWidthCh: 0 });
    // --- Only the opcode cell remains; no second low-emphasis cell is rendered at all.
    expect(secondaryCells(container)).toHaveLength(1);
    expect(commentCell(container)).toBeUndefined();
  });

  /**
   * The bank column is shared too, and for the same reason.
   *
   * `PartitionPrefix` used to render only when *this* row had a label, at a width taken from
   * *this* row's label. In full view the label comes from `mem64kLabels[address >> 13]`, so an
   * unlabelled bank dropped the cell and shortened the row; in decimal view a list could mix a 2ch
   * hex label and a 3ch decimal one. Both leave the rows ending at different x positions.
   */
  const renderBankRow = (partitionWidthCh: number, address: number, mem64kLabels: string[]) =>
    render(
      <DisassemblyRow
        bankLabel={true}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{ address, instruction: "NOP", opCodes: [0x00] }}
        mem64kLabels={mem64kLabels}
        partitionLabels={{ 0: "R0" }}
        partitionWidthCh={partitionWidthCh}
        pausedPc={0x0000}
        showBanks={true}
        rowHeight={18}
      />
    );

  const prefixCell = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[class*="partitionPrefix"]');

  it("holds the bank column open on a row whose bank has no label", () => {
    // --- Two rows of the same listing: 0x0000 falls in an unlabelled bank, 0x6000 in "R0".
    const labels = ["", "", "", "R0"];
    const unlabelled = renderBankRow(2, 0x0000, labels);
    const cell = prefixCell(unlabelled.container);
    // --- Present and sized, but painting nothing: no bare ":" where there is no bank.
    expect(cell).not.toBeNull();
    expect(cell?.style.visibility).toBe("hidden");
    expect(cell?.querySelector<HTMLElement>('[class*="partitionLabel"]')?.style.width).toBe("2ch");
    cleanup();

    const labelled = renderBankRow(2, 0x6000, labels);
    const shown = prefixCell(labelled.container);
    expect(shown?.style.visibility).toBe("");
    expect(shown?.querySelector<HTMLElement>('[class*="partitionLabel"]')?.style.width).toBe("2ch");
  });
});
