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
    // --- the hardware-interface tests of test/zxnext-hw/dma run on both cores (they replaced the mocks)
    typeScriptSuites: ["../zxnext-hw/dma/dma.test.ts"],
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
    // --- The Next has no uPD765 (zxnext.vhd decodes $2FFD/$3FFD only for the $D8 I/O trap); the
    // --- hardware-interface tests of test/zxnext-hw/fdc run on both cores
    device: "+3 FDC I/O trap",
    wasmSuites: ["../../zxnext-hw/fdc/fdc-trap.test.ts"],
    typeScriptSuites: ["../zxnext-hw/fdc/fdc-trap.test.ts"],
    requiredSemantics: ["$D8 decode", "trap cause and written value", "no uPD765 on the Next"]
  },
  {
    device: "CTC",
    wasmSuites: ["wasm-next-ctc.test.ts"],
    typeScriptSuites: ["CtcDevice.test.ts"],
    requiredSemantics: ["control register", "time constant", "timer/counter clocking", "interrupt enable"]
  },
  {
    device: "UART",
    // --- the hardware-interface tests of test/zxnext-hw/uart run on both cores (they replaced the mocks)
    wasmSuites: ["../../zxnext-hw/uart/uart.test.ts"],
    typeScriptSuites: ["../zxnext-hw/uart/uart.test.ts"],
    requiredSemantics: ["UART FIFOs", "UART status", "UART channel selection", "UART timing", "UART interrupts"]
  },
  {
    device: "I2C / DS1307",
    // --- the hardware-interface tests of test/zxnext-hw/i2c run on both cores (they replaced the mocks)
    wasmSuites: ["../../zxnext-hw/i2c/i2c-rtc.test.ts"],
    typeScriptSuites: ["../zxnext-hw/i2c/i2c-rtc.test.ts", "../zxnext-shared/nextRtc.test.ts"],
    requiredSemantics: ["I2C SCL/SDA state", "DS1307 protocol", "DS1307 clock", "DS1307 RAM"]
  },
  {
    device: "joystick",
    // --- the hardware-interface tests of test/zxnext-hw/joystick run on both cores (they replaced the mocks)
    wasmSuites: ["../../zxnext-hw/joystick/joystick.test.ts"],
    typeScriptSuites: ["../zxnext-hw/joystick/joystick.test.ts"],
    requiredSemantics: ["Kempston joystick reads", "Mega Drive joystick reads", "key joystick", "joystick I/O mode"]
  },
  {
    device: "mouse",
    // --- the hardware-interface tests of test/zxnext-hw/mouse run on both cores (they replaced the mocks)
    wasmSuites: ["../../zxnext-hw/mouse/mouse.test.ts"],
    typeScriptSuites: ["../zxnext-hw/mouse/mouse.test.ts"],
    requiredSemantics: ["Kempston mouse movement/buttons/wheel", "mouse DPI and button reverse"]
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

    // --- The Next's only host-owned media is the SD card (processFrameCommand); it had a floppy entry
    // --- while a uPD765 the hardware does not have was modelled on it
    expect(hostOwned).toEqual([]);
  });
});
