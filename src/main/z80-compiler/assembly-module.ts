import {
  IAssemblySymbolInfo,
  IMacroDefinition,
  IStructDefinition,
  IValueInfo,
  TypedObject
} from "@main/compiler-common/abstractions";
import type { ISymbolScope, SymbolInfoMap, SymbolScope } from "./assembly-symbols";

import { ExpressionValue } from "./expressions";
import { FixupEntry } from "../compiler-common/fixups";
import { CommonTokenType } from "@main/compiler-common/common-tokens";

/**
 * This class represents an assembly module that my contain child
 * modules and symbols.
 */
export class AssemblyModule<TInstruction extends TypedObject, TToken extends CommonTokenType>
  implements ISymbolScope<TInstruction, TToken>
{
  constructor(
    public readonly parentModule: AssemblyModule<TInstruction, TToken> | null,
    private readonly caseSensitive: boolean
  ) {}

  /**
   * Gets the root (global) module
   */
  get rootModule(): AssemblyModule<TInstruction, TToken> {
    return this.parentModule === null ? this : this.parentModule.rootModule;
  }

  /**
   * Child modules within this module
   */
  readonly nestedModules: Record<string, AssemblyModule<TInstruction, TToken>> = {};

  /**
   * The symbol table with properly defined symbols
   */
  readonly symbols: SymbolInfoMap = {};

  /**
   * The map of structures within the module
   */
  readonly structs: Record<string, IStructDefinition> = {};

  /**
   * The map of macro definitions within the module
   */
  readonly macros: Record<string, IMacroDefinition<TInstruction>> = {};

  /**
   *  The list of fixups to resolve in the last phase of the compilation
   */
  readonly fixups: FixupEntry<TInstruction, TToken>[] = [];

  /**
   * Local symbol scopes
   */
  readonly localScopes: SymbolScope<TInstruction, TToken>[] = [];

  /**
   * Adds a symbol to this scope
   * @param name Symbol name
   * @param symbol Symbol data
   */
  addSymbol(name: string, symbol: IAssemblySymbolInfo): void {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    this.symbols[name] = symbol;
  }

  /**
   * Tests if the specified symbol has been defined
   */
  containsSymbol(name: string): boolean {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return !!this.symbols[name];
  }

  /**
   * Gets the specified symbol
   * @param name Symbol name
   * @returns The symbol information, if found; otherwise, undefined.
   */
  getSymbol(name: string): IAssemblySymbolInfo | undefined {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return this.symbols[name];
  }

  /**
   * Adds a struct definition to this scope
   * @param name Struct name
   * @param struct Struct data
   */
  addStruct(name: string, struct: IStructDefinition): void {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    this.structs[name] = struct;
  }

  /**
   * Tests if the specified struct has been defined
   */
  containsStruct(name: string): boolean {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return !!this.structs[name];
  }

  /**
   * Gets the specified struct
   * @param name Struct name
   * @returns The struct information, if found; otherwise, undefined.
   */
  getStruct(name: string): IStructDefinition | undefined {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return this.structs[name];
  }

  /**
   * Adds a macro to this scope
   * @param name Macro name
   * @param macro Macro data
   */
  addMacro(name: string, macro: IMacroDefinition<TInstruction>): void {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    this.macros[name] = macro;
  }

  /**
   * Tests if the specified macro has been defined
   */
  containsMacro(name: string): boolean {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return !!this.macros[name] || this.parentModule?.containsMacro(name) === true;
  }

  /**
   * Gets the specified macro definition
   * @param name Macro name
   * @returns The macro information, if found; otherwise, undefined.
   */
  getMacro(name: string): IMacroDefinition<TInstruction> | undefined {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return this.macros[name] ?? this.parentModule?.getMacro(name);
  }

  /**
   * Adds a nested module
   * @param name Module name
   * @param module Module data
   */
  addNestedModule(name: string, module: AssemblyModule<TInstruction, TToken>): void {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    this.nestedModules[name] = module;
  }

  /**
   * Tests if the specified nested module has been defined
   */
  containsNestedModule(name: string): boolean {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return !!this.nestedModules[name];
  }

  /**
   * Gets the specified nested module
   * @param name Module name
   * @returns The module information, if found; otherwise, undefined.
   */
  getNestedModule(name: string): AssemblyModule<TInstruction, TToken> | undefined {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return this.nestedModules[name];
  }

  /**
   * Resolves a simple symbol (symbol with a simple name)
   * @param symbol Symbol name
   * @returns Null, if the symbol cannot be found; otherwise, the symbols value and usage
   * information
   */
  resolveSimpleSymbol(symbol: string): IValueInfo | null {
    // --- Iterate through all modules from the innermost to the outermost
    let currentModule: AssemblyModule<TInstruction, TToken> | null = this;
    while (currentModule) {
      const valueFound = resolveInModule(currentModule, symbol);
      if (valueFound) {
        return valueFound;
      }
      currentModule = currentModule.parentModule;
    }

    // --- The symbol has not been found
    return null;

    // --- Checks the specified module for a symbol
    function resolveInModule(
      module: AssemblyModule<TInstruction, TToken>,
      symb: string
    ): IValueInfo | null {
      // --- Check the local scope in stack order
      for (let i = module.localScopes.length - 1; i >= 0; i--) {
        const scope = module.localScopes[i];
        const localSymbolValue = scope.getSymbol(symb);
        if (localSymbolValue) {
          return {
            value: localSymbolValue.value,
            usageInfo: localSymbolValue
          };
        }
        if (scope.containsLocalBooking(symb)) {
          return null;
        }
      }

      // --- Check the global scope
      const symbolValue = module.getSymbol(symb);
      return symbolValue ? { value: symbolValue.value, usageInfo: symbolValue } : null;
    }
  }

  resolveCompoundSymbol(fullSymbol: string, startFromGlobal: boolean): IValueInfo | null {
    const symbolParts = fullSymbol.split(".");
    let symbol = symbolParts[0];
    const scopeSymbolNames = symbolParts.length > 0 ? symbolParts.slice(1) : [];
    const symbolSegments: string[] = [symbol];
    symbolSegments.push(...scopeSymbolNames);

    // --- Determine the module to start from
    let module = startFromGlobal ? this.rootModule : this;
    let structFound: IStructDefinition | null = null;

    // --- Iterate through segments
    for (let i = 0; i < symbolSegments.length; i++) {
      let segment = symbolSegments[i];
      if (!this.caseSensitive) {
        segment = segment?.toLowerCase();
      }

      // --- Do not search for module-local variables
      if (segment.startsWith("@") && i > 0) {
        return null;
      }

      if (i === symbolSegments.length - 2) {
        // --- This is the segment before the last, it may be
        // --- either a module or a struct.
        structFound = module.structs[segment];
      } else if (i === symbolSegments.length - 1) {
        // --- This is the last segment, it should be a symbol
        // --- in the currently reached module, or a field in a structure.
        if (structFound) {
          // --- Check the structure for its fields
          const fieldDefinition = structFound.getField(segment);
          return fieldDefinition
            ? {
                value: new ExpressionValue(fieldDefinition.offset),
                usageInfo: fieldDefinition
              }
            : null;
        }
        const symbolInfo = module.getSymbol(segment);
        return symbolInfo
          ? {
              value: symbolInfo.value,
              usageInfo: symbolInfo
            }
          : null;
      }

      if (structFound) {
        continue;
      }

      const subModule = module.getNestedModule(segment);
      // --- This is a module name within the currently reached module.
      if (!subModule) {
        // --- Module does not exist
        return null;
      }
      module = subModule;
    }
    return null;
  }
}
