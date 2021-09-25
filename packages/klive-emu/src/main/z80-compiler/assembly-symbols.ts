import { ErrorCodes } from "./errors";
import { HasUsageInfo } from "./assembler-types";
import { ExpressionValue } from "./expressions";
import { FixupEntry } from "./fixups";

/**
 * This class represents an assembly symbol
 */
export class AssemblySymbolInfo implements HasUsageInfo {
  constructor(
    public readonly name: string,
    public readonly type: SymbolType,
    public value: ExpressionValue
  ) {
    this.isModuleLocal = name.startsWith("@");
    this.isShortTerm = name.startsWith("`");
    this.isUsed = false;
  }

  /**
   * Tests if this symbol is a local symbol within a module.
   */
  readonly isModuleLocal: boolean;

  /**
   * Tests if this symbol is a short-term symbol.
   */
  readonly isShortTerm: boolean;

  /**
   * Signs if the object has been used
   */
  isUsed: boolean;

  /**
   * Factory method that creates a label
   * @param name Label name
   * @param value Label value
   */
  static createLabel(name: string, value: ExpressionValue): AssemblySymbolInfo {
    return new AssemblySymbolInfo(name, SymbolType.Label, value);
  }

  /**
   * Factory method that creates a variable
   * @param name Variable name
   * @param value Variable value
   */
  static createVar(name: string, value: ExpressionValue): AssemblySymbolInfo {
    return new AssemblySymbolInfo(name, SymbolType.Var, value);
  }
}

/**
 * This enum defines the types of assembly symbols
 */
export enum SymbolType {
  None,
  Label,
  Var,
}

/**
 * Represents a symbol scope
 */
export interface ISymbolScope {
  /**
   * The symbol table with properly defined symbols
   */
  readonly symbols: SymbolInfoMap;

  /**
   *  The list of fixups to resolve in the last phase of the compilation
   */
  readonly fixups: FixupEntry[];

  /**
   * Adds a symbol to this scope
   * @param name Symbol name
   * @param symbol Symbol data
   */
  addSymbol(name: string, symbol: AssemblySymbolInfo): void;

  /**
   * Tests if the specified symbol has been defined
   */
  containsSymbol(name: string): boolean;

  /**
   * Gets the specified symbol
   * @param name Symbol name
   * @returns The symbol information, if found; otherwise, undefined.
   */
  getSymbol(name: string): AssemblySymbolInfo | undefined;
}

/**
 * Represents a scope where local symbols are declared
 */
export class SymbolScope implements ISymbolScope {
  private _errorsReported = new Set<ErrorCodes>();

  constructor(
    public readonly ownerScope: SymbolScope | null,
    private readonly caseSensitive: boolean
  ) {}

  /**
   * Indicates that this scope is for a loop
   */
  isLoopScope: boolean = true;

  /**
   * Indicates that this scope is for a proc
   */
  isProcScope: boolean = false;

  /**
   * The current loop counter in the scope
   */
  loopCounter: number = 0;

  /**
   * Indicates if this is a temporary scope
   */
  isTemporaryScope: boolean = false;

  /**
   * The symbol table with properly defined symbols
   */
  readonly symbols: SymbolInfoMap = {};

  /**
   * Local symbol bookings
   */
  readonly localSymbolBookings = new Set<string>();

  /**
   *  The list of fixups to resolve in the last phase of the compilation
   */
  readonly fixups: FixupEntry[] = [];

  /**
   * Indicates if a break statement has been reached in this scope
   */
  breakReached: boolean = false;

  /**
   * Indicates if a continue statement has been reached in this scope
   */
  continueReached: boolean = false;

  /**
   * Optional macro arguments
   */
  macroArguments: { [key: string]: ExpressionValue } | null = null;

  /**
   * Tests if this context is a macro context
   */
  get isMacroContext(): boolean {
    return !!this.macroArguments;
  }

  /**
   *
   * @param code Signs that the specified error has been reported
   */
  reportError(code: ErrorCodes): void {
    this._errorsReported.add(code);
  }

  /**
   * Checks if the specified error has been reported
   * @param code Error code to check
   */
  isErrorReported(code: ErrorCodes): boolean {
    return this._errorsReported.has(code);
  }

  /**
   * Adds a symbol to this scope
   * @param name Symbol name
   * @param symbol Symbol data
   */
  addSymbol(name: string, symbol: AssemblySymbolInfo): void {
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
  getSymbol(name: string): AssemblySymbolInfo | undefined {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return this.symbols[name];
  }

  /**
   * Adds booking for a local name
   * @param name Symbol name
   */
  addLocalBooking(name: string): void {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    this.localSymbolBookings.add(name);
  }

  /**
   * Checks if the specified symbol has been booked
   * @param name Name to test
   */
  containsLocalBooking(name: string): boolean {
    if (!this.caseSensitive) {
      name = name.toLowerCase();
    }
    return !!this.localSymbolBookings.has(name);
  }
}

/**
 * Represents symbol information map
 */
export type SymbolInfoMap = { [key: string]: AssemblySymbolInfo };

