export type WasmCpuContractEntry = {
  id: string;
  label: string;
  mode: "z80" | "z80n";
  buildScript: string;
  buildEntrySource: string;
  cpuAdapterSource: string;
  artifact: string;
  include: string;
  sharedDeviceIncludes?: string[];
  forbiddenIncludeFragments?: string[];
  requiredExports: string[];
};

export type WasmCpuContractSourceReport = {
  path: string;
  relativePath: string;
  ok: boolean;
  errors: string[];
};

export type WasmCpuContractDeviceReport = WasmCpuContractSourceReport & { id: string };

export type WasmCpuContractModelReport = {
  id: string;
  label: string;
  mode: "z80" | "z80n";
  buildEntrySource: string;
  cpuAdapterSource: string;
  artifact: string;
  artifactBytes: number;
  sharedCpuSource: string;
  sharedDeviceIncludes: string[];
  forbiddenIncludeFragments: string[];
  ok: boolean;
  errors: string[];
};

export type WasmCpuContractReport = {
  shared: WasmCpuContractSourceReport;
  sharedSpectrumDevices: WasmCpuContractDeviceReport[];
  models: WasmCpuContractModelReport[];
  ok: boolean;
  errors: string[];
};

export const sharedCpuSource: string;
export const sharedSpectrumDeviceSources: Record<string, string>;
export const wasmCpuContract: WasmCpuContractEntry[];
export function validateWasmCpuContract(): WasmCpuContractReport;
export function checkWasmCpuContract(): WasmCpuContractReport;
