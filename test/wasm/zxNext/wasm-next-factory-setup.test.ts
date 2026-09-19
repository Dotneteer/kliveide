import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { createZxNextMachine } from "@emu/machines/zxNext/ZxNextMachineFactory";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { FileProvider } from "../../zxnext/FileProvider";

/*
 * The machine the app gets: created by the factory, its core loaded the way the renderer loads it
 * (`fetch` of the packaged artifact - served from disk here), then run through the public API.
 */
describe("ZX Spectrum Next WASM factory setup", () => {
  it("loads the core through fetch and runs a Z80N NEXTREG instruction", async () => {
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
      // --- NEXTREG $07,3 selects 28 MHz; bits 5-4 read back the speed in effect (zxnext.vhd ~5848-5849)
      expect((machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(0x07)).toBe(0x33);
      expect(machine.doReadPort(0x00fe)).toBeGreaterThanOrEqual(0);
      expect(machine.renderInstantScreen().length).toBe(machine.screenWidthInPixels * machine.screenHeightInPixels);
    } finally {
      restoreFetch();
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
