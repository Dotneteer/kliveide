import { existsSync, readFileSync } from "node:fs";

import {
  buildZxNextWasm,
  outputRelative,
  productionExports,
  productionOutput
} from "../../../scripts/build-zxnext-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM scaffold build", () => {
  it("exports the deterministic scaffold control surface", () => {
    expect(productionExports).toEqual(expect.arrayContaining([
      "memory",
      "zxnextMemoryPtr",
      "zxnextPixelBufferPtr",
      "zxnextKeyboardLinesPtr",
      "zxnextNextRegsPtr",
      "zxnextHardReset",
      "zxnextExecuteFrame",
      "zxnextReadMemory",
      "zxnextWriteMemory",
      "zxnextGetMemorySize",
      "zxnextGetScreenWidth",
      "zxnextGetScreenHeight",
      "zxnextGetCpuPc",
      "zxnextSetCpuPc",
      "zxnextGetDiagnosticFlags",
      "zxnextReadPhysicalMemory",
      "zxnextChecksumPhysicalMemory",
      "zxnextGetTapeMode",
      "zxnextGetUlaFlashFlag",
      "zxnextGetUlaScanlineForTact"
    ]));
    expect(outputRelative).toBe("src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
  });

  it("builds a valid production artifact", () => {
    buildZxNextWasm();

    expect(existsSync(productionOutput)).toBe(true);
    expect(Array.from(readFileSync(productionOutput).subarray(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);
  });
});
