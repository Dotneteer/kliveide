import { IAssemblySymbolInfo, IExpressionValue, SymbolType, TypedObject } from "@main/compiler-common/abstractions";
import type { ErrorCodes } from "./assembler-errors";
import { FixupEntry } from "./fixups";
import { CommonTokenType } from "./common-tokens";

/**
 * This class represents an assembly symbol
 */
export class AssemblySymbolInfo implements IAssemblySymbolInfo {
  constructor(
    public readonly name: string,
    public readonly type: SymbolType,
    public value: IExpressionValue
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
  static createLabel(name: string, value: IExpressionValue): AssemblySymbolInfo {
    return new AssemblySymbolInfo(name, SymbolType.Label, value);
  }

  /**
   * Factory method that creates a variable
   * @param name Variable name
   * @param value Variable value
   */
  static createVar(name: string, value: IExpressionValue): AssemblySymbolInfo {
    return new AssemblySymbolInfo(name, SymbolType.Var, value);
  }
}

/**
 * Represents a symbol scope
 */
export interface ISymbolScope<TInstruction extends TypedObject, TToken extends CommonTokenType> {
  /**
   * The symbol table with properly defined symbols
   */
  readonly symbols: SymbolInfoMap;

  /**
   *  The list of fixups to resolve in the last phase of the compilation
   */
  readonly fixups: FixupEntry<TInstruction, TToken>[];

  /**
   * Adds a symbol to this scope
   * @param name Symbol name
   * @param symbol Symbol data
   */
  addSymbol(name: string, symbol: IAssemblySymbolInfo): void;

  /**
   * Tests if the specified symbol has been defined
   */
  containsSymbol(name: string): boolean;

  /**
   * Gets the specified symbol
   * @param name Symbol name
   * @returns The symbol information, if found; otherwise, undefined.
   */
  getSymbol(name: string): IAssemblySymbolInfo | undefined;
}

/**
 * Represents a scope where local symbols are declared
 */
export class SymbolScope<TInstruction extends TypedObject, TToken extends CommonTokenType> implements ISymbolScope<TInstruction, TToken> {
  private _errorsReported = new Set<ErrorCodes>();

  constructor(
    public readonly ownerScope: SymbolScope<TInstruction, TToken> | null,
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
  readonly fixups: FixupEntry<TInstruction, TToken>[] = [];

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
  macroArguments: Record<string, IExpressionValue> | null = null;

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
  getSymbol(name: string): IAssemblySymbolInfo | undefined {
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
export type SymbolInfoMap = Record<string, IAssemblySymbolInfo>;
