import {
  BreakpointDefinition,
  BreakpointType,
} from "@shared/machines/api-data";

/**
 * Encapsulates the breakpoints functionality
 */
class BreakpointCollection {
  private _breakpoints: Record<string, BreakpointDefinition> = {};

  /**
   * Creates a breakpoint key for the specified address and mode
   * @param address Breakpoint address
   * @param mode Breakpoint mode
   */
  private keyOf(address: number, mode?: BreakpointType): string {
    return `${address}|${mode ?? "--"}`;
  }

  /**
   * Gets the key of the specified breakpoint definition
   * @param def
   */
  getKey(def: BreakpointDefinition): string {
    return this.keyOf(def.address, def.mode);
  }

  /**
   * Tests if the specified address has a breakpoint definition
   * @param address Breakpoint address
   * @param mode Breakpoint mode
   * @returns True, if the breakpoint definition exists in the collection
   */
  has(address: number, mode?: BreakpointType): boolean {
    return !!this._breakpoints[this.keyOf(address, mode)];
  }

  /**
   * Get the breakpoint definition for the specified address
   * @param address Breakpoint address
   * @param mode Breakpoint mode
   * @returns The breakpoint definition, if exists; otherwise, null
   */
  get(address: number, mode?: BreakpointType): BreakpointDefinition | null {
    return this._breakpoints[this.keyOf(address, mode)] ?? null;
  }

  /**
   * Removes all breakpoints from the collection
   */
  eraseAll(): void {
    this._breakpoints = {};
  }

  /**
   * Saves the specified breakpoint definition
   * @param def Breakpoint definition
   */
  set(def: BreakpointDefinition): void {
    this._breakpoints[this.keyOf(def.address, def.mode)] = def;
  }

  /**
   * Removes the definition of the specified breakpoint
   * @param address Breakpoint address
   * @param mode Breakpoint mode
   */
  remove(address: number, mode?: BreakpointType): void {
    delete this._breakpoints[this.keyOf(address, mode)];
  }

  /**
   * Converts the breakpoints into an array
   */
  toArray(): BreakpointDefinition[] {
    const array: BreakpointDefinition[] = [];
    for (let key in this._breakpoints) {
      array.push(this._breakpoints[key]);
    }
    return array;
  }

  /**
   * Converts the breakpoints into a sorted array
   */
  toSortedArray(): BreakpointDefinition[] {
    return this.toArray().sort((a, b) => {
      const diff = b.address - a.address;
      return diff !== 0 ? diff : (b.mode ?? "") > (a.mode ?? "") ? 1 : -1;
    });
  }
}

/**
 * The current Klive breakpoints
 */
export const breakpointDefinitions = new BreakpointCollection();
