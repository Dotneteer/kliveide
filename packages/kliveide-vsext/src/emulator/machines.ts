import { ZxSpectrum48ViewProvider } from "./ZxSpectrum48ViewProvider";
import { ZxSpectrum128ViewProvider } from "./ZxSpectrum128ViewProvider";
import { Cz88ViewProvider } from "./Cz88ViewProvider";

/**
 * The type that represents available machine view providers
 */
export type MachineViewProvider =
  | ZxSpectrum48ViewProvider
  | ZxSpectrum128ViewProvider
  | Cz88ViewProvider;

/**
 * Creates a view provider for the specified machine type
 * @param type Machine type
 */
export function createMachineViewProvider(type: string): MachineViewProvider {
  switch (type) {
    case "48":
      return new ZxSpectrum48ViewProvider();
    case "128":
      return new ZxSpectrum128ViewProvider();
    case "cz88":
      return new Cz88ViewProvider();
    default:
      throw new Error(`Unknown machine type: ${type}`);
  }
}
