import { describe, expect, it } from "vitest";
import { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import { MSR_CB, MSR_RQM, OperationPhase } from "@emu/machines/disk/FloppyControllerDevice";
import { createTestNextMachine } from "../../zxnext/TestNextMachine";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

describe("ZX Next WASM floppy controller device", () => {
  it("matches TypeScript reset status and timing defaults", async () => {
    const oracle = await createTestNextMachine();
    const fdc = oracle.floppyDevice as unknown as IFloppyControllerDeviceTest;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    expect(exports.zxnextFloppyReadMainStatusRegister() & MSR_RQM).toBe(fdc.msr & MSR_RQM);
    expect(exports.zxnextFloppyReadMainStatusRegister() & MSR_CB).toBe(fdc.msr & MSR_CB);
    expect(exports.zxnextGetFloppyOperationPhase()).toBe(fdc.operationPhase);
    expect(exports.zxnextGetFloppyStepRate()).toBe(fdc.stepRate);
    expect(exports.zxnextGetFloppyHeadUnloadTime()).toBe(fdc.headUnloadTime);
    expect(exports.zxnextGetFloppyHeadLoadTime()).toBe(fdc.headLoadTime);
    expect(Boolean(exports.zxnextGetFloppyNonDmaMode())).toBe(fdc.nonDmaMode);
  });

  it("matches TypeScript SenseInterrupt invalid-result behavior with no pending interrupt", async () => {
    const oracle = await createTestNextMachine();
    const fdc = oracle.floppyDevice as unknown as IFloppyControllerDeviceTest;
    const wasm = await createTestZxNextWasmMachine();
    const exports = wasm.wasmV2Runtime!.exports;

    oracle.portManager.writePort(0x3ffd, 0x08);
    exports.zxnextFloppyWriteDataRegister(0x08);

    expect(exports.zxnextGetFloppyOperationPhase()).toBe(OperationPhase.Result);
    expect(fdc.operationPhase).toBe(OperationPhase.Result);
    expect(exports.zxnextFloppyReadDataRegister()).toBe(oracle.portManager.readPort(0x3ffd));
    expect(exports.zxnextGetFloppyOperationPhase()).toBe(fdc.operationPhase);
  });
});
