import { IMachineComponentProvider } from "./abstract-vm";

/**
 * Implements the engine dependency registry
 */
class EngineDependencyRegistry {
  private _registry = new Map<string, IMachineComponentProvider[]>();

  reset(): void {
    this._registry.clear();
  }

  /**
   * Registers a set of tools for the specified virtual machine
   * @param machineType Virtual machine identifier
   * @param component Tools object
   */
  registerComponentDependency(
    machineType: string,
    component: IMachineComponentProvider
  ): void {
    const components = this._registry.get(machineType);
    if (components) {
      components.push(component);
    } else {
      this._registry.set(machineType, [component]);
    }
  }

  /**
   * Gets the tools associated with a particular machine
   * @param machineType Virtual machine identifier
   * @param componentId ID of the tool to get
   * @returns Tools object, if registered with the machine; otherwise, undefined
   */
  getComponent(
    machineType: string,
    componentId: string
  ): IMachineComponentProvider | undefined {
    const components = this._registry.get(machineType);
    return components ? components.find((t) => t.id === componentId) : undefined;
  }
}

/**
 * The singleton instance of the engine dependency registry
 */
let engineDependencyRegistry: EngineDependencyRegistry;

/**
 * Gets the singleton instance of the engine dependency registry
 */
export function getEngineDependencyRegistry(): EngineDependencyRegistry {
  return (
    engineDependencyRegistry ??
    (engineDependencyRegistry = new EngineDependencyRegistry())
  );
}
