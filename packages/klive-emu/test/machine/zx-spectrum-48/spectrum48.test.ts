import "mocha";
import * as expect from "expect";
import { DefaultZxSpectrumStateManager, loadWaModule, SilentAudioRenderer } from "../helpers";
import { setEngineDependencies } from "../../../src/renderer/machines/vm-engine-dependencies";
import { ZxSpectrum48Core } from "../../../src/renderer/machines/spectrum/ZxSpectrum48Core";
import { EmulationMode, ExecuteCycleOptions } from "../../../src/renderer/machines/vm-core-types";
import { SpectrumMachineStateBase } from "../../../src/renderer/machines/spectrum/ZxSpectrumCoreBase";

let machine: ZxSpectrum48Core;

// --- Set up the virual machine engine service with the 
setEngineDependencies({
  waModuleLoader: (n) => loadWaModule(n),
  sampleRateGetter: () => 48000,
  audioRendererFactory: () => new SilentAudioRenderer(),
  spectrumStateManager: new DefaultZxSpectrumStateManager(),
})

describe("ZX Spectrum 48", () => {
  before(async () => {
    machine = new ZxSpectrum48Core({
      baseClockFrequency: 3_276_800,
      tactsInFrame: 16384,
      firmware: [new Uint8Array(32768)],
    });
    await machine.setupMachine();
  });

  beforeEach(async () => {
    await machine.setupMachine();
  });

  it("Reset", () => {
    machine.reset();
  });

  it("Default ULA issue to 3", () => {
    const s = machine.getMachineState() as SpectrumMachineStateBase;
    expect(s.ulaIssue).toBe(3);
  });

  it("Set ULA issue to 2", () => {
    machine.api.setUlaIssue(2);
    const s = machine.getMachineState() as SpectrumMachineStateBase;
    expect(s.ulaIssue).toBe(2);
  });

  it("Machine configured", () => {
    const s = machine.getMachineState() as SpectrumMachineStateBase;
    expect(s.baseClockFrequency).toBe(3_500_000);
    expect(s.clockMultiplier).toBe(1);

    expect(s.numberOfRoms).toBe(1);

    expect(s.interruptTact).toBe(11);
    expect(s.verticalSyncLines).toBe(8);
    expect(s.nonVisibleBorderTopLines).toBe(8);
    expect(s.borderTopLines).toBe(48);
    expect(s.borderBottomLines).toBe(48);
    expect(s.nonVisibleBorderBottomLines).toBe(8);
    expect(s.displayLines).toBe(192);
    expect(s.borderLeftTime).toBe(24);
    expect(s.borderRightTime).toBe(24);
    expect(s.displayLineTime).toBe(128);
    expect(s.horizontalBlankingTime).toBe(40);
    expect(s.nonVisibleBorderRightTime).toBe(8);
    expect(s.pixelDataPrefetchTime).toBe(2);
    expect(s.attributeDataPrefetchTime).toBe(1);

    expect(s.screenHeight).toBe(288);
    expect(s.firstDisplayLine).toBe(64);
    expect(s.borderLeftPixels).toBe(48);
    expect(s.borderRightPixels).toBe(48);
    expect(s.displayWidth).toBe(256);
    expect(s.screenWidth).toBe(352);
    expect(s.screenLineTime).toBe(224);
    expect(s.rasterLines).toBe(312);
    expect(s.tactsInFrame).toBe(69888);
    expect(s.firstDisplayPixelTact).toBe(14360);
    expect(s.firstScreenPixelTact).toBe(3584);
  });

  it("ExecuteCycle", () => {
    const options: ExecuteCycleOptions = new ExecuteCycleOptions(
      EmulationMode.UntilFrameEnds
    );
    const start = Date.now().valueOf();
    for (let i = 0; i < 100; i++) {
      machine.executeFrame(options);
    }
    console.log(Date.now().valueOf() - start);
  });

  it("Key status", () => {
    for (let i = 0; i < 40; i++) {
      machine.setKeyStatus(i, true);
      expect(machine.api.getKeyStatus(i)).not.toBe(0);
      machine.setKeyStatus(i, false);
      expect(machine.api.getKeyStatus(i)).toBe(0);
    }
  });
});
