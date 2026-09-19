import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { FileProvider } from "../../zxnext/FileProvider";

type MatrixReason =
  | "wasm-suite"
  | "typescript-owned-host-boundary"
  | "ui-or-factory-boundary"
  | "legacy-typescript-harness";

type MatrixEntry = {
  category: string;
  requiredDomain: Step24Domain;
  typeScriptTests: string[];
  wasmSuites: string[];
  reason: MatrixReason;
  note?: string;
};

type Step24Domain =
  | "debugger"
  | "memory"
  | "NextReg"
  | "ports"
  | "screen"
  | "audio"
  | "storage"
  | "DMA"
  | "fdc trap"
  | "input"
  | "expansion"
  | "NMI/interrupt"
  | "boot";

const REQUIRED_DOMAINS: Step24Domain[] = [
  "debugger",
  "memory",
  "NextReg",
  "ports",
  "screen",
  "audio",
  "storage",
  "DMA",
  "fdc trap",
  "input",
  "expansion",
  "NMI/interrupt",
  "boot"
];

const MATRIX: MatrixEntry[] = [
  {
    category: "boot/debug/factory",
    requiredDomain: "boot",
    typeScriptTests: ["ZxNextMachineFactory.test.ts"],
    wasmSuites: [
      "wasm-next-rollout.test.ts",
      "wasm-next-public-adapter.test.ts",
      "wasm-next-debug-step.test.ts",
      "wasm-next-start-menu.test.ts",
      "wasm-next-full-boot.test.ts",
      "wasm-next-shared-z80n-cpu.test.ts"
    ],
    reason: "ui-or-factory-boundary",
    note: "Factory and debugger behavior is covered by WASM factory smoke and dedicated WASM adapter suites."
  },
  {
    category: "memory/mmu",
    requiredDomain: "memory",
    typeScriptTests: ["MemoryDevice.test.ts"],
    wasmSuites: ["wasm-next-memory-mmu.test.ts", "wasm-next-partition-labels.test.ts"],
    reason: "wasm-suite",
    note:
      "`allRamBanksFor`, which both machines call, is a pure function of the stored $1FFD value in " +
      "the neutral `nextMemoryLayout.ts`; test/zxnext-shared/nextMemoryLayout.test.ts covers it."
  },
  {
    category: "NextReg/palette",
    requiredDomain: "NextReg",
    typeScriptTests: ["NextRegDevice.test.ts"],
    wasmSuites: ["wasm-next-nextreg.test.ts", "wasm-next-palette-ulaplus.test.ts"],
    reason: "typescript-owned-host-boundary",
    note:
      "Device and NextReg palette behaviour is covered in WASM. test/zxnext-shared/palette-codec.test.ts is not: it " +
      "pins the two bit layouts the *host* moves a palette entry around in (the register packing " +
      "versus PaletteDevice's straight 9 bits) and the 3-bit to 8-bit component ramp the renderer " +
      "expands them with. None of that crosses into the emulated machine — the WASM core never " +
      "sees a CSS string or an ABRG word."
  },
  {
    category: "ports",
    requiredDomain: "ports",
    typeScriptTests: ["NextIoPortManager.test.ts", "PortEnableGating.test.ts"],
    wasmSuites: ["wasm-next-ports.test.ts", "wasm-next-keyboard-ula.test.ts"],
    reason: "wasm-suite"
  },
  {
    category: "screen/video",
    requiredDomain: "screen",
    typeScriptTests: [
      "CopperDevice.test.ts",
      "Layer2Fixes.test.ts",
      "NextComposedScreenDevice.test.ts",
      "SpriteDevice-anchor.test.ts",
      "SpriteDevice-clip.test.ts",
      "SpriteDevice-collision.test.ts",
      "SpriteDevice-d4d6d7.test.ts",
      "SpriteDevice-dimensions.test.ts",
      "SpriteDevice-fpga.test.ts",
      "SpriteDevice-index.test.ts",
      "SpriteDevice-patterns.test.ts",
      "SpriteDevice-resolve.test.ts",
      "SpriteDevice-status.test.ts",
      "SpriteDevice.test.ts",
      "TilemapDevice-d1d2.test.ts",
      "UlaDisableFallback.test.ts",
      "UlaRendering.test.ts",
      "ula-rendering.test.ts"
    ],
    wasmSuites: [
      "wasm-next-copper.test.ts",
      "wasm-next-layer2-lores.test.ts",
      "wasm-next-screen-composition.test.ts",
      "wasm-next-screen-ula.test.ts",
      "wasm-next-sprites.test.ts",
      "wasm-next-sprites-fpga.test.ts",
      "wasm-next-sprites-collision.test.ts",
      "wasm-next-tilemap.test.ts",
      "wasm-next-visual-smoke.test.ts"
    ],
    reason: "wasm-suite"
  },
  {
    category: "audio",
    requiredDomain: "audio",
    typeScriptTests: [],
    wasmSuites: [
      "wasm-next-audio-mixer.test.ts",
      "wasm-next-beeper-audio.test.ts",
      "wasm-next-dac-audio.test.ts",
      "wasm-next-psg-audio.test.ts"
    ],
    reason: "wasm-suite"
  },
  {
    category: "storage",
    requiredDomain: "storage",
    typeScriptTests: ["DivMmcDevice-fpga.test.ts", "DivMmcDevice-regression.test.ts", "DivMmmc.test.ts", "SdCardDevice.test.ts"],
    wasmSuites: ["wasm-next-divmmc.test.ts", "wasm-next-sd-spi.test.ts", "wasm-next-storage-commands.test.ts"],
    reason: "typescript-owned-host-boundary",
    note: "SD card sector persistence and host file access remain TypeScript-owned; command/port/device state is covered in WASM."
  },
  {
    category: "DMA",
    requiredDomain: "DMA",
    typeScriptTests: [],
    wasmSuites: ["wasm-next-dma.test.ts"],
    reason: "wasm-suite"
  },
  {
    category: "fdc trap",
    requiredDomain: "fdc trap",
    // --- The Next has no uPD765 (neither core models one any more): $2FFD/$3FFD are the $D8 I/O trap
    // --- only, tested on both cores in test/zxnext-hw/fdc. The +3's uPD765 is tested in test/disk.
    typeScriptTests: [],
    wasmSuites: ["../../zxnext-hw/fdc/fdc-trap.test.ts"],
    reason: "wasm-suite"
  },
  {
    category: "input",
    requiredDomain: "input",
    // --- The joysticks and the mouse run on both cores in test/zxnext-hw/joystick and test/zxnext-hw/mouse
    // --- (they replaced KempstonJoystick.test.ts and KempstonMouse.test.ts)
    typeScriptTests: [],
    wasmSuites: ["wasm-next-keyboard-ula.test.ts"],
    reason: "wasm-suite"
  },
  {
    category: "input/keystroke queue",
    requiredDomain: "input",
    typeScriptTests: ["KeystrokeQueue.test.ts"],
    wasmSuites: ["wasm-next-input.test.ts", "wasm-next-keyboard-ula.test.ts"],
    reason: "typescript-owned-host-boundary",
    note:
      "The emulated keystroke queue is TypeScript-owned: `queueKeystroke`/`emulateKeystroke` and " +
      "the `emulatedKeyStrokes` list live in the machine class, and only the resulting key rows " +
      "are pushed into the core by `syncKeyboardToWasmV2`. The WASM suites cover the row state " +
      "that arrives; KeystrokeQueue.test.ts covers the scheduling that produces it, and " +
      "test/zxnext-shared/nextKeyCodes.test.ts the ASCII-to-key-code mapping."
  },
  {
    category: "expansion/multiface",
    requiredDomain: "expansion",
    typeScriptTests: ["ExpansionBusDevice.test.ts", "ExpansionBusNmi.test.ts", "MultifaceDevice.test.ts", "MultifaceMemory.test.ts"],
    wasmSuites: ["wasm-next-expansion-multiface.test.ts"],
    reason: "typescript-owned-host-boundary",
    note: "Multiface ROM/UI/media ownership remains TypeScript-owned; expansion signal and paging control is covered in WASM."
  },
  {
    category: "interrupt/NMI",
    requiredDomain: "NMI/interrupt",
    typeScriptTests: [
      "CtcDevice.test.ts",
      "InterruptDevice.test.ts",
      "NmiSoftware.test.ts",
      "NmiStateMachine.test.ts"
    ],
    // --- The UART and I2C run on both cores in test/zxnext-hw/uart and test/zxnext-hw/i2c
    wasmSuites: ["wasm-next-ctc.test.ts", "wasm-next-interrupts.test.ts", "wasm-next-nmi.test.ts"],
    reason: "wasm-suite"
  },
  {
    category: "debugger",
    requiredDomain: "debugger",
    typeScriptTests: [],
    wasmSuites: ["wasm-next-debug-step.test.ts", "wasm-next-debug-tools-scaffold.test.ts", "wasm-next-public-adapter.test.ts"],
    reason: "wasm-suite"
  }
];

describe("ZX Spectrum Next WASM full matrix", () => {
  it("creates a factory WASM machine and exercises representative public Next surfaces", async () => {
    const machine = createZxNextMachine(undefined, { zxnextImplementation: "wasm" } as any);
    expect(machine).toBeInstanceOf(ZxNextWasmV2Machine);
    machine.setMachineProperty(FILE_PROVIDER, new FileProvider());
    const restoreFetch = installFileFetchForFactoryWasmSetup();
    try {
      await machine.setup();
      machine.hardReset();

      machine.doWriteMemory(0x8000, 0xed);
      machine.doWriteMemory(0x8001, 0x91);
      machine.doWriteMemory(0x8002, 0x07);
      machine.doWriteMemory(0x8003, 0x03);
      machine.pc = 0x8000;
      (machine as ZxNextWasmV2Machine).executeWasmV2Instruction();

      expect(machine.doReadMemory(0x8000)).toBe(0xed);
      expect((machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(0x07)).toBe(0x33);
      expect(machine.doReadPort(0x00fe)).toBeGreaterThanOrEqual(0);
      expect(machine.renderInstantScreen().length).toBe(machine.screenWidthInPixels * machine.screenHeightInPixels);
    } finally {
      restoreFetch();
    }
  });

  it("accounts for every TypeScript ZX Next test suite in the WASM matrix", () => {
    const actualTypeScriptTests = readdirSync(resolve(__dirname, "../../zxnext"))
      .filter(file => file.endsWith(".test.ts"))
      .sort();
    const accountedTests = [...new Set(MATRIX.flatMap(entry => entry.typeScriptTests))].sort();

    expect(accountedTests).toEqual(actualTypeScriptTests);
  });

  it("covers every Step 24 required domain with at least one runnable WASM suite", () => {
    for (const domain of REQUIRED_DOMAINS) {
      const entries = MATRIX.filter(entry => entry.requiredDomain === domain);
      expect(entries, domain).not.toHaveLength(0);
      expect(entries.flatMap(entry => entry.wasmSuites), domain).not.toHaveLength(0);
    }
  });

  it("classifies all non-directly-imported TypeScript suites with an explicit reason", () => {
    for (const entry of MATRIX) {
      expect(entry.reason, entry.category).toMatch(/^(wasm-suite|typescript-owned-host-boundary|ui-or-factory-boundary|legacy-typescript-harness)$/);
      if (entry.reason !== "wasm-suite") {
        expect(entry.note, entry.category).toBeTruthy();
      }
    }
  });
});

function installFileFetchForFactoryWasmSetup(): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = input instanceof URL ? input : new URL(String(input));
    if (url.protocol === "file:") {
      return new Response(readFileSync(fileURLToPath(url)));
    }
    return originalFetch(input as any);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}
