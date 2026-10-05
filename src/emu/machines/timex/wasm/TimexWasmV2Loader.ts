import type {
  Sp48WasmV2ExportFunction,
  Sp48WasmV2Exports,
  Sp48WasmV2LoaderOptions
} from "@emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader";

/*
 * The Timex core (`timex.c`) is the 48K machine built with the SCLD, so it carries every 48K export
 * under its `sp48` name and the 48K's loader validates and maps it. This file adds what is the
 * Timex's own: the artifact, its URL, and the `timex*` exports.
 */

export const TIMEX_WASM_V2_ARTIFACT_NAME = "zx-timex.wasm";

export type TimexWasmV2Exports = Sp48WasmV2Exports & {
  timexHardReset: Sp48WasmV2ExportFunction;
  timexGetModel: Sp48WasmV2ExportFunction;
  timexGetPortFf: Sp48WasmV2ExportFunction;
  timexSetPortFf: Sp48WasmV2ExportFunction;
  timexSetKempston: Sp48WasmV2ExportFunction;
  timexGetKempston: Sp48WasmV2ExportFunction;
  timexGetHiresBright: Sp48WasmV2ExportFunction;
  timexGetPortF4: Sp48WasmV2ExportFunction;
  timexSetPortF4: Sp48WasmV2ExportFunction;
  timexSetJoystick: Sp48WasmV2ExportFunction;
  timexUploadExromByte: Sp48WasmV2ExportFunction;
  timexExromPtr: Sp48WasmV2ExportFunction;
  timexGetExromLoaded: Sp48WasmV2ExportFunction;
  timexDockPtr: Sp48WasmV2ExportFunction;
  timexDockSetChunkType: Sp48WasmV2ExportFunction;
  timexDockGetChunkType: Sp48WasmV2ExportFunction;
  timexDockEject: Sp48WasmV2ExportFunction;
  timexGetChunkSource: Sp48WasmV2ExportFunction;
  timexGetPsgRegisterIndex: Sp48WasmV2ExportFunction;
  timexGetPsgRegisterValue: Sp48WasmV2ExportFunction;
  timexReadPsgRegisterValue: Sp48WasmV2ExportFunction;
  timexGetPsgToneA: Sp48WasmV2ExportFunction;
  timexGetPsgToneB: Sp48WasmV2ExportFunction;
  timexGetPsgToneC: Sp48WasmV2ExportFunction;
  timexGetPsgVolumeA: Sp48WasmV2ExportFunction;
  timexGetPsgVolumeB: Sp48WasmV2ExportFunction;
  timexGetPsgVolumeC: Sp48WasmV2ExportFunction;
  timexGetPsgCurrentOutput: Sp48WasmV2ExportFunction;
  timexGetHasAy: Sp48WasmV2ExportFunction;
  timexSetTapeTraps: Sp48WasmV2ExportFunction;
  timexGetTapeLoadTrap: Sp48WasmV2ExportFunction;
};

export const TIMEX_OWN_EXPORTS = [
  "timexHardReset",
  "timexGetModel",
  "timexGetPortFf",
  "timexSetPortFf",
  "timexSetKempston",
  "timexGetKempston",
  "timexGetHiresBright",
  "timexGetPortF4",
  "timexSetPortF4",
  "timexSetJoystick",
  "timexUploadExromByte",
  "timexExromPtr",
  "timexGetExromLoaded",
  "timexDockPtr",
  "timexDockSetChunkType",
  "timexDockGetChunkType",
  "timexDockEject",
  "timexGetChunkSource",
  "timexGetPsgRegisterIndex",
  "timexGetPsgRegisterValue",
  "timexReadPsgRegisterValue",
  "timexGetPsgToneA",
  "timexGetPsgToneB",
  "timexGetPsgToneC",
  "timexGetPsgVolumeA",
  "timexGetPsgVolumeB",
  "timexGetPsgVolumeC",
  "timexGetPsgCurrentOutput",
  "timexGetHasAy",
  "timexSetTapeTraps",
  "timexGetTapeLoadTrap"
] as const;

/** Throws when a core lacks one of the Timex's own exports (the 48K loader checks the rest) */
export function validateTimexOwnExports(exports: Partial<TimexWasmV2Exports>, artifactName: string): void {
  for (const name of TIMEX_OWN_EXPORTS) {
    if (typeof exports[name] !== "function") {
      throw new Error(`Timex WASM artifact '${artifactName}' is missing export '${name}'.`);
    }
  }
}

/** The loader options that load the Timex core through the 48K's loader */
export function timexLoaderOptions(options: Sp48WasmV2LoaderOptions = {}): Sp48WasmV2LoaderOptions {
  const artifactName = options.artifactName ?? TIMEX_WASM_V2_ARTIFACT_NAME;
  return {
    ...options,
    artifactName,
    readArtifact: options.readArtifact ?? (() => readTimexArtifact(artifactName))
  };
}

async function readTimexArtifact(artifactName: string): Promise<ArrayBuffer> {
  // --- Vite's dynamic asset URL pattern; a production build content-hashes the file name
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  let response: Response;
  try {
    response = await fetch(artifactUrl);
  } catch (err) {
    throw new Error(
      `Cannot load Timex WASM artifact '${artifactName}' from ${artifactUrl.toString()}: ` +
        `${err instanceof Error ? err.message : String(err)}. The packaged app may be missing its compiled WASM binaries.`
    );
  }
  if (!response.ok) {
    throw new Error(
      `Cannot load Timex WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`
    );
  }
  return response.arrayBuffer();
}
