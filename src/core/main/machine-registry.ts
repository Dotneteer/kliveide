import { RegisteredMachine } from "@state/AppState";
import { MachineContextProvider } from "./machine-context";
import {
  ZxSpectrum128ContextProvider,
  ZxSpectrum48ContextProvider,
  ZxSpectrumP3ContextProvider,
} from "./zx-spectrum-context";
import { Cz88ContextProvider } from "./cz88-context";
import { dispatch } from "@core/service-registry";
import { registerMachineTypeAction } from "@core/state/machines-reducer";

type ProviderConstructor = new (
  options?: Record<string, any>
) => MachineContextProvider;

/**
 * Holds the registry of virtual machine context providers
 */
export const machineRegistry = new Map<string, MachineInfo>();

/**
 * Get the identifiers of registered machines
 * @returns
 */
export function getRegisteredMachines(): RegisteredMachine[] {
  const result: RegisteredMachine[] = [];
  for (var entry of machineRegistry.values()) {
    result.push({
      id: entry.id,
      label: entry.label,
    });
  }
  return result;
}

function registerMachine(
  id: string,
  label: string,
  provider: ProviderConstructor
): void {
  machineRegistry.set(id, {
    id,
    label,
    implementor: provider,
  });
  dispatch(
    registerMachineTypeAction({
      id,
      label,
    })
  );
}

/**
 * Machine information to use to register the virtual machine types
 */
type MachineInfo = {
  id: string;
  label: string;
  implementor: ProviderConstructor;
};

// ============================================================================
// Register supported machines
registerMachine("sp48", "ZX Spectrum 48", ZxSpectrum48ContextProvider);
registerMachine("sp128", "ZX Spectrum 128", ZxSpectrum128ContextProvider);
registerMachine(
  "spP3e",
  "ZX Spectrum +3E (in progress)",
  ZxSpectrumP3ContextProvider
);
registerMachine("cz88", "Cambridge Z88 (in progress)", Cz88ContextProvider);
