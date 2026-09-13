import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveDisassemblyRowViewModel,
  DisassemblyRow,
  isAuthoredRow,
  splitInstructionOperands
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
        // --- The partition's *label*, not its raw index. This row used to render `0:$6000` here
        // --- while showing `R0` in `breakpointPartition` just below — two names for one partition
        // --- inside a single view model.
        breakpointAddress: "R0:$6000",
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

  it("uses annotation formatted labels before generated labels", () => {
    expect(
      deriveDisassemblyRowViewModel({
        bankLabel: false,
        currentSegment: 0,
        decimalView: false,
        isFullView: true,
        item: {
          address: 0x8000,
          formattedLabel: "SixteenCharLabel",
          hasLabel: true,
          instruction: "nop"
        },
        mem64kLabels: [],
        partitionLabels: {},
        pausedPc: -1,
        showBanks: false
      })
    ).toEqual(
      expect.objectContaining({
        labelText: "SixteenCharLabel:"
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
  it("renders prefix comments as full-line comment rows", () => {
    const { getByText, queryByText } = render(
      <DisassemblyRow
        bankLabel={false}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{
          address: 0x8000,
          formattedLabel: "EntryPoint",
          hardComment: "generated note",
          isPrefixItem: true,
          instruction: "call L1234",
          opCodes: [0xcd, 0x34, 0x12],
          prefixComment: "Program entry"
        }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={0x0000}
        rowHeight={18}
        showBanks={false}
      />
    );

    expect(getByText("; Program entry")).toBeInTheDocument();
    expect(queryByText("8000")).not.toBeInTheDocument();
    expect(queryByText("CD 34 12")).not.toBeInTheDocument();
    expect(queryByText("EntryPoint:")).not.toBeInTheDocument();
    expect(queryByText("call L1234")).not.toBeInTheDocument();
    expect(queryByText("; generated note")).not.toBeInTheDocument();
  });

  it("keeps row parity classes on selected range rows", () => {
    const { getByTestId } = render(
      <DisassemblyRow
        bankLabel={false}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={2}
        isFullView={true}
        item={{
          address: 0x8000,
          instruction: "NOP",
          opCodes: [0x00]
        }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={0x0000}
        rowHeight={18}
        selectedRange={true}
        showBanks={false}
      />
    );

    const row = getByTestId("disassembly-row-2");
    expect(row.className).toContain("even");
    expect(row.className).toContain("selectedRangeItem");
  });

  it("uses the shared instruction cell width for four-byte data directives", () => {
    const { getByText } = render(
      <DisassemblyRow
        bankLabel={false}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{
          address: 0x8000,
          instruction: ".defb $00, $00, $00, $00",
          opCodes: []
        }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={0x0000}
        rowHeight={18}
        showBanks={false}
      />
    );

    // --- M2: the instruction column is sized in `ch` now, not px. Asserted on the inline style
    // --- rather than through `toHaveStyle`, which resolves `ch` against jsdom's own font metrics.
    expect(getByText(".defb $00, $00, $00, $00").style.width).toBe("25ch");
  });
});

/**
 * An annotated listing is generated text with a thin layer of authored text over it, and the colour
 * table has to describe that layer — see `--color-annotation-*`. These pin the rules that decide
 * *which* run of characters is authored; the hues themselves are the token layer's business.
 */
describe("annotated disassembly rows", () => {
  const base = {
    bankLabel: false,
    commentWidthCh: 0,
    currentSegment: 0,
    decimalView: false,
    index: 0,
    isFullView: true,
    mem64kLabels: [] as string[],
    partitionLabels: {},
    partitionWidthCh: 0,
    pausedPc: -1,
    rowHeight: 18,
    showBanks: false
  };

  describe("splitInstructionOperands", () => {
    it("splits out the label a resolver substituted for a number", () => {
      expect(
        splitInstructionOperands("ld hl,SpriteTable", [
          { instructionAddress: 0, instructionOffset: 0, operandIndex: 0, operandValue: 0xc000,
            pragma: "W" as any, defaultText: "$C000", resolvedText: "SpriteTable" }
        ])
      ).toEqual(["ld hl,", { label: "SpriteTable" }]);
    });

    it("leaves an unresolved operand as plain text", () => {
      expect(
        splitInstructionOperands("ld hl,$C000", [
          { instructionAddress: 0, instructionOffset: 0, operandIndex: 0, operandValue: 0xc000,
            pragma: "W" as any, defaultText: "$C000" }
        ])
      ).toEqual(["ld hl,$C000"]);
    });

    it("consumes each candidate once, so a repeated name does not claim the same occurrence", () => {
      const operand = (operandIndex: number) => ({
        instructionAddress: 0, instructionOffset: 0, operandIndex, operandValue: 0xc000,
        pragma: "W" as any, defaultText: "$C000", resolvedText: "Loop"
      });
      expect(splitInstructionOperands("ld hl,Loop ; Loop", [operand(0), operand(1)])).toEqual([
        "ld hl,",
        { label: "Loop" },
        " ; ",
        { label: "Loop" }
      ]);
    });

    it("gives up rather than guessing when the name is no longer in the instruction", () => {
      // --- A custom disassembler rewrote the text after the resolver ran.
      expect(
        splitInstructionOperands("rst $08", [
          { instructionAddress: 0, instructionOffset: 0, operandIndex: 0, operandValue: 8,
            pragma: "W" as any, defaultText: "$08", resolvedText: "CallBas" }
        ])
      ).toEqual(["rst $08"]);
    });
  });

  describe("isAuthoredRow", () => {
    it("is false for a row the disassembler produced on its own", () => {
      expect(isAuthoredRow({ address: 0x8000 })).toBe(false);
      expect(
        isAuthoredRow({
          address: 0x8000,
          annotation: { bankOffset: 0, byteLength: 1, regionType: "disassemble" }
        })
      ).toBe(false);
    });

    it("is true for a comment, a name, or a region the user marked as data", () => {
      const at = (extra: Record<string, unknown>) =>
        isAuthoredRow({ address: 0x8000, annotation: { bankOffset: 0, byteLength: 1, ...extra } });
      expect(at({ hasLineAnnotation: true })).toBe(true);
      expect(at({ hasLabel: true })).toBe(true);
      expect(at({ regionType: "bytes" })).toBe(true);
      expect(at({ regionType: "skip" })).toBe(true);
    });
  });

  it("paints a resolved operand label in its own cell", () => {
    const { container, getByText } = render(
      <DisassemblyRow
        {...base}
        annotated
        item={{
          address: 0x8000,
          instruction: "call DrawSprite",
          opCodes: [0xcd, 0x20, 0xc0],
          operandCandidates: [
            { instructionAddress: 0x8000, instructionOffset: 0, operandIndex: 0,
              operandValue: 0xc020, pragma: "W" as any, defaultText: "$C020",
              resolvedText: "DrawSprite" }
          ],
          annotation: { bankOffset: 0, byteLength: 3, regionType: "disassemble" }
        }}
      />
    );

    expect(getByText("DrawSprite").className).toContain("annotationOperand");
    // --- The instruction is still one readable string, split or not.
    expect(container.textContent).toContain("call DrawSprite");
  });

  it("paints a data region as a directive rather than as code", () => {
    const { getByText } = render(
      <DisassemblyRow
        {...base}
        annotated
        item={{
          address: 0x8000,
          instruction: ".defb $01, $02",
          annotation: { bankOffset: 0, byteLength: 2, regionType: "bytes" }
        }}
      />
    );

    expect(getByText(".defb $01, $02").className).toContain("annotationDirective");
  });

  it("lights the rail only on rows carrying something authored", () => {
    const { getByTestId } = render(
      <>
        <DisassemblyRow
          {...base}
          annotated
          index={0}
          item={{
            address: 0x8000,
            instruction: "nop",
            annotation: { bankOffset: 0, byteLength: 1, regionType: "disassemble" }
          }}
        />
        <DisassemblyRow
          {...base}
          annotated
          index={1}
          item={{
            address: 0x8001,
            instruction: "nop",
            hardComment: "the interesting one",
            annotation: {
              bankOffset: 1,
              byteLength: 1,
              regionType: "disassemble",
              hasLineAnnotation: true
            }
          }}
        />
      </>
    );

    const rail = (index: number) =>
      getByTestId(`disassembly-row-${index}`).querySelector('[class*="annotationRail"]');
    // --- Present on both, so the columns after it do not shift between rows.
    expect(rail(0)).not.toBeNull();
    expect(rail(1)).not.toBeNull();
    expect(rail(0)).not.toHaveAttribute("data-authored");
    expect(rail(1)).toHaveAttribute("data-authored", "true");
  });

  it("leaves a machine disassembly row alone", () => {
    const { getByTestId, getByText } = render(
      <DisassemblyRow
        {...base}
        item={{
          address: 0x8000,
          hasLabel: true,
          instruction: "call DrawSprite",
          operandCandidates: [
            { instructionAddress: 0x8000, instructionOffset: 0, operandIndex: 0,
              operandValue: 0xc020, pragma: "W" as any, defaultText: "$C020",
              resolvedText: "DrawSprite" }
          ],
          annotation: { bankOffset: 0, byteLength: 3, regionType: "bytes" }
        }}
      />
    );

    // --- No rail, no operand cell, no directive hue: `annotated` is opt-in and this row did not.
    expect(getByTestId("disassembly-row-0").querySelector('[class*="annotationRail"]')).toBeNull();
    expect(getByText("call DrawSprite").className).toContain("disassemblyInstruction");
    expect(getByText("L8000:").className).toContain("disassemblyLabel");
  });
});
