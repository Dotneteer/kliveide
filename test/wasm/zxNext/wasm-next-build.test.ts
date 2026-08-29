import { existsSync, readFileSync } from "node:fs";

import {
  buildZxNextWasm,
  outputRelative,
  productionExports,
  productionOutput,
  waitForZxNextWasmBuildLock
} from "../../../scripts/build-zxnext-wasm.cjs";
import { describe, expect, it } from "vitest";

describe("ZX Spectrum Next WASM build", () => {
  it("builds the production artifact with the speed-optimized profile by default", () => {
    const calls: Array<{ compiler: string; args: string[] }> = [];
    buildZxNextWasm({
      compiler: "fake-c-compiler",
      run: (compiler: string, args: string[]) => {
        calls.push({ compiler, args });
        return { status: 0 };
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain("-O3");
    expect(calls[0].args).toContain("-Wl,--strip-all");
    expect(calls[0].args).not.toContain("-Oz");
    expect(calls[0].args).toContain(productionOutput);
  });

  it("exports the deterministic WASM control surface", () => {
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
      "zxnextGetUlaScanlineForTact",
      "zxnextGetDivMmcAutoMapActive",
      "zxnextGetSdHostCommand",
      "zxnextSetSdReadResponse",
      "zxnextTraceGetStartOffset",
      "zxnextTraceSetEnabled",
      "zxnextTraceClear",
      "zxnextTraceFinishFrame"
    ]));
    expect(outputRelative).toBe("src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm");
  });

  it("builds a valid production artifact", () => {
    buildZxNextWasm();

    expect(existsSync(productionOutput)).toBe(true);
    waitForZxNextWasmBuildLock();
    expect(Array.from(readFileSync(productionOutput).subarray(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);
  });
});
