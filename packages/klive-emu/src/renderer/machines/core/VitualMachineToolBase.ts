import { ICustomDisassembler } from "@shared/z80/disassembler/custom-disassembly";

/**
 * This class represent tools associated with a particular virtual machine
 */
export abstract class VirtualMachineToolBase {
  /**
   * The virtual machine can provide its custom disassember
   * @returns The custom disassebler, if supported; otherwise, null
   */
  abstract provideCustomDisassembler(): ICustomDisassembler | null;
}

/**
 * Represents the service that handles virtual machine tools
 */
class VirtualMachineToolsService {
  private _tools = new Map<string, VirtualMachineToolBase>();

  /**
   * Registers a set of tools for the specified virtual machine
   * @param machineType Virtual machine identifier
   * @param tools Tools object
   */
  registerTools(machineType: string, tools: VirtualMachineToolBase): void {
    this._tools.set(machineType, tools);
  }

  /**
   * Gets the tools associated with a particular machine
   * @param machineType Virtual machine identifier
   * @returns Tools object, if registered with the machine; otherwise, undefined
   */
  getTools(machineType: string): VirtualMachineToolBase | undefined {
    return this._tools.get(machineType);
  }
}

/**
 * The singleton instance of the virtual machine tools service
 */
export const virtualMachineToolsService = new VirtualMachineToolsService();
