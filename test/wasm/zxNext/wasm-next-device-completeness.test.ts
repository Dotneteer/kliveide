import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type DeviceCoverage = {
  device: string;
  wasmSuites: string[];
  typeScriptSuites: string[];
  requiredSemantics: string[];
  typeScriptOwnedBoundaries?: string[];
};

const DEVICE_COVERAGE: DeviceCoverage[] = [
  {
    device: "DMA",
    wasmSuites: ["wasm-next-dma.test.ts"],
    typeScriptSuites: [
      "DmaDevice.test.ts",
      "DmaDevice-z80-transfers.test.ts",
      "DmaDevice-z80-io-transfers.test.ts",
      "DmaDevice-readcycle.test.ts",
      "DmaDevice-writecycle.test.ts",
      "DmaDevice-timing.test.ts",
      "DmaDevice-status.test.ts"
    ],
    requiredSemantics: [
      "register parsing",
      "read-mask sequencing",
      "memory-to-memory transfers",
      "memory-to-I/O transfers",
      "I/O-to-memory transfers",
      "direction handling",
      "address update modes",
      "transfer counters"
    ]
  },
  {
    device: "floppy",
    wasmSuites: ["wasm-next-floppy.test.ts"],
    typeScriptSuites: ["FloppyControllerDevice.test.ts"],
    requiredSemantics: ["reset status", "command phase", "result phase", "SenseInterrupt"],
    typeScriptOwnedBoundaries: ["disk image/media persistence", "host file handoff"]
  },
  {
    device: "CTC",
    wasmSuites: ["wasm-next-ctc.test.ts"],
    typeScriptSuites: ["CtcDevice.test.ts"],
    requiredSemantics: ["control register", "time constant", "timer/counter clocking", "interrupt enable"]
  },
  {
    device: "UART/I2C",
    wasmSuites: ["wasm-next-uart-i2c.test.ts"],
    typeScriptSuites: ["UartDevice.test.ts", "I2cDevice.test.ts"],
    requiredSemantics: ["UART FIFOs", "UART status", "UART channel selection", "I2C SCL/SDA state"]
  },
  {
    device: "joystick/mouse",
    wasmSuites: ["wasm-next-input.test.ts"],
    typeScriptSuites: ["KempstonJoystick.test.ts", "KempstonMouse.test.ts"],
    requiredSemantics: ["Kempston joystick reads", "Mega Drive joystick reads", "Kempston mouse movement/buttons/wheel"]
  },
  {
    device: "expansion/multiface",
    wasmSuites: ["wasm-next-expansion-multiface.test.ts"],
    typeScriptSuites: ["ExpansionBusDevice.test.ts", "ExpansionBusNmi.test.ts", "MultifaceDevice.test.ts", "MultifaceMemory.test.ts"],
    requiredSemantics: ["expansion bus config", "NMI cause routing", "Multiface memory paging", "button state"]
  }
];

describe("ZX Spectrum Next WASM device completeness contract", () => {
  it("keeps every Step 22 device mapped to WASM coverage or an explicit TypeScript-owned boundary", () => {
    for (const coverage of DEVICE_COVERAGE) {
      expect(coverage.wasmSuites, coverage.device).not.toHaveLength(0);
      expect(coverage.typeScriptSuites, coverage.device).not.toHaveLength(0);
      expect(coverage.requiredSemantics, coverage.device).not.toHaveLength(0);

      for (const suite of coverage.wasmSuites) {
        expect(existsSync(resolve(__dirname, suite)), `${coverage.device} WASM suite ${suite}`).toBe(true);
      }
      for (const suite of coverage.typeScriptSuites) {
        expect(existsSync(resolve(__dirname, "../../zxnext", suite)), `${coverage.device} TypeScript suite ${suite}`).toBe(true);
      }
    }
  });

  it("documents host-owned boundaries instead of treating them as migrated WASM device state", () => {
    const hostOwned = DEVICE_COVERAGE.flatMap(coverage =>
      (coverage.typeScriptOwnedBoundaries ?? []).map(boundary => `${coverage.device}: ${boundary}`)
    );

    expect(hostOwned).toEqual(["floppy: disk image/media persistence", "floppy: host file handoff"]);
  });
});
