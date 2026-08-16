import { describe, expect, it } from "vitest";

import type { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import {
  Command,
  MSR_CB,
  MSR_DIO,
  MSR_RQM,
  OperationPhase
} from "@emu/machines/disk/FloppyControllerDevice";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const PORT_1FFD = 0x1ffd;
const PORT_2FFD = 0x2ffd;
const PORT_3FFD = 0x3ffd;

describe("ZX Spectrum Next WASM v2 TypeScript-owned +3 FDC compatibility path", () => {
  it("delegates FDC status and data ports to the TypeScript floppy controller", async () => {
    const machine = await createTestZxNextWasmMachine();
    const fdc = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

    expect(machine.doReadPort(PORT_2FFD) & MSR_RQM).toBe(MSR_RQM);
    expect(machine.doReadPort(PORT_2FFD) & MSR_CB).toBe(0);

    machine.doWritePort(PORT_3FFD, 0x03);
    expect(fdc.command.id).toBe(Command.Specify);
    expect(fdc.commandBytesReceived).toBe(1);
    expect(machine.doReadPort(PORT_2FFD) & (MSR_RQM | MSR_CB)).toBe(MSR_RQM | MSR_CB);

    machine.doWritePort(PORT_3FFD, 0xaf);
    machine.doWritePort(PORT_3FFD, 0x03);
    expect(fdc.commandBytesReceived).toBe(0);
    expect(fdc.operationPhase).toBe(OperationPhase.Command);
    expect(fdc.nonDmaMode).toBe(true);
    expect(fdc.stepRate).toBe(0x06);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      unsupportedPortReadCount: 0,
      unsupportedPortWriteCount: 0
    });
  });

  it("keeps Sense Drive and invalid-command results on the TypeScript FDC path", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.doWritePort(PORT_3FFD, 0x04);
    machine.doWritePort(PORT_3FFD, 0x00);
    expect(machine.doReadPort(PORT_2FFD) & (MSR_DIO | MSR_RQM)).toBe(MSR_DIO | MSR_RQM);
    expect(machine.doReadPort(PORT_3FFD)).toBe(0x58);

    machine.doWritePort(PORT_3FFD, 0x00);
    expect(machine.doReadPort(PORT_3FFD)).toBe(0x80);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      unsupportedPortReadCount: 0,
      unsupportedPortWriteCount: 0
    });
  });

  it("keeps 0x1FFD as a mixed WASM paging and TypeScript motor-control port", async () => {
    const machine = await createTestZxNextWasmMachine();
    const fdc = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

    expect(fdc.currentDrive!.motorOn).toBe(false);
    machine.doWritePort(PORT_1FFD, 0x09);

    expect(fdc.currentDrive!.motorOn).toBe(true);
    expect(machine.getWasmV2Diagnostics().port1ffd).toBe(0x01);

    machine.doWritePort(PORT_1FFD, 0x00);
    expect(fdc.currentDrive!.motorOn).toBe(false);
    expect(machine.getWasmV2Diagnostics().port1ffd).toBe(0x00);
  });

  it("advances TypeScript floppy motor timing after a completed WASM frame", async () => {
    const machine = await createTestZxNextWasmMachine();
    const fdc = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

    machine.doWritePort(PORT_1FFD, 0x08);
    expect(fdc.currentDrive!.motorSpeed).toBe(0);

    machine.executeMachineFrame();

    expect(fdc.currentDrive!.motorSpeed).toBeGreaterThan(0);
  });

  it("applies the shared NR $82 FDC gate while preserving TypeScript ownership", async () => {
    const machine = await createTestZxNextWasmMachine();
    const fdc = machine.floppyDevice as unknown as IFloppyControllerDeviceTest;

    machine.nextRegDevice.directSetRegValue(0x82, 0xef);
    expect(machine.doReadPort(PORT_2FFD)).toBe(0xff);
    expect(machine.doReadPort(PORT_3FFD)).toBe(0xff);

    const commandBefore = fdc.command;
    machine.doWritePort(PORT_3FFD, 0x03);
    expect(fdc.command).toBe(commandBefore);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      unsupportedPortReadCount: 0,
      unsupportedPortWriteCount: 0
    });
  });
});
