import { describe, expect, it } from "vitest";

import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { TapeMode } from "@emu/abstractions/TapeMode";
import { TAPE_MODE } from "@emu/machines/machine-props";

import {
  createOracleSp128Machine,
  createOracleSp48Machine,
  createOracleSpp3eMachine,
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  type TestOracleSp128Machine,
  type TestOracleSp48Machine,
  type TestOracleSpp3eMachine,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

const KEYBOARD_ROW_PORTS = [0xfefe, 0xfdfe, 0xfbfe, 0xf7fe, 0xeffe, 0xdffe, 0xbffe, 0x7ffe];

type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;
type OracleMachine = TestOracleSp48Machine | TestOracleSp128Machine | TestOracleSpp3eMachine;

type PortCase = {
  name: string;
  createWasmMachine: () => Promise<WasmMachine>;
  createOracleMachine: () => Promise<OracleMachine>;
  readWasmPort: (machine: WasmMachine, port: number) => number;
  writeWasmPort: (machine: WasmMachine, port: number, value: number) => void;
  getWasmExport: (machine: WasmMachine, name: string) => number;
};

describe("ZX Spectrum WASM ports and keyboard parity", () => {
  for (const testCase of portCases()) {
    it(`${testCase.name} reads every selected keyboard row like TypeScript`, async () => {
      for (let row = 0; row < KEYBOARD_ROW_PORTS.length; row++) {
        const wasmMachine = await testCase.createWasmMachine();
        const oracleMachine = await testCase.createOracleMachine();
        const keyIndex = row * 5;
        const port = KEYBOARD_ROW_PORTS[row];

        wasmMachine.keyboardDevice.setKeyStatus(keyIndex, true);
        oracleMachine.keyboardDevice.setKeyStatus(keyIndex, true);

        expect(testCase.readWasmPort(wasmMachine, port), `${testCase.name} row ${row}`).toBe(
          oracleMachine.doReadPort(port)
        );
        expect(testCase.readWasmPort(wasmMachine, port) & 0x1f).toBe(0x1e);

        wasmMachine.keyboardDevice.setKeyStatus(keyIndex, false);
        oracleMachine.keyboardDevice.setKeyStatus(keyIndex, false);

        expect(testCase.readWasmPort(wasmMachine, port), `${testCase.name} released ${row}`).toBe(
          oracleMachine.doReadPort(port)
        );
        expect(testCase.readWasmPort(wasmMachine, port) & 0x1f).toBe(0x1f);
      }
    });

    it(`${testCase.name} routes 0xfe writes to border, EAR, MIC, and beeper state`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();

      testCase.writeWasmPort(wasmMachine, 0x00fe, 0x1d);
      oracleMachine.doWritePort(0x00fe, 0x1d);

      expect(testCase.getWasmExport(wasmMachine, "GetPortFeValue")).toBe(0x1d);
      expect(testCase.getWasmExport(wasmMachine, "GetBorderColor")).toBe(5);
      expect(testCase.getWasmExport(wasmMachine, "GetEarBit")).toBe(1);
      expect(testCase.getWasmExport(wasmMachine, "GetMicBit")).toBe(1);
      expect(testCase.getWasmExport(wasmMachine, "GetBeeperLevel")).toBe(3);
      expect(testCase.getWasmExport(wasmMachine, "GetBorderColor")).toBe(
        oracleMachine.screenDevice.borderColor
      );
    });
  }

  for (const testCase of portCases().filter(testCase => testCase.name !== "ZX Spectrum +3E")) {
    it(`${testCase.name} uploads keyboard rows only when changed`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const diagnosticsBefore = wasmMachine.getWasmV2Diagnostics();

      wasmMachine.keyboardDevice.setKeyStatus(0, true);
      wasmMachine.executeMachineFrame();
      const afterFirstUpload = wasmMachine.getWasmV2Diagnostics().keyboardLineWrites;
      expect(afterFirstUpload).toBeGreaterThan(diagnosticsBefore.keyboardLineWrites);

      wasmMachine.executeMachineFrame();
      expect(wasmMachine.getWasmV2Diagnostics().keyboardLineWrites).toBe(afterFirstUpload);

      wasmMachine.keyboardDevice.setKeyStatus(0, false);
      wasmMachine.executeMachineFrame();
      expect(wasmMachine.getWasmV2Diagnostics().keyboardLineWrites).toBeGreaterThan(afterFirstUpload);
    });
  }

  it("128K unsupported Kempston-style port reads return the TypeScript fallback", async () => {
    const wasmMachine = await createTestSp128WasmMachine();
    const oracleMachine = await createOracleSp128Machine();

    expect(wasmMachine.doReadPort(0x001f)).toBe(oracleMachine.doReadPort(0x001f));
    expect(wasmMachine.doReadPort(0x001f)).toBe(0xff);
  });

  it("+3E unsupported non-floating ports return the TypeScript fallback", async () => {
    const wasmMachine = await createTestSpp3eWasmMachine();
    const oracleMachine = await createOracleSpp3eMachine();

    expect(wasmMachine.readTestPort(0x001f)).toBe(oracleMachine.doReadPort(0x001f));
    expect(wasmMachine.readTestPort(0x001f)).toBe(0xff);
  });

  for (const testCase of portCases().filter(testCase => testCase.name !== "ZX Spectrum 48K")) {
    it(`${testCase.name} feeds tape EAR through 0xfe reads while loading`, async () => {
      const wasmMachine = await testCase.createWasmMachine();
      const oracleMachine = await testCase.createOracleMachine();
      const wasmTape = [tapeBlock([0x00])];
      const oracleTape = [tapeBlock([0x00])];

      wasmMachine.setMachineProperty(MEDIA_TAPE, wasmTape);
      oracleMachine.setMachineProperty(MEDIA_TAPE, oracleTape);
      wasmMachine.setMachineProperty(TAPE_MODE, TapeMode.Load);
      oracleMachine.setMachineProperty(TAPE_MODE, TapeMode.Load);

      expect(testCase.readWasmPort(wasmMachine, 0x00fe) & 0x40).toBe(0x40);
    });
  }
});

function portCases(): PortCase[] {
  return [
    {
      name: "ZX Spectrum 48K",
      createWasmMachine: () => createTestSp48WasmMachine(),
      createOracleMachine: () => createOracleSp48Machine(),
      readWasmPort: (machine, port) => (machine as TestSp48WasmMachine).doReadPort(port),
      writeWasmPort: (machine, port, value) => (machine as TestSp48WasmMachine).doWritePort(port, value),
      getWasmExport: (machine, name) => callExport(machine, `sp48${name}`)
    },
    {
      name: "ZX Spectrum 128K",
      createWasmMachine: () => createTestSp128WasmMachine(),
      createOracleMachine: () => createOracleSp128Machine(),
      readWasmPort: (machine, port) => (machine as TestSp128WasmMachine).doReadPort(port),
      writeWasmPort: (machine, port, value) => (machine as TestSp128WasmMachine).doWritePort(port, value),
      getWasmExport: (machine, name) => callExport(machine, `sp128${name}`)
    },
    {
      name: "ZX Spectrum +3E",
      createWasmMachine: () => createTestSpp3eWasmMachine(),
      createOracleMachine: () => createOracleSpp3eMachine(),
      readWasmPort: (machine, port) => (machine as TestSpp3eWasmMachine).doReadPort(port),
      writeWasmPort: (machine, port, value) => (machine as TestSpp3eWasmMachine).writeTestPort(port, value),
      getWasmExport: (machine, name) => callExport(machine, `spp3e${name}`)
    }
  ];
}

function callExport(machine: WasmMachine, name: string): number {
  const fn = (machine.wasmV2Runtime!.exports as Record<string, unknown>)[name];
  if (typeof fn !== "function") {
    throw new Error(`Missing WASM export ${name}`);
  }
  return (fn as () => number)();
}

function tapeBlock(bytes: number[]): TapeDataBlock {
  const block = new TapeDataBlock();
  block.data = new Uint8Array(bytes);
  return block;
}
