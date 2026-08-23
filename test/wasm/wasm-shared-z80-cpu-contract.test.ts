import { describe, expect, it } from "vitest";

import {
  spectrumWasmCpuContract,
  validateWasmCpuContract
} from "../../scripts/check-wasm-cpu-contract.cjs";

describe("Spectrum WASM shared Z80/Z80N CPU contract", () => {
  it("requires every Spectrum WASM artifact to be built around the shared CPU source", () => {
    const report = validateWasmCpuContract();

    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.shared.relativePath).toBe("src/emu/z80/wasm/z80.c");
    expect(report.sharedSpectrumDevices.map(device => [device.id, device.relativePath, device.ok])).toEqual([
      ["ula", "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ula.c", true],
      ["keyboard", "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-keyboard.c", true],
      ["beeper", "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c", true],
      ["ports", "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ports.c", true],
      ["tape", "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-tape.c", true],
      ["psg", "src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c", true]
    ]);
    expect(report.models.map(model => [model.id, model.mode])).toEqual([
      ["sp48", "z80"],
      ["sp128", "z80"],
      ["spp3e", "z80"],
      ["zxnext", "z80n"]
    ]);
    for (const model of report.models) {
      expect(model.sharedCpuSource).toBe(report.shared.relativePath);
      expect(model.artifactBytes).toBeGreaterThan(0);
    }
    expect(report.models.find(model => model.id === "sp48")?.sharedDeviceIncludes).toEqual([
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ula.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-keyboard.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-beeper.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ports.c"',
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-tape.c"'
    ]);
    expect(report.models.find(model => model.id === "sp128")?.sharedDeviceIncludes).toContain(
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"'
    );
    expect(report.models.find(model => model.id === "sp128")?.sharedDeviceIncludes).toContain(
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ports.c"'
    );
    expect(report.models.find(model => model.id === "spp3e")?.sharedDeviceIncludes).toContain(
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-psg.c"'
    );
    expect(report.models.find(model => model.id === "spp3e")?.sharedDeviceIncludes).not.toContain(
      '#include "../../../zxSpectrum/wasm/common/zx-spectrum-ports.c"'
    );
  });

  it("keeps the contract list explicit so new Spectrum WASM models cannot appear silently", () => {
    expect(spectrumWasmCpuContract.map(entry => entry.id)).toEqual(["sp48", "sp128", "spp3e", "zxnext"]);
  });
});
