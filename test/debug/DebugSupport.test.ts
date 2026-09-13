import { describe, it, expect } from "vitest";
import { DIS_EXEC_BP, DebugSupport, EXEC_BP, PART_BP } from "@emu/machines/DebugSupport";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";

describe("DebugSupport", () => {
  it("Constructor works", () => {
    // --- Act
    const ds = new DebugSupport();

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(0);
    expect(ds.breakpointFlags.length).toEqual(0x01_0000);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("addBreakpoint exec #1", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(1);
    const bpDef = ds.breakpointDefs.get(getBreakpointStorageKey(bp));
    expect(bpDef.address).toEqual(bp.address);
    expect(bpDef.exec).toEqual(bp.exec);
    expect(ds.breakpointFlags.length).toEqual(0x01_0000);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("addBreakpoint exec #2", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      resource: "myFile.asm",
      line: 123,
      resolvedAddress: 1234,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(1);
    const bpDef = ds.breakpointDefs.get(getBreakpointStorageKey(bp));
    expect(bpDef.resource).toEqual(bp.resource);
    expect(bpDef.line).toEqual(bp.line);
    expect(bpDef.resolvedAddress).toEqual(bp.resolvedAddress);
    expect(bpDef.exec).toEqual(bp.exec);
    expect(ds.breakpointFlags.length).toEqual(0x01_0000);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("addBreakpoint exec #3", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(1);
    const bpDef = ds.breakpointDefs.get(getBreakpointStorageKey(bp));
    expect(bpDef.address).toEqual(bp.address);
    expect(bpDef.partition).toEqual(bp.partition);
    expect(bpDef.exec).toEqual(bp.exec);
    expect(ds.breakpointFlags.length).toEqual(0x01_0000);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("addBreakpoint exec #4", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(1);
    const bpDef = ds.breakpointDefs.get(getBreakpointStorageKey(bp));
    expect(bpDef.address).toEqual(bp.address);
    expect(bpDef.partition).toEqual(bp.partition);
    expect(bpDef.exec).toEqual(bp.exec);
    expect(ds.breakpointFlags.length).toEqual(0x01_0000);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("addBreakpoint exec #5", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: 3,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(2);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(2);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
    expect(data.partitions[1][0]).toEqual(3);
    expect(data.partitions[1][1]).toEqual(false);
  });

  it("addBreakpoint exec #6", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1240,
      partition: 3,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(2);
    let flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    flag = ds.breakpointFlags[1240];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(2);
    let data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
    data = ds.breakpointData.get(1240);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(3);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("addBreakpoint exec #7", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      hitCount: 12,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);

    // --- Assert
    expect(ds.breakpointData.size).toEqual(1);
    let data = ds.breakpointData.get(1234);
    expect(data.partitions).toEqual(undefined);
    expect(data.targetHitCount).toEqual(12);
    expect(data.currentHitCount).toEqual(0);
  });

  it("removeBreakpoint exec #1", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    const status = ds.removeBreakpoint(bp);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointDefs.size).toEqual(0);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(0);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("removeBreakpoint exec #2", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      resource: "myFile.asm",
      line: 123,
      resolvedAddress: 1234,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    const status = ds.removeBreakpoint(bp);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointDefs.size).toEqual(0);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(0);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("removeBreakpoint exec #3", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    const status = ds.removeBreakpoint(bp);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointDefs.size).toEqual(0);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(0);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("removeBreakpoint exec #4", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Act
    let status = ds.removeBreakpoint(bp);
    status &&= ds.removeBreakpoint(bp2);

    // --- Assert
    expect(status).toEqual(false);
    expect(ds.breakpointDefs.size).toEqual(0);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(0);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("removeBreakpoint exec #5", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: 3,
      exec: true
    };
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Act
    const status = ds.removeBreakpoint(bp);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointDefs.size).toEqual(1);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(PART_BP);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(3);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("removeBreakpoint exec #6", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: 3,
      exec: true
    };
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Act
    const status = ds.removeBreakpoint(bp2);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointDefs.size).toEqual(1);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(PART_BP);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("removeBreakpoint exec #7", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: 3,
      exec: true
    };
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Act
    let status = ds.removeBreakpoint(bp2);
    status &&= ds.removeBreakpoint(bp);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointDefs.size).toEqual(0);
    const flag = ds.breakpointFlags[1234];
    expect(flag).toEqual(0);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("removeBreakpoint exec #8", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      hitCount: 12,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    const status = ds.removeBreakpoint(bp);

    // --- Assert
    expect(status).toEqual(true);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("removeBreakpoint exec #9", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      hitCount: 12,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    const status = ds.removeBreakpoint({
      address: 2345
    });

    // --- Assert
    expect(status).toEqual(false);
    expect(ds.breakpointData.size).toEqual(1);
  });

  it("enableBreakpoint exec #1", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    ds.enableBreakpoint(bp, true);

    // --- Assert
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & DIS_EXEC_BP)).toEqual(false);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("enableBreakpoint exec #2", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    ds.enableBreakpoint(bp, false);

    // --- Assert
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & DIS_EXEC_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("enableBreakpoint exec #3", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      resource: "myFile.asm",
      line: 123,
      resolvedAddress: 1234,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    ds.enableBreakpoint(bp, true);

    // --- Assert
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & DIS_EXEC_BP)).toEqual(false);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("enableBreakpoint exec #4", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      resource: "myFile.asm",
      line: 123,
      resolvedAddress: 1234,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    ds.enableBreakpoint(bp, false);

    // --- Assert
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & DIS_EXEC_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(0);
  });

  it("enableBreakpoint exec #5", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    ds.enableBreakpoint(bp, true);

    // --- Assert
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & DIS_EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("enableBreakpoint exec #6", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    ds.addBreakpoint(bp);

    // --- Act
    ds.enableBreakpoint(bp, false);

    // --- Assert
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & DIS_EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(true);
  });

  it("enableBreakpoint exec #7", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: 3,
      exec: true
    };
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Act
    ds.enableBreakpoint(bp, true);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(2);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(2);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(false);
    expect(data.partitions[1][0]).toEqual(3);
    expect(data.partitions[1][1]).toEqual(false);
  });

  it("enableBreakpoint exec #8", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 1234,
      partition: -2,
      exec: true
    };
    const bp2: BreakpointInfo = {
      address: 1234,
      partition: 3,
      exec: true
    };
    ds.addBreakpoint(bp);
    ds.addBreakpoint(bp2);

    // --- Act
    ds.enableBreakpoint(bp, false);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(2);
    const flag = ds.breakpointFlags[1234];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    expect(ds.breakpointData.size).toEqual(1);
    const data = ds.breakpointData.get(1234);
    expect(data.partitions.length).toEqual(2);
    expect(data.partitions[0][0]).toEqual(-2);
    expect(data.partitions[0][1]).toEqual(true);
    expect(data.partitions[1][0]).toEqual(3);
    expect(data.partitions[1][1]).toEqual(false);
  });
  /*
   * Partition 0 is a real partition on every banked machine — bank `B0` on the 128K, bank `00` on
   * the ZX Next — but `addBreakpoint` gated its partition bookkeeping on truthiness, so a
   * breakpoint in partition 0 was registered as "partitioned" (no `EXEC_BP`, `PART_BP` set) with an
   * empty partition list, which `shouldStopAt` reads as "no match" and never fires.
   *
   * The tests below are paired on purpose: each asserts the behaviour for a non-zero partition
   * first, so a regression shows up as "0 differs from 3" rather than as one opaque failure.
   */
  it("addBreakpoint records partition 0 like any other partition", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = {
      address: 0xc000,
      partition: 0,
      exec: true
    };

    // --- Act
    ds.addBreakpoint(bp);

    // --- Assert
    const flag = ds.breakpointFlags[0xc000];
    expect(!!(flag & EXEC_BP)).toEqual(false);
    expect(!!(flag & PART_BP)).toEqual(true);
    const data = ds.breakpointData.get(0xc000);
    expect(data.partitions.length).toEqual(1);
    expect(data.partitions[0][0]).toEqual(0);
    expect(data.partitions[0][1]).toEqual(false);
  });

  it("shouldStopAt fires for a breakpoint in a non-zero partition", () => {
    // --- Arrange
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0xc000, partition: 3, exec: true });

    // --- Act/Assert
    expect(ds.shouldStopAt(0xc000, () => 3)).toEqual(true);
    expect(ds.shouldStopAt(0xc000, () => 4)).toEqual(false);
  });

  it("shouldStopAt fires for a breakpoint in partition 0", () => {
    // --- Arrange
    const ds = new DebugSupport();
    ds.addBreakpoint({ address: 0xc000, partition: 0, exec: true });

    // --- Act/Assert
    expect(ds.shouldStopAt(0xc000, () => 0)).toEqual(true);
    expect(ds.shouldStopAt(0xc000, () => 1)).toEqual(false);
  });

  it("removeBreakpoint clears a partition 0 breakpoint", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { address: 0xc000, partition: 0, exec: true };
    ds.addBreakpoint(bp);

    // --- Act
    ds.removeBreakpoint(bp);

    // --- Assert
    expect(ds.breakpointDefs.size).toEqual(0);
    expect(!!(ds.breakpointFlags[0xc000] & PART_BP)).toEqual(false);
    expect(ds.shouldStopAt(0xc000, () => 0)).toEqual(false);
  });

  it("enableBreakpoint disables and re-enables a partition 0 breakpoint", () => {
    // --- Arrange
    const ds = new DebugSupport();
    const bp: BreakpointInfo = { address: 0xc000, partition: 0, exec: true };
    ds.addBreakpoint(bp);

    // --- Act/Assert
    expect(ds.enableBreakpoint(bp, false)).toEqual(true);
    expect(ds.shouldStopAt(0xc000, () => 0)).toEqual(false);

    expect(ds.enableBreakpoint(bp, true)).toEqual(true);
    expect(ds.shouldStopAt(0xc000, () => 0)).toEqual(true);
  });
});
