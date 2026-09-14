import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  branchGlyphFor,
  deriveDisassemblyRowViewModel,
  DisassemblyRow,
  isAuthoredRow,
  splitInstructionOperands
} from "@renderer/appIde/DocumentPanels/DisassemblyRow";
import type { BranchVerdict } from "@renderer/appIde/DocumentPanels/branchVerdict";

/*
 * Renders nothing, as it always did, but records what it was handed.
 *
 * Still `null` on purpose: every other test in this file asserts on the row's own DOM, and giving
 * the indicator a body would put an element into the middle of those assertions. What the row
 * *passes* it is a different question, and one worth asking — `BreakpointIndicator` builds its
 * `bp-set` / `bp-del` / `bp-en` commands from these props, so a row that describes a breakpoint
 * wrongly makes it unremovable rather than merely mislabelled.
 */
const indicatorProps: any[] = [];
vi.mock("@renderer/appIde/DocumentPanels/BreakpointIndicator", () => ({
  BreakpointIndicator: (props: any) => {
    indicatorProps.push(props);
    return null;
  }
}));

// --- `Icon` resolves its colour through `useTheme`, which needs a provider this suite does not
// --- mount. The stand-in keeps the props visible as data attributes so a test can assert which
// --- glyph and which token the row asked for, rather than only that *an* icon appeared.
vi.mock("@controls/Tooltip", () => ({
  useTooltipRef: () => ({ current: null }),
  // --- Rendered as data so a test can assert what the narrow panel would have to fall back on.
  TooltipFactory: ({ content }: { content: string }) => <i data-tooltip={content} />
}));

vi.mock("@controls/Icon", () => ({
  Icon: ({ iconName, fill }: { iconName: string; fill?: string }) => (
    <svg data-icon={iconName} data-fill={fill} />
  )
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

describe("DisassemblyRow — branch verdict gutter", () => {
  /** Renders a row with the standard boilerplate, overriding only what a test cares about. */
  function renderRow(props: Partial<React.ComponentProps<typeof DisassemblyRow>> = {}) {
    return render(
      <DisassemblyRow
        bankLabel={false}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{ address: 0x6000, instruction: "jr nz,L5000", opCodes: [0x20, 0xfe] }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={0x0000}
        rowHeight={18}
        showBanks={false}
        {...props}
      />
    );
  }

  const takenBack: BranchVerdict = {
    kind: "jr",
    taken: true,
    conditionText: "NZ",
    reasonText: "Z=0",
    nextAddress: 0x5000,
    direction: "back",
    tstates: 12
  };

  it("renders no gutter at all when the listing is not showing verdicts", () => {
    // --- Decision 2: with the machine stopped the row must have exactly its old geometry, so the
    // --- cell is absent rather than present-and-empty.
    const { container } = renderRow();
    expect(container.querySelector("[data-branch]")).toBeNull();
    expect(container.innerHTML).not.toContain("branchGutter");
  });

  it("reserves the cell on a non-branching row so the columns still line up", () => {
    const { container } = renderRow({ showBranchGutter: true, verdict: undefined });
    const gutter = container.querySelector('[class*="branchGutter"]');
    expect(gutter).not.toBeNull();
    // --- Present, but carrying no glyph.
    expect(gutter!.querySelector("svg")).toBeNull();
  });

  it.each([
    ["back", "branch-back"],
    ["forward", "branch-forward"],
    ["return", "branch-return"],
    ["unknown", "branch-unknown"],
    ["none", "branch-through"]
  ] as const)("draws the %s glyph", (direction, expectedIcon) => {
    expect(branchGlyphFor({ ...takenBack, direction }).iconName).toBe(expectedIcon);
  });

  it.each(["call", "rst"] as const)("draws %s as a round trip, whichever way its target lies", (kind) => {
    // --- A call is a call regardless of direction. Drawing `rst $08` with the back arrow put it in
    // --- the same visual class as a loop closing, which is precisely what it is not.
    expect(branchGlyphFor({ ...takenBack, kind, direction: "back" }).iconName).toBe("branch-call");
    expect(branchGlyphFor({ ...takenBack, kind, direction: "forward" }).iconName).toBe("branch-call");
  });

  it("draws a conditional call that will not be taken as a fall-through, not a call", () => {
    // --- Ordering matters: the not-taken test has to beat the call test, or a `call nz` that is
    // --- about to do nothing would still be drawn as a round trip.
    const verdict = { ...takenBack, kind: "call", taken: false, direction: "none" } as BranchVerdict;
    expect(branchGlyphFor(verdict).iconName).toBe("branch-through");
    expect(branchGlyphFor(verdict).fill).toBe("--color-disassembly-branch-fallthrough");
  });

  it("paints a taken branch with the taken token and a fall-through with the neutral one", () => {
    expect(branchGlyphFor({ ...takenBack, direction: "back" }).fill).toBe(
      "--color-disassembly-branch-taken"
    );
    expect(branchGlyphFor({ ...takenBack, direction: "forward" }).fill).toBe(
      "--color-disassembly-branch-taken"
    );
    // --- Falling through is not a failure, so it is neutral rather than an error hue.
    expect(branchGlyphFor({ ...takenBack, direction: "none" }).fill).toBe(
      "--color-disassembly-branch-fallthrough"
    );
  });

  it("puts a glyph in the gutter for a row that branches", () => {
    const { container } = renderRow({ showBranchGutter: true, verdict: takenBack });
    const gutter = container.querySelector('[class*="branchGutter"]');
    const icon = gutter!.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("data-icon")).toBe("branch-back");
    expect(icon!.getAttribute("data-fill")).toBe("--color-disassembly-branch-taken");
    expect(gutter!.getAttribute("data-branch")).toBe("back");
  });

  it("renders a fall-through in the neutral token, not an error hue", () => {
    const { container } = renderRow({
      showBranchGutter: true,
      verdict: { ...takenBack, taken: false, direction: "none", tstates: 7 }
    });
    const icon = container.querySelector('[class*="branchGutter"] svg');
    expect(icon!.getAttribute("data-icon")).toBe("branch-through");
    expect(icon!.getAttribute("data-fill")).toBe("--color-disassembly-branch-fallthrough");
  });

  it("marks the execution point so the stylesheet can lift it out of the speculative dimming", () => {
    // --- The strength difference between a guess and a fact is a CSS rule keyed off `execPoint`,
    // --- not a per-row decision, so what the row must get right is the class.
    const { container } = renderRow({
      showBranchGutter: true,
      verdict: takenBack,
      pausedPc: 0x6000
    });
    expect(container.querySelector('[class*="execPoint"]')).not.toBeNull();
  });

  it("keeps the gutter off a synopsis comment row, which has no instruction columns", () => {
    const { container } = renderRow({
      showBranchGutter: true,
      item: { address: 0x6000, prefixComment: "A note" }
    });
    expect(container.querySelector('[class*="branchGutter"]')).toBeNull();
  });
});

describe("DisassemblyRow — execution-point readout", () => {
  const verdict: BranchVerdict = {
    kind: "jr",
    taken: true,
    conditionText: "NC",
    reasonText: "C=0",
    nextAddress: 0x0efd,
    direction: "back",
    tstates: 12
  };

  function renderRow(props: Partial<React.ComponentProps<typeof DisassemblyRow>> = {}) {
    return render(
      <DisassemblyRow
        bankLabel={false}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{ address: 0x0f10, instruction: "jr nc,L0EFD", opCodes: [0x30, 0xeb] }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={0x0f10}
        rowHeight={18}
        showBanks={false}
        showBranchGutter={true}
        verdict={verdict}
        {...props}
      />
    );
  }

  it("ships both renderings, since the container query picks between them in CSS", () => {
    // --- jsdom does not evaluate container queries, so what is testable here is that both forms
    // --- exist for the stylesheet to choose from. The swap itself is verified in the app.
    const { container } = renderRow();
    const long = container.querySelector('[data-readout="long"]');
    const short = container.querySelector('[data-readout="short"]');
    expect(long!.textContent).toBe("jumps back to $0EFD  ·  NC met (C=0)  ·  12 T");
    expect(short!.textContent).toBe("→ $0EFD  C=0  12T");
  });

  it("gives the tooltip the long form, which is what a narrow panel is missing", () => {
    const { container } = renderRow();
    expect(container.querySelector("[data-tooltip]")!.getAttribute("data-tooltip")).toBe(
      "jumps back to $0EFD  ·  NC met (C=0)  ·  12 T"
    );
  });

  it("shows the readout only at the execution point", () => {
    // --- Away from PC the flags are today's, not the ones that will hold on arrival; the row gets
    // --- the quiet gutter glyph and nothing more.
    const { container } = renderRow({ pausedPc: 0x9999 });
    expect(container.querySelector('[data-testid="branch-readout"]')).toBeNull();
    expect(container.querySelector('[class*="branchGutter"]')).not.toBeNull();
  });

  it("shows no readout when the listing is not showing verdicts at all", () => {
    const { container } = renderRow({ showBranchGutter: false, verdict: undefined });
    expect(container.querySelector('[data-testid="branch-readout"]')).toBeNull();
  });

  it("marks a fall-through so it is not painted as a taken branch", () => {
    const { container } = renderRow({
      verdict: { ...verdict, taken: false, direction: "none", nextAddress: 0x0f12, tstates: 7 }
    });
    expect(container.querySelector('[data-testid="branch-readout"]')!.className).toContain(
      "notTaken"
    );
  });

  it("follows the panel into decimal", () => {
    const { container } = renderRow({ decimalView: true });
    expect(container.querySelector('[data-readout="long"]')!.textContent).toContain("03837");
  });
});

/*
 * A popped-out NEX bank's gutter.
 *
 * A row there shows an offset inside a 16K bank, not a Z80 address, so its breakpoint cannot be
 * named the way the machine disassembly's is. The name matters beyond display: `BreakpointIndicator`
 * builds its `bp-set` / `bp-del` / `bp-en` command from it, so a row that named its raw address
 * would arm a breakpoint at a Z80 address rather than at an offset in the bank it belongs to.
 */
describe("deriveDisassemblyRowViewModel: bank-relative breakpoints", () => {
  const nexRow = {
    address: 0x4100,
    opCodes: [0x00],
    instruction: "nop"
  } as any;

  const viewModelFor = (breakpoint?: any, partitionLabels: Record<number, string> = {}) =>
    deriveDisassemblyRowViewModel({
      bankLabel: false,
      breakpoint,
      currentSegment: 0,
      decimalView: false,
      isFullView: true,
      item: nexRow,
      mem64kLabels: [],
      partitionLabels,
      pausedPc: -1,
      showBanks: false
    });

  const viewModelWithBankScope = (bankScope?: { bank: number; bankOffset: number }) =>
    deriveDisassemblyRowViewModel({
      bankLabel: false,
      bankScope,
      currentSegment: 0,
      decimalView: false,
      isFullView: true,
      item: nexRow,
      mem64kLabels: [],
      partitionLabels: {},
      pausedPc: -1,
      showBanks: false
    });

  it("names an unarmed row in a bank listing by bank and offset, not by its address", () => {
    /*
     * `BreakpointIndicator` builds its `bp-set` from this name, so the fallback decides what an
     * empty gutter *creates*. Falling back to the row's address armed a plain address breakpoint at
     * wherever the bank was paged: it appeared in the Breakpoints panel and was invisible on the row
     * that made it, because a bank gutter looks up by offset.
     * See .plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md §15.20.
     */
    const vm = viewModelWithBankScope({ bank: 2, bankOffset: 0x2624 });
    expect(vm.breakpointAddress).toBe("02:+$2624");
    expect(vm.hasBreakpoint).toBe(false);
  });

  it("still names an unarmed row by its address outside a bank listing", () => {
    // --- The 64K Disassembly view has no bank scope and must keep the address fallback.
    expect(viewModelWithBankScope(undefined).breakpointAddress).toBe(0x4100);
  });

  it("prefers an existing breakpoint's own identity over the row's bank scope", () => {
    // --- A breakpoint that is already there names itself; the scope only decides what would be made.
    const vm = deriveDisassemblyRowViewModel({
      bankLabel: false,
      bankScope: { bank: 2, bankOffset: 0x2624 },
      breakpoint: { bank: 5, bankOffset: 0x0100, exec: true } as any,
      currentSegment: 0,
      decimalView: false,
      isFullView: true,
      item: nexRow,
      mem64kLabels: [],
      partitionLabels: {},
      pausedPc: -1,
      showBanks: false
    });
    expect(vm.breakpointAddress).toBe("05:+$0100");
  });

  it("names a bank-relative breakpoint by its bank and offset", () => {
    const vm = viewModelFor({ bank: 5, bankOffset: 0x0100, exec: true });
    expect(vm.breakpointAddress).toBe("05:+$0100");
    expect(vm.hasBreakpoint).toBe(true);
  });

  it("leaves the kind out of the name, because the command takes it as an option", () => {
    /*
     * This test used to assert `05:+$0100:W`, on the reasoning that a watchpoint should not be
     * named like an execution breakpoint. That was wrong, and wrong in a way that made the gutter
     * unusable: the name is what `BreakpointIndicator` builds its command from, and the `bp-*`
     * commands take the kind as `-r`/`-w`, not as part of the address — so `bp-del 05:+$0100:W -w`
     * parsed as nothing at all and the dot could not be clicked away.
     *
     * The kind reaches the indicator as its own props instead, which is what builds the option.
     * See `getBreakpointAddressSpec`, and the describe block at the end of this file.
     */
    expect(viewModelFor({ bank: 5, bankOffset: 0x100, memoryWrite: true }).breakpointAddress).toBe(
      "05:+$0100"
    );
    expect(viewModelFor({ bank: 5, bankOffset: 0x100, memoryRead: true }).breakpointAddress).toBe(
      "05:+$0100"
    );
  });

  it("does not name a partition, because a 16K bank is not one", () => {
    // --- A NEX bank is 16K; a Next partition is an 8K page. The label map describes the latter.
    expect(viewModelFor({ bank: 5, bankOffset: 0x100, exec: true }).breakpointPartition).toBe(
      undefined
    );
  });

  it("leaves the other breakpoint shapes exactly as they were", () => {
    // --- An address breakpoint shows the row's raw address...
    expect(viewModelFor({ address: 0x4100, exec: true }).breakpointAddress).toBe(0x4100);
    // --- ...a partition-scoped one does too, and names its partition...
    const partitioned = viewModelFor({ address: 0x4100, partition: 10, exec: true }, { 10: "0A" });
    expect(partitioned.breakpointAddress).toBe(0x4100);
    expect(partitioned.breakpointPartition).toBe("0A");
    // --- ...and a source-bound one is named by its file and line.
    expect(viewModelFor({ resource: "code.asm", line: 12, exec: true }).breakpointAddress).toBe(
      "[code.asm]:12"
    );
  });

  it("reports no breakpoint for an unarmed row", () => {
    const vm = viewModelFor(undefined);
    expect(vm.hasBreakpoint).toBe(false);
    expect(vm.breakpointAddress).toBe(0x4100);
  });
});

/*
 * What the row hands its breakpoint indicator.
 *
 * `BreakpointIndicator` builds `bp-set` / `bp-del` / `bp-en` from these props, so they are not
 * decoration: a row that shows a memory breakpoint while describing it as an execution one issues
 * `bp-del $8000` for a breakpoint whose key is `$8000 R`, which matches nothing and leaves a dot
 * that cannot be clicked away. Watchpoints on a NEX bank made that reachable.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §10.2.
 */
describe("DisassemblyRow: the breakpoint kind reaches the indicator", () => {
  function renderWithBreakpoint(breakpoint: any, over: any = {}) {
    indicatorProps.length = 0;
    render(
      <DisassemblyRow
        bankLabel={false}
        breakpoint={breakpoint}
        commentWidthCh={0}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{ address: 0x8000, instruction: "nop", opCodes: [0x00] }}
        mem64kLabels={[]}
        partitionLabels={{}}
        partitionWidthCh={0}
        pausedPc={-1}
        rowHeight={18}
        showBanks={false}
        {...over}
      />
    );
    return indicatorProps[indicatorProps.length - 1];
  }

  it("forwards a memory read breakpoint as one", () => {
    const props = renderWithBreakpoint({ address: 0x8000, memoryRead: true });
    expect(props.memoryRead).toBe(true);
    expect(props.hasBreakpoint).toBe(true);
  });

  it("forwards a memory write breakpoint as one", () => {
    expect(renderWithBreakpoint({ address: 0x8000, memoryWrite: true }).memoryWrite).toBe(true);
  });

  it("forwards an I/O breakpoint's port mask, which its command needs", () => {
    const props = renderWithBreakpoint({ address: 0x00fe, ioRead: true, ioMask: 0x00ff });
    expect(props.ioRead).toBe(true);
    expect(props.ioMask).toBe(0x00ff);
  });

  it("claims no kind for an execution breakpoint", () => {
    const props = renderWithBreakpoint({ address: 0x8000, exec: true });
    expect(props.memoryRead).toBeFalsy();
    expect(props.memoryWrite).toBeFalsy();
    expect(props.ioRead).toBeFalsy();
    expect(props.ioWrite).toBeFalsy();
  });

  it("names a bank-relative watchpoint by its key, kind and all", () => {
    // --- Both halves together: the address the command targets and the option that selects the
    // --- kind. Either one wrong makes the breakpoint unremovable from the gutter.
    const props = renderWithBreakpoint({ bank: 5, bankOffset: 0x0100, memoryWrite: true });
    expect(props.address).toBe("05:+$0100");
    expect(props.memoryWrite).toBe(true);
  });

  it("offers to edit a bank-relative breakpoint", () => {
    // --- The dialog authors that shape now, so the row must not gate the edit on `address`.
    const onEditBreakpoint = vi.fn();
    const props = renderWithBreakpoint(
      { bank: 5, bankOffset: 0x0100, exec: true },
      { onEditBreakpoint }
    );
    expect(props.onEdit).toBeTypeOf("function");
  });

  it("offers no edit for a row with no breakpoint", () => {
    const props = renderWithBreakpoint(undefined, { onEditBreakpoint: vi.fn() });
    expect(props.onEdit).toBeUndefined();
  });
});
