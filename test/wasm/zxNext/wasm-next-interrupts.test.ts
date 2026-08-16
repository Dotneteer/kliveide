import { describe, expect, it } from "vitest";

import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const DAISY_PRIORITY_LINE = 0;
const DAISY_PRIORITY_ULA = 11;

describe("ZX Spectrum Next WASM v2 interrupts", () => {
  it("matches TypeScript for interrupt NextReg read/write state", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);

    const cases: Array<[number, number]> = [
      [0x02, 0x8c],
      [0x22, 0xff],
      [0x23, 0x5a],
      [0xc0, 0xe9],
      [0xc2, 0x34],
      [0xc3, 0x12],
      [0xc4, 0x03],
      [0xc5, 0xa5],
      [0xc6, 0x73],
      [0xcc, 0x83],
      [0xcd, 0x5a],
      [0xce, 0x73]
    ];

    for (const [reg, value] of cases) {
      wasmMachine.nextRegDevice.directSetRegValue(reg, value);
      oracleMachine.nextRegDevice.directSetRegValue(reg, value);
      expect(wasmMachine.nextRegDevice.directGetRegValue(reg), `reg ${reg.toString(16)}`).toBe(
        oracleMachine.nextRegDevice.directGetRegValue(reg)
      );
    }

    expect(wasmMachine.getWasmV2Diagnostics()).toMatchObject({
      interruptLineValue: 0x15a,
      interruptIm2TopBits: 0xe0,
      interruptStacklessNmiEnabled: true,
      interruptHwIm2Mode: true,
      interruptNmiReturnAddress: 0x1234,
      interruptCtcEnabledMask: 0xa5,
      interruptCtcDmaEnableMask: 0x5a
    });
  });

  it("captures and clears ULA, line, CTC, UART, and DMA interrupt status", async () => {
    const romSet = createTestZxNextRomSet();
    const wasmMachine = await createTestZxNextWasmMachine(romSet);
    const oracleMachine = await createOracleZxNextMachine(romSet);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    wasmMachine.nextRegDevice.directSetRegValue(0xc4, 0x03);
    oracleMachine.nextRegDevice.directSetRegValue(0xc4, 0x03);
    wasmMachine.nextRegDevice.directSetRegValue(0xc5, 0x04);
    oracleMachine.nextRegDevice.directSetRegValue(0xc5, 0x04);
    wasmMachine.nextRegDevice.directSetRegValue(0xc6, 0x11);
    oracleMachine.nextRegDevice.directSetRegValue(0xc6, 0x11);
    wasmMachine.nextRegDevice.directSetRegValue(0xcc, 0x03);
    oracleMachine.nextRegDevice.directSetRegValue(0xcc, 0x03);

    wasm.zxnextCaptureUlaInterruptPulse();
    wasm.zxnextCaptureLineInterruptPulse();
    wasm.zxnextSetCtcInterruptStatus(2, 1);
    wasm.zxnextSetUartInterruptStatus(0, 1);
    wasm.zxnextSetUartInterruptStatus(3, 1);
    oracleMachine.interruptDevice.captureUlaInterruptPulse();
    oracleMachine.interruptDevice.captureLineInterruptPulse();
    oracleMachine.interruptDevice.setCtcChannelInterruptStatus(2, true);
    oracleMachine.interruptDevice.uart0RxAvailableStatus = true;
    oracleMachine.interruptDevice.uart1RxAvailableStatus = true;

    expect(wasmMachine.nextRegDevice.directGetRegValue(0x20)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0x20));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0xc8)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0xc8));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0xc9)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0xc9));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0xca)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0xca));
    expect(wasm.zxnextGetDmaInterruptRequestActive()).toBe(1);

    wasmMachine.nextRegDevice.directSetRegValue(0xc8, 0x02);
    oracleMachine.nextRegDevice.directSetRegValue(0xc8, 0x02);
    wasmMachine.nextRegDevice.directSetRegValue(0xc9, 0x04);
    oracleMachine.nextRegDevice.directSetRegValue(0xc9, 0x04);
    wasmMachine.nextRegDevice.directSetRegValue(0xca, 0x11);
    oracleMachine.nextRegDevice.directSetRegValue(0xca, 0x11);

    expect(wasmMachine.nextRegDevice.directGetRegValue(0xc8)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0xc8));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0xc9)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0xc9));
    expect(wasmMachine.nextRegDevice.directGetRegValue(0xca)).toBe(oracleMachine.nextRegDevice.directGetRegValue(0xca));
  });

  it("drives public HW IM2 interrupt checks from WASM daisy state", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;

    machine.nextRegDevice.directSetRegValue(0xc0, 0xe1);
    machine.nextRegDevice.directSetRegValue(0xc4, 0x03);
    wasm.zxnextCaptureUlaInterruptPulse();
    wasm.zxnextCaptureLineInterruptPulse();

    expect(machine.shouldRaiseInterrupt()).toBe(true);
    expect(wasm.zxnextDaisyPeekInterruptVector()).toBe(0xe0 | (DAISY_PRIORITY_LINE << 1));
    expect(wasm.zxnextDaisyAcknowledge()).toBe(0xe0 | (DAISY_PRIORITY_LINE << 1));
    expect(machine.nextRegDevice.directGetRegValue(0xc8)).toBe(0x02);
    expect(machine.shouldRaiseInterrupt()).toBe(false);

    wasm.zxnextDaisyReti();
    expect(machine.shouldRaiseInterrupt()).toBe(true);
    expect(wasm.zxnextDaisyAcknowledge()).toBe(0xe0 | (DAISY_PRIORITY_ULA << 1));
    expect(machine.nextRegDevice.directGetRegValue(0xc8)).toBe(0x01);
    expect(machine.getWasmV2Diagnostics().interruptDaisyInServiceMask).toBe(1 << DAISY_PRIORITY_ULA);
  });
});
