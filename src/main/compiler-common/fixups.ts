import type { ErrorCodes } from "../z80-compiler/assembler-errors";
import type { SymbolInfoMap } from "../z80-compiler/assembly-symbols";

import { AssemblyModule } from "../z80-compiler/assembly-module";
import { ExpressionEvaluator } from "../z80-compiler/expressions";
import {
  FixupType,
  IEvaluationContext,
  IExpressionValue,
  IValueInfo,
  SymbolType,
  TypedObject
} from "@main/compiler-common/abstractions";
import { AssemblyLine, Expression, NodePosition } from "@main/compiler-common/tree-nodes";
import { CommonTokenType } from "@main/compiler-common/common-tokens";

/**
 * This class represents a fixup that recalculates and replaces
 * unresolved symbol value at the end of the compilation
 */
export class FixupEntry<
  TInstruction extends TypedObject,
  TToken extends CommonTokenType
> extends ExpressionEvaluator<TInstruction, TToken> {
  private readonly _symbols: Record<string, IValueInfo>;

  constructor(
    public readonly parentContext: IEvaluationContext<TInstruction, TToken>,
    public readonly module: AssemblyModule<TInstruction, TToken>,
    public readonly sourceLine: AssemblyLine<TInstruction>,
    public readonly type: FixupType,
    public readonly segmentIndex: number,
    public readonly offset: number,
    public readonly expression: Expression<TInstruction, TToken>,
    public readonly label: string | null = null,
    public readonly structBytes: Map<number, number> | null = null
  ) {
    super();
    if (expression) this._symbols = FixupEntry.snapshotVars(module);
  }

  /**
   * Indicates if this entry has already been resolved
   */
  resolved: boolean;

  /**
   * Gets the source line the evaluation context is bound to
   */
  getSourceLine(): AssemblyLine<TInstruction> {
    return this.sourceLine;
  }

  /**
   * Sets the source line the evaluation context is bound to
   * @param sourceLine Source line information
   */
  setSourceLine(_sourceLine: AssemblyLine<TInstruction>): void {
    // --- The constructor already sets the source line
  }

  /**
   * Gets the current assembly address
   */
  getCurrentAddress(): number {
    return this.parentContext.getCurrentAddress();
  }

  /**
   * Gets the value of the specified symbol
   * @param symbol Symbol name
   * @param startFromGlobal Should resolution start from global scope?
   */
  getSymbolValue(symbol: string, startFromGlobal?: boolean): IValueInfo | null {
    let resolved = this._symbols?.[symbol];
    if (!resolved) {
      if (startFromGlobal) {
        // --- Most be a compound symbol
        resolved = this.module.resolveCompoundSymbol(symbol, true);
      } else if (symbol.indexOf(".") >= 0) {
        resolved = this.module.resolveCompoundSymbol(symbol, false);
        if (resolved === null) {
          resolved = this.module.resolveSimpleSymbol(symbol);
        }
      } else {
        resolved = this.module.resolveSimpleSymbol(symbol);
      }
    }
    return resolved !== null
      ? resolved
      : this.parentContext.getSymbolValue(symbol, startFromGlobal);
  }

  /**
   * Gets the current loop counter value
   */
  getLoopCounterValue(): IExpressionValue {
    return this.parentContext.getLoopCounterValue();
  }

  /**
   * Reports an error during evaluation
   * @param code Error code
   * @param node Error position
   * @param parameters Optional error parameters
   */
  reportEvaluationError(
    context: IEvaluationContext<TInstruction, TToken>,
    code: ErrorCodes,
    node: NodePosition,
    ...parameters: any[]
  ): void {
    this.parentContext.reportEvaluationError(context, code, node, ...parameters);
  }

  private static snapshotVars(module: AssemblyModule<any, any>): Record<string, IValueInfo> {
    let snapshot = module.parentModule ? FixupEntry.snapshotVars(module.parentModule) : {};

    const varsFilter = (s: SymbolInfoMap) => (k: string) => s[k].type === SymbolType.Var;
    const vars = new Set(
      Object.keys(module.symbols)
        .filter(varsFilter(module.symbols))
        .concat(
          ...module.localScopes.map((s) => Object.keys(s.symbols).filter(varsFilter(s.symbols)))
        )
    );
    for (const v of vars) snapshot[v] = module.resolveSimpleSymbol(v);

    return snapshot;
  }
}
