import { SpectrumEngine } from "./spectrum/SpectrumEngine";
import { MachineApi } from "../../src/native/api";
import { ZxSpectrum48 } from "../../src/native/ZxSpectrum48";

/**
 * Store the ZX Spectrum engine instance
 */
let _spectrumEngine: SpectrumEngine | null = null;

/**
 * Async loader
 */
let _loader: Promise<void> | null = null;

/**
 * Get the initialized ZX Spectrum engine
 */
export async function getSpectrumEngine(): Promise<SpectrumEngine> {
  if (!_spectrumEngine) {
    if (!_loader) {
      _loader = loadSpectrumEngine();
    }
    await _loader;
  }
  return _spectrumEngine;
}

/**
 * Load the WebAssembly ZX Spectrum engine
 */
export async function loadSpectrumEngine(): Promise<void> {
  const importObject = {
    imports: { trace: (arg: number) => console.log(arg) },
  };
  try {
    const response = await fetch("./wasm/spectrum.wasm");
    const results = await WebAssembly.instantiate(
      await response.arrayBuffer(),
      importObject
    );
    const waInst = results.instance;
    const spectrum = new ZxSpectrum48(waInst.exports as unknown as MachineApi);
    spectrum.setUlaIssue(3);
    spectrum.turnOnMachine();
    _spectrumEngine = new SpectrumEngine(spectrum);
  } catch (err) {
    console.log(err);
  }
}
