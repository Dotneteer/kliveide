import "mocha";
import { expect } from "expect";
import {
  DIS_EXEC_BP,
  DebugSupport,
  EXEC_BP,
  PART_BP
} from "@emu/machines/DebugSupport";
import { getBreakpointKey } from "@common/utils/breakpoints";
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
    const bpDef = ds.breakpointDefs.get(getBreakpointKey(bp));
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
    const bpDef = ds.breakpointDefs.get(getBreakpointKey(bp));
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
    const bpDef = ds.breakpointDefs.get(getBreakpointKey(bp));
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
    const bpDef = ds.breakpointDefs.get(getBreakpointKey(bp));
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
});
