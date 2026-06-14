import { describe, expect, it } from "vitest";
import {
  createZ80CpuPanelViewModel,
  sampleZ80CpuState,
  toBoolMark
} from "../../src/renderer/src/components/ide/z80CpuPanelViewModel";

describe("Z80 CPU panel view model", () => {
  it("creates flags in Z80 flag register order", () => {
    const model = createZ80CpuPanelViewModel({ af: 0b1010_0101 });

    expect(model.flags.map((flag) => flag.letter)).toEqual(["S", "Z", "5", "H", "3", "P", "N", "C"]);
    expect(model.flags.map((flag) => flag.active)).toEqual([
      true,
      false,
      true,
      false,
      false,
      true,
      false,
      true
    ]);
  });

  it("formats main and shadow registers", () => {
    const model = createZ80CpuPanelViewModel({
      af: 0x12af,
      bc: 0x0001,
      af_: 0xbeef,
      bc_: 0x2345
    });

    expect(model.mainRegisters[0]).toEqual({
      leftLabel: "AF",
      leftValue: "12AF",
      rightLabel: "AF'",
      rightValue: "BEEF"
    });
    expect(model.mainRegisters[1]).toEqual({
      leftLabel: "BC",
      leftValue: "0001",
      rightLabel: "BC'",
      rightValue: "2345"
    });
  });

  it("uses placeholders for values missing from the CPU snapshot", () => {
    const model = createZ80CpuPanelViewModel({});

    expect(model.mainRegisters[0].leftValue).toBe("----");
    expect(model.mainRegisters[8].leftValue).toBe("--");
    expect(model.interrupts[0].leftValue).toBe("-");
    expect(model.interrupts[0].rightValue).toBe("-");
  });

  it("provides deterministic sample state for the first visible panel proof", () => {
    const model = createZ80CpuPanelViewModel(sampleZ80CpuState);

    expect(model.mainRegisters[0].leftValue).toBe("01B5");
    expect(model.mainRegisters[7].leftValue).toBe("FFFF");
    expect(model.memoryAndIo[0].leftValue).toBe("00");
  });

  it("formats boolean status marks", () => {
    expect(toBoolMark(true)).toBe("●");
    expect(toBoolMark(false)).toBe("○");
    expect(toBoolMark(undefined)).toBe("-");
  });
});
