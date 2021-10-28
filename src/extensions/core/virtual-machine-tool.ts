/**
 * Represents a particular custom tool that can be registered with one or
 * more virtual machines
 */
export interface ICustomVmTool {
  /**
   * The identifier of a tool
   */
  readonly toolId: string;
}

/**
 * Represents the service that handles virtual machine tools
 */
class VirtualMachineToolsService {
  private _tools = new Map<string, ICustomVmTool[]>();

  /**
   * Registers a set of tools for the specified virtual machine
   * @param machineType Virtual machine identifier
   * @param tools Tools object
   */
  registerTools(machineType: string, tool: ICustomVmTool): void {
    const tools = this._tools.get(machineType);
    if (tools) {
      tools.push(tool);
    } else {
      this._tools.set(machineType, [tool]);
    }
  }

  /**
   * Gets the tools associated with a particular machine
   * @param machineType Virtual machine identifier
   * @param toolId ID of the tool to get
   * @returns Tools object, if registered with the machine; otherwise, undefined
   */
  getTool(machineType: string, toolId: string): ICustomVmTool | undefined {
    const tools = this._tools.get(machineType);
    return tools ? tools.find(t => t.toolId == toolId): undefined;
  }
}

/**
 * The singleton instance of the virtual machine tools service
 */
export const virtualMachineToolsService = new VirtualMachineToolsService();
