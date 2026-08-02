import {
  SP48_WASM_ABI_VERSION,
  SP48_WASM_ARTIFACT_NAME,
  SP48_WASM_LAYOUT,
  SP48_WASM_LAYOUT_VALUE_ID,
  type Sp48WasmLayoutValueKey
} from "./sp48-wasm-layout.generated";

export type Sp48WasmExportFunction = (...args: number[]) => number;

export type Sp48WasmExports = WebAssembly.Exports & {
  memory: WebAssembly.Memory;
  sp48_abi_version: Sp48WasmExportFunction;
  sp48_layout_value: Sp48WasmExportFunction;
};

export type Sp48WasmInstance = {
  readonly exports: Sp48WasmExports;
};

export type Sp48WasmArtifactReader = () => Promise<BufferSource>;
export type Sp48WasmCompiler = (bytes: BufferSource) => Promise<WebAssembly.Module>;
export type Sp48WasmInstantiator = (module: WebAssembly.Module) => Promise<Sp48WasmInstance>;

export type Sp48WasmLoaderOptions = {
  readonly artifactName?: string;
  readonly readArtifact?: Sp48WasmArtifactReader;
  readonly compile?: Sp48WasmCompiler;
  readonly instantiate?: Sp48WasmInstantiator;
};

export type Sp48WasmRuntime = {
  readonly artifactName: string;
  readonly module: WebAssembly.Module;
  readonly instance: Sp48WasmInstance;
  readonly exports: Sp48WasmExports;
};

let cachedModule: WebAssembly.Module | undefined;
let cachedArtifactName: string | undefined;

export function resetSp48WasmModuleCache(): void {
  cachedModule = undefined;
  cachedArtifactName = undefined;
}

export async function loadSp48Wasm(options: Sp48WasmLoaderOptions = {}): Promise<Sp48WasmRuntime> {
  const artifactName = options.artifactName ?? SP48_WASM_ARTIFACT_NAME;
  const module = await getCompiledModule(artifactName, options);
  const instantiate = options.instantiate ?? defaultInstantiate;
  const instance = await instantiate(module);
  const wasmExports = instance.exports;

  validateSp48WasmExports(wasmExports, artifactName);
  return { artifactName, module, instance, exports: wasmExports };
}

export function validateSp48WasmExports(exports: Sp48WasmExports, artifactName = SP48_WASM_ARTIFACT_NAME): void {
  const abiVersion = exports.sp48_abi_version?.();
  if (abiVersion !== SP48_WASM_ABI_VERSION) {
    throw new Error(
      `ZX Spectrum 48K WASM artifact '${artifactName}' has ABI version ${abiVersion ?? "unknown"}; expected ${SP48_WASM_ABI_VERSION}.`
    );
  }

  for (const key of Object.keys(SP48_WASM_LAYOUT_VALUE_ID) as Sp48WasmLayoutValueKey[]) {
    const actual = exports.sp48_layout_value(SP48_WASM_LAYOUT_VALUE_ID[key]);
    const expected = SP48_WASM_LAYOUT[key];
    if (actual !== expected) {
      throw new Error(
        `ZX Spectrum 48K WASM artifact '${artifactName}' layout mismatch for ${key}: got ${actual}, expected ${expected}.`
      );
    }
  }
}

async function getCompiledModule(artifactName: string, options: Sp48WasmLoaderOptions): Promise<WebAssembly.Module> {
  if (cachedModule != null && cachedArtifactName === artifactName) {
    return cachedModule;
  }

  const readArtifact = options.readArtifact ?? (() => defaultReadArtifact(artifactName));
  const compile = options.compile ?? WebAssembly.compile;
  const bytes = await readArtifact();
  const module = await compile(bytes);

  cachedModule = module;
  cachedArtifactName = artifactName;
  return module;
}

async function defaultReadArtifact(artifactName: string): Promise<ArrayBuffer> {
  const artifactUrl = new URL(`./dist/${artifactName}`, import.meta.url);
  const response = await fetch(artifactUrl);
  if (!response.ok) {
    throw new Error(`Cannot load ZX Spectrum 48K WASM artifact from ${artifactUrl.toString()} (${response.status} ${response.statusText}).`);
  }
  return response.arrayBuffer();
}

async function defaultInstantiate(module: WebAssembly.Module): Promise<Sp48WasmInstance> {
  const instance = await WebAssembly.instantiate(module, {});
  return { exports: instance.exports as Sp48WasmExports };
}
