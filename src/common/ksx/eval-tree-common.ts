import { EvaluationContext } from "./EvaluationContext";
import { LogicalThread } from "./LogicalThread";
import {
  ArrowExpression,
  AssignmentExpression,
  BinaryOpSymbols,
  CalculatedMemberAccessExpression,
  Expression,
  Identifier,
  Literal,
  MemberAccessExpression,
  PostfixOpExpression,
  PrefixOpExpression,
  UnaryExpression
} from "./source-tree";
import { BlockScope } from "./BlockScope";
import { isConstVar } from "./eval-tree-async";

// --- Type guard to check for a Promise
export function isPromise (obj: any): obj is Promise<any> {
  return obj && typeof obj.then === "function";
}

// --- Evaluates a literal value (sync & async context)
export function evalLiteral (thisStack: any[], expr: Literal): any {
  thisStack.push(expr.value);
  return expr.value;
}

export type IdentifierScope = "global" | "app" | "localContext" | "block";

export function getIdentifierScope (
  expr: Identifier,
  evalContext: EvaluationContext,
  thread?: LogicalThread
): { type?: IdentifierScope; scope: any } {
  let type: IdentifierScope | undefined;
  let scope: any;

  // --- Search for primary value scope
  if (expr.isGlobal) {
    // --- Use the global scope only
    scope = globalThis;
    type = "global";
  } else {
    // --- Iterate trough threads from the current to the parent
    let currentThread: LogicalThread | undefined =
      thread ?? evalContext.mainThread;
    while (currentThread && !scope) {
      if (currentThread.blocks) {
        // --- Search the block-scopes
        for (let idx = currentThread.blocks.length - 1; idx >= 0; idx--) {
          const blockContext = currentThread.blocks[idx]?.vars;
          if (blockContext && expr.name in blockContext) {
            scope = blockContext;
            type = "block";
            break;
          }
        }
      }

      // --- We may have already found the ID
      if (scope) break;

      if (currentThread.closures) {
        // --- Search block-scopes of the closure list
        for (let idx = currentThread.closures.length - 1; idx >= 0; idx--) {
          const blockContext = currentThread.closures[idx]?.vars;
          if (blockContext && expr.name in blockContext) {
            scope = blockContext;
            type = "block";
            break;
          }
        }
      }

      // --- We may have already found the ID
      if (scope) break;

      // --- Check the parent thread
      currentThread = currentThread.parent;
    }
  }

  // --- If no identifier found so far, check the local context, the app context, and finally, the global context
  if (!scope) {
    if (evalContext.localContext && expr.name in evalContext.localContext) {
      // --- Object in localContext
      scope = evalContext.localContext;
      type = "localContext";
    } else if (evalContext.appContext?.[expr.name] !== undefined) {
      // --- Object in appContext
      scope = evalContext.appContext;
      type = "app";
    } else {
      // --- Finally, check the global context
      scope = globalThis;
      type = "global";
    }
  }

  // --- Done
  return { type, scope: scope };
}

// --- Evaluates an identifier (sync & async context)
export function evalIdentifier (
  thisStack: any[],
  expr: Identifier,
  evalContext: EvaluationContext,
  thread: LogicalThread
): any {
  const valueScope = getIdentifierScope(expr, evalContext, thread).scope;
  let valueIndex: string | number = expr.name;
  let idObj: any;

  // --- Get the variable value
  if (valueScope) {
    expr.valueScope = valueScope;
    expr.valueIndex = valueIndex;
    idObj = valueScope[valueIndex];
  } else {
    throw new Error(`${expr.name} is not defined`);
  }

  // --- Done
  expr.value = idObj;
  thisStack.push(idObj);
  return idObj;
}

// --- Evaluates a member access expression (sync & async context)
export function evalMemberAccessCore (
  parentObj: any,
  thisStack: any[],
  expr: MemberAccessExpression,
  evalContext: EvaluationContext
): any {
  // --- At this point we definitely keep the parent object on `thisStack`, as it will be the context object
  // --- of a FunctionInvocationExpression, if that follows the MemberAccess. Other operations would call
  // --- `thisStack.pop()` to remove the result from the previous `evalBindingExpressionTree` call.
  expr.valueScope = parentObj;
  expr.valueIndex = expr.member;
  const memberObj =
    expr.isOptional || evalContext.options?.defaultToOptionalMemberAccess
      ? parentObj?.[expr.member]
      : parentObj[expr.member];
  thisStack.push(memberObj);

  // --- Done.
  return memberObj;
}

// --- Evaluates a calculated member access expression (sync & async context)
export function evalCalculatedMemberAccessCore (
  parentObj: any,
  memberObj: any,
  thisStack: any[],
  expr: CalculatedMemberAccessExpression,
  evalContext: EvaluationContext
): any {
  // --- At this point we definitely keep the parent object on `thisStack`, as it will be the context object
  // --- of a FunctionInvocationExpression, if that follows the MemberAccess. Other operations would call
  // --- `thisStack.pop()` to remove the result from the previous `evalBindingExpressionTree` call.
  expr.valueScope = parentObj;
  expr.valueIndex = memberObj;
  const calcMemberObj = evalContext.options?.defaultToOptionalMemberAccess
    ? parentObj?.[memberObj]
    : parentObj[memberObj];
  thisStack.push(calcMemberObj);

  // --- Done.
  return calcMemberObj;
}

// --- Evaluates a unary expression (sync & async context)
export function evalUnaryCore (
  expr: UnaryExpression,
  operand: any,
  thisStack: any[]
): any {
  let unaryObj: any;
  switch (expr.operator) {
    case "typeof":
      unaryObj = typeof operand;
      break;
    case "delete":
      if (expr.operand.valueScope && expr.operand.valueIndex) {
        return delete expr.operand.valueScope[expr.operand.valueIndex];
      }
      return false;
    case "+":
      unaryObj = operand;
      break;
    case "-":
      unaryObj = -operand;
      break;
    case "!":
      unaryObj = !operand;
      break;
    case "~":
      unaryObj = ~operand;
      break;
    default:
      throw new Error(`Unknown unary operator: ${expr.operator}`);
  }
  thisStack.push(unaryObj);
  return unaryObj;
}

// --- Evaluates a binary operation (sync & async context)
export function evalBinaryCore (
  l: any,
  r: any,
  thisStack: any[],
  opSymbol: BinaryOpSymbols
): any {
  let binaryObj: any;
  switch (opSymbol) {
    case "**":
      binaryObj = l ** r;
      break;
    case "*":
      binaryObj = l * r;
      break;
    case "/":
      binaryObj = l / r;
      break;
    case "%":
      binaryObj = l % r;
      break;
    case "+":
      binaryObj = l + r;
      break;
    case "-":
      binaryObj = l - r;
      break;
    case ">>":
      binaryObj = l >> r;
      break;
    case ">>>":
      binaryObj = l >>> r;
      break;
    case "<<":
      binaryObj = l << r;
      break;
    case "<":
      binaryObj = l < r;
      break;
    case "<=":
      binaryObj = l <= r;
      break;
    case ">":
      binaryObj = l > r;
      break;
    case ">=":
      binaryObj = l >= r;
      break;
    case "in":
      binaryObj = l in r;
      break;
    case "==":
      binaryObj = l == r;
      break;
    case "!=":
      binaryObj = l != r;
      break;
    case "===":
      binaryObj = l === r;
      break;
    case "!==":
      binaryObj = l !== r;
      break;
    case "&":
      binaryObj = l & r;
      break;
    case "^":
      binaryObj = l ^ r;
      break;
    case "|":
      binaryObj = l | r;
      break;
    case "&&":
      binaryObj = l && r;
      break;
    case "||":
      binaryObj = l || r;
      break;
    case "??":
      binaryObj = l ?? r;
      break;
    default:
      throw new Error(`Unknown binary operator: ${opSymbol}`);
  }
  thisStack.push(binaryObj);
  return binaryObj;
}

// --- Evaluates an assignment operation (sync & async context)
export function evalAssignmentCore (
  leftValue: Expression,
  newValue: any,
  thisStack: any[],
  expr: AssignmentExpression,
  thread: LogicalThread
): any {
  if (
    !leftValue.valueScope ||
    leftValue.valueIndex === undefined ||
    leftValue.valueIndex === null
  ) {
    throw new Error(
      `Evaluation of ${expr.operator} requires a left-hand value., valueScope: ${leftValue.valueScope}, valueIndex: ${leftValue.valueIndex}`
    );
  }

  const leftScope = leftValue.valueScope;
  const leftIndex = leftValue.valueIndex;
  if (typeof leftScope !== "object" || leftScope === null) {
    throw new Error(
      `Unknown left-hand value ${leftValue?.source}, ${expr.source}`
    );
  }

  // --- Check for const value
  if (expr.leftValue.type === "Identifier") {
    if (isConstVar(expr.leftValue.name, thread)) {
      throw new Error("A const variable cannot be modified");
    }
  }

  thisStack.pop();
  switch (expr.operator) {
    case "=":
      leftScope[leftIndex] = newValue;
      break;
    case "+=":
      leftScope[leftIndex] += newValue;
      break;
    case "-=":
      leftScope[leftIndex] -= newValue;
      break;
    case "**=":
      leftScope[leftIndex] **= newValue;
      break;
    case "*=":
      leftScope[leftIndex] *= newValue;
      break;
    case "/=":
      leftScope[leftIndex] /= newValue;
      break;
    case "%=":
      leftScope[leftIndex] %= newValue;
      break;
    case "<<=":
      leftScope[leftIndex] <<= newValue;
      break;
    case ">>=":
      leftScope[leftIndex] >>= newValue;
      break;
    case ">>>=":
      leftScope[leftIndex] >>>= newValue;
      break;
    case "&=":
      leftScope[leftIndex] &= newValue;
      break;
    case "^=":
      leftScope[leftIndex] ^= newValue;
      break;
    case "|=":
      leftScope[leftIndex] |= newValue;
      break;
    case "&&=":
      leftScope[leftIndex] &&= newValue;
      break;
    case "||=":
      leftScope[leftIndex] ||= newValue;
      break;
    case "??=":
      leftScope[leftIndex] += newValue;
      break;
  }
  const value = leftScope[leftIndex];
  thisStack.push(value);
  return value;
}

// --- Evaluates a prefix/postfix operator (sync & async context)
export function evalPreOrPostCore (
  operand: Expression,
  thisStack: any[],
  expr: PrefixOpExpression | PostfixOpExpression,
  thread: LogicalThread
): any {
  thisStack.pop();
  if (!operand.valueScope || operand.valueIndex === undefined) {
    throw new Error(
      `Evaluation of ${expr.operator} requires a left-hand value.`
    );
  }

  // --- Check for const value
  if (expr.operand.type === "Identifier") {
    if (isConstVar(expr.operand.name, thread)) {
      // --- We cannot modify a const value
      throw new Error("A const variable cannot be modified");
    }
  }

  const value =
    expr.operator === "++"
      ? expr.type === "PrefixOpExpression"
        ? ++operand.valueScope[operand.valueIndex]
        : operand.valueScope[operand.valueIndex]++
      : expr.type === "PrefixOpExpression"
      ? --operand.valueScope[operand.valueIndex]
      : operand.valueScope[operand.valueIndex]--;
  thisStack.push(value);
  return value;
}

// --- Evaluates an arrow expression (lazy, sync & async context)
export function evalArrow (
  thisStack: any[],
  expr: ArrowExpression,
  thread: LogicalThread
): ArrowExpression {
  const lazyArrow = {
    ...expr,
    _ARROW_EXPR_: true,
    closureContext: obtainClosures(thread)
  } as ArrowExpression;
  thisStack.push(lazyArrow);
  return lazyArrow;
}

export function obtainClosures (thread: LogicalThread): BlockScope[] {
  const closures = thread.blocks?.slice(0) ?? [];
  return thread.parent
    ? [...obtainClosures(thread.parent), ...closures]
    : closures;
}
