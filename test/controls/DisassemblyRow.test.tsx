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
        currentSegment={0}
        decimalView={false}
        index={0}
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

  it("renders prefix comments as comment rows", () => {
    const { getByText } = render(
      <DisassemblyRow
        bankLabel={false}
        currentSegment={0}
        decimalView={false}
        index={0}
        isFullView={true}
        item={{
          address: 0x8000,
          isPrefixItem: true,
          prefixComment: "Program entry"
        }}
        mem64kLabels={[]}
        partitionLabels={{}}
        pausedPc={0x0000}
        rowHeight={18}
        showBanks={false}
      />
    );

    expect(getByText("; Program entry")).toBeInTheDocument();
  });
});
