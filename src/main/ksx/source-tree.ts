// All binding expression tree node types
import { BlockScope } from "./BlockScope";

type Node = Statement | Expression | SwitchCase;

// The root type of all source tree nodes
export interface BaseNode {
  /**
   * Node type discriminator
   */
  type: Node["type"];

  /**
   * Start position (inclusive) of the node
   */
  startPosition: number;

  /**
   * End position (exclusive)
   */
  endPosition: number;

  /**
   * Start line number of the start token of the node
   */
  startLine: number;

  /**
   * End line number of the end token of the node
   */
  endLine: number;

  /**
   * Start column number (inclusive) of the node
   */
  startColumn: number;

  /**
   * End column number (exclusive) of the node
   */
  endColumn: number;

  /**
   * The source code of the expression
   */
  source: string;
}

// =====================================================================================================================
// Statements

export type Statement =
  | BlockStatement
  | EmptyStatement
  | ExpressionStatement
  | ArrowExpressionStatement
  | LetStatement
  | ConstStatement
  | IfStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | WhileStatement
  | DoWhileStatement
  | ForStatement
  | ForInStatement
  | ForOfStatement
  | ThrowStatement
  | TryStatement
  | SwitchStatement;

export type LoopStatement = WhileStatement | DoWhileStatement;

// The base node of statements
export interface StatementBase extends BaseNode {
  // Guard flag used when processing a statement
  guard?: boolean;

  // Flag indicating if the block scope should be removed
  removeBlockScope?: boolean;

  // Flag indicating if this is the last statement of a try block
  completeTryBlock?: boolean;

  // Flag indicating if this is the last statement of a catch block
  completeCatchBlock?: boolean;

  // Flag indicating if this is the last statement of a finally block
  completeFinallyBlock?: boolean;
}

export interface EmptyStatement extends StatementBase {
  type: "EmptyStatement";
}

export interface ExpressionStatement extends StatementBase {
  type: "ExpressionStatement";
  expression: Expression;
}

export interface ArrowExpressionStatement extends StatementBase {
  type: "ArrowExpressionStatement";
  expression: ArrowExpression;
}

export interface VarDeclaration extends ExpressionBase {
  type: "VarDeclaration";
  id?: string;
  arrayDestruct?: ArrayDestructure[];
  objectDestruct?: ObjectDestructure[];
  expression?: Expression;
}

export interface DestructureBase extends ExpressionBase {
  id?: string;
  arrayDestruct?: ArrayDestructure[];
  objectDestruct?: ObjectDestructure[];
}

export interface Destructure extends DestructureBase {
  type: "Destructure";
  arrayDestruct?: ArrayDestructure[];
  objectDestruct?: ObjectDestructure[];
}

export interface ArrayDestructure extends DestructureBase {
  type: "ArrayDestructure";
}

export interface ObjectDestructure extends DestructureBase {
  type: "ObjectDestructure";
  id: string;
  alias?: string;
}

export interface LetStatement extends StatementBase {
  type: "LetStatement";
  declarations: VarDeclaration[];
}

export interface ConstStatement extends StatementBase {
  type: "ConstStatement";
  declarations: VarDeclaration[];
}

export interface BlockStatement extends StatementBase {
  type: "BlockStatement";
  statements: Statement[];
}

export interface IfStatement extends StatementBase {
  type: "IfStatement";
  condition: Expression;
  thenBranch: Statement;
  elseBranch?: Statement;
}

export interface ReturnStatement extends StatementBase {
  type: "ReturnStatement";
  expression?: Expression;
}

export interface WhileStatement extends StatementBase {
  type: "WhileStatement";
  condition: Expression;
  body: Statement;
}

export interface DoWhileStatement extends StatementBase {
  type: "DoWhileStatement";
  condition: Expression;
  body: Statement;
}

export interface BreakStatement extends StatementBase {
  type: "BreakStatement";
}

export interface ContinueStatement extends StatementBase {
  type: "ContinueStatement";
}

export interface ThrowStatement extends StatementBase {
  type: "ThrowStatement";
  expression: Expression;
}

export interface TryStatement extends StatementBase {
  type: "TryStatement";
  tryBlock: BlockStatement;
  catchBlock?: BlockStatement;
  catchVariable?: string;
  finallyBlock?: BlockStatement;
}

export interface ForStatement extends StatementBase {
  type: "ForStatement";
  init?: ExpressionStatement | LetStatement;
  condition?: Expression;
  update?: Expression;
  body: Statement;
}

export type ForVarBinding = "let" | "const" | "none";
export interface ForInStatement extends StatementBase {
  type: "ForInStatement";
  varBinding: ForVarBinding;
  id: string;
  expression: Expression;
  body: Statement;

  // Object keys in a for..in loop
  keys?: string[];

  // Object key index in a for
  keyIndex?: number;
}

export interface ForOfStatement extends StatementBase {
  type: "ForOfStatement";
  varBinding: ForVarBinding;
  id: string;
  expression: Expression;
  body: Statement;

  // --- Iterator used in for..of
  iterator?: any;
}

export interface SwitchStatement extends StatementBase {
  type: "SwitchStatement";
  expression: Expression;
  cases: SwitchCase[];
}

export interface SwitchCase extends BaseNode {
  type: "SwitchCase";
  caseExpression?: Expression;
  statements?: Statement[];
}

// =====================================================================================================================
// Expressions

// All syntax nodes that represent an expression
export type Expression =
  | UnaryExpression
  | BinaryExpression
  | SequenceExpression
  | ConditionalExpression
  | FunctionInvocationExpression
  | MemberAccessExpression
  | CalculatedMemberAccessExpression
  | Identifier
  | Literal
  | ArrayLiteral
  | ObjectLiteral
  | SpreadExpression
  | AssignmentExpression
  | NoArgExpression
  | ArrowExpression
  | PrefixOpExpression
  | PostfixOpExpression
  | VarDeclaration
  | Destructure
  | ObjectDestructure
  | ArrayDestructure;

// Common base node for all expression syntax nodes
export interface ExpressionBase extends BaseNode {
  // The value of the expression.
  value: any;

  // Is this expression parenthesized?
  parenthesized?: number;

  // The scope in which a left-hand value can be resolved
  valueScope?: any;

  // The index to resolve the left-hand value in its resolution scope
  valueIndex?: string | number;
}

export type UnaryOpSymbols = "+" | "-" | "~" | "!" | "typeof" | "delete";

export type BinaryOpSymbols =
  | "**"
  | "*"
  | "/"
  | "%"
  | "+"
  | "-"
  | "<<"
  | ">>"
  | ">>>"
  | "<"
  | "<="
  | ">"
  | ">="
  | "=="
  | "==="
  | "!="
  | "!=="
  | "&"
  | "|"
  | "^"
  | "&&"
  | "||"
  | "??"
  | "in";

export type AssignmentSymbols =
  | "="
  | "+="
  | "-="
  | "**="
  | "*="
  | "/="
  | "%="
  | "<<="
  | ">>="
  | ">>>="
  | "&="
  | "^="
  | "|="
  | "&&="
  | "||="
  | "??=";

export type PrefixOpSymbol = "++" | "--";

export interface UnaryExpression extends ExpressionBase {
  type: "UnaryExpression";
  operator: UnaryOpSymbols;
  operand: Expression;
}

export interface BinaryExpression extends ExpressionBase {
  type: "BinaryExpression";
  operator: BinaryOpSymbols;
  left: Expression;
  right: Expression;
}

export interface SequenceExpression extends ExpressionBase {
  type: "SequenceExpression";
  expressions: Expression[];
  loose?: boolean;
}

export interface ConditionalExpression extends ExpressionBase {
  type: "ConditionalExpression";
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

export interface FunctionInvocationExpression extends ExpressionBase {
  type: "FunctionInvocation";
  object: Expression;
  arguments: Expression[];
}

export interface MemberAccessExpression extends ExpressionBase {
  type: "MemberAccess";
  object: Expression;
  member: string;
  isOptional?: boolean;
}

export interface CalculatedMemberAccessExpression extends ExpressionBase {
  type: "CalculatedMemberAccess";
  object: Expression;
  member: Expression;
}

export interface Identifier extends ExpressionBase {
  type: "Identifier";
  name: string;
  isGlobal?: boolean;
}

export interface Literal extends ExpressionBase {
  type: "Literal";
  value: any;
}

export interface ArrayLiteral extends ExpressionBase {
  type: "ArrayLiteral";
  items: Expression[];
  loose?: boolean;
}

export interface ObjectLiteral extends ExpressionBase {
  type: "ObjectLiteral";
  props: (SpreadExpression | [Expression, Expression])[];
}

export interface SpreadExpression extends ExpressionBase {
  type: "SpreadExpression";
  operand: Expression;
}

export interface AssignmentExpression extends ExpressionBase {
  type: "AssignmentExpression";
  leftValue: Expression;
  operator: AssignmentSymbols;
  operand: Expression;
}

export interface NoArgExpression extends ExpressionBase {
  type: "NoArgExpression";
}

export interface ArrowExpression extends ExpressionBase {
  type: "ArrowExpression";
  args: Expression[];
  statement: Statement;
  closureContext?: BlockScope[];
}

export interface PrefixOpExpression extends ExpressionBase {
  type: "PrefixOpExpression";
  operator: PrefixOpSymbol;
  operand: Expression;
}

export interface PostfixOpExpression extends ExpressionBase {
  type: "PostfixOpExpression";
  operator: PrefixOpSymbol;
  operand: Expression;
}
