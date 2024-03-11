import { EvaluationContext } from "./EvaluationContext";
import { evalBinding, executeArrowExpressionSync } from "./eval-tree-sync";
import { LogicalThread } from "./LogicalThread";
import {
  innermostBlockScope,
  innermostLoopScope,
  createLoopScope,
  provideLoopBody,
  releaseLoopScope,
  ensureMainThread,
  innermostTryScope,
  provideTryBody,
  createTryScope,
  provideCatchBody,
  provideFinallyBody,
  provideFinallyErrorBody
} from "./process-statement-common";
import {
  ArrayDestructure,
  AssignmentExpression,
  EmptyStatement,
  ExpressionStatement,
  Identifier,
  Literal,
  ObjectDestructure,
  Statement,
  VarDeclaration
} from "./source-tree";
import {
  QueueInfo,
  StatementQueue,
  mapStatementsToQueueItems,
  StatementQueueItem,
  ProcessOutcome,
  mapToItem
} from "./statement-queue";
import { LoopScope } from "./LoopScope";
import { BlockScope } from "./BlockScope";
import { StatementExecutionError, ThrowStatementError, reportEngineError } from "./engine-errors";

const SYNC_EVAL_TIMEOUT = 1000;

// --- Helper function to process the entire queue synchronously
export function processStatementQueue (
  statements: Statement[],
  evalContext: EvaluationContext,
  thread?: LogicalThread
): QueueInfo {
  if (!thread) {
    // --- Create the main thread for the queue
    thread = ensureMainThread(evalContext);
  }

  // --- Set start tick to observe timeout
  evalContext.startTick = new Date().valueOf();

  // --- Fill the queue with items
  const queue = new StatementQueue();
  queue.push(mapStatementsToQueueItems(statements));

  // --- Prepare queue diagnostics information
  const diagInfo: QueueInfo = {
    processedStatements: 0,
    maxQueueLength: queue.length,
    unshiftedItems: 0,
    clearToLabels: 0,
    maxBlocks: 0,
    maxLoops: 0
  };

  // --- Consume the queue
  while (queue.length > 0) {
    // --- Check sync timeout
    if (
      evalContext.startTick !== undefined &&
      new Date().valueOf() - evalContext.startTick > SYNC_EVAL_TIMEOUT
    ) {
      throw new Error(
        `Sync evaluation timeout exceeded ${SYNC_EVAL_TIMEOUT} milliseconds`
      );
    }

    // --- Process the first item
    const queueItem = queue.dequeue();
    thread.breakLabelValue = queue.length > 0 ? queue.peek()!.label : -1;

    let outcome: ProcessOutcome | undefined;
    try {
      outcome = processStatement(queueItem!.statement, evalContext, thread);
    } catch (err) {
      if (thread.tryBlocks && thread.tryBlocks.length > 0) {
        // --- We have a try block to handle this error
        const tryScope = thread.tryBlocks[thread.tryBlocks.length - 1];

        // --- Sign the error to raise. Next time the guarded try block will execute the catch block, if there is any
        tryScope.errorToThrow = err;
        tryScope.errorSource = tryScope.processingPhase;
        tryScope.processingPhase = "error";

        // --- Let's skip the remaining parts of the current block (try/catch/finally)
        outcome = {
          clearToLabel: tryScope.tryLabel
        };
      } else {
        if (err instanceof ThrowStatementError) {
          reportEngineError(err);
        } else {
          reportEngineError(
            new StatementExecutionError(
              err as any,
              queueItem!.statement?.source
            ),
            err
          );
        }
      }
    }

    // --- Modify the queue's content according to the outcome
    if (outcome) {
      if (outcome.toUnshift) {
        queue.unshift(outcome.toUnshift);

        diagInfo.unshiftedItems += outcome.toUnshift.length;
      }
      if (outcome.clearToLabel !== undefined) {
        queue.clearToLabel(outcome.clearToLabel);

        diagInfo.clearToLabels++;
      }
    }

    // --- Provide diagnostics
    if (queue.length > diagInfo.maxQueueLength) {
      diagInfo.maxQueueLength = queue.length;
    }
    if (thread.blocks && thread.blocks!.length > diagInfo.maxBlocks) {
      diagInfo.maxBlocks = thread.blocks!.length;
    }
    if (thread.loops && thread.loops.length > diagInfo.maxLoops) {
      diagInfo.maxLoops = thread.loops.length;
    }
    diagInfo.processedStatements++;
  }

  return diagInfo;
}

/**
 * Process the specified statement synchronously
 * @param statement Statement to process
 * @param evalContext Evaluation context used for processing
 * @param thread Logical thread to use for statement processing
 * @returns Items to put back into the queue of statements
 */
function processStatement (
  statement: Statement,
  evalContext: EvaluationContext,
  thread: LogicalThread
): ProcessOutcome {
  // --- These items should be put in the statement queue after return
  let clearToLabelBeforeUnshift: number | undefined;
  let toUnshift: StatementQueueItem[] = [];
  let clearToLabel: number | undefined;

  // --- Process the statement according to its type
  switch (statement.type) {
    case "EmptyStatement":
      // --- Nothing to do
      break;

    case "BlockStatement":
      // --- No statement, nothing to process
      if (statement.statements.length === 0) break;

      // --- Create a new block scope
      thread.blocks ??= [];
      thread.blocks.push({ vars: {} });

      // --- Prepare an empty statement that will only remove the block scope when the entire block is processed
      const closing = {
        type: "EmptyStatement",
        removeBlockScope: true
      } as EmptyStatement; // --- We need the cast as we do not provide required props

      // --- Queue the block scope's body
      toUnshift = mapStatementsToQueueItems([...statement.statements, closing]);
      break;

    case "ExpressionStatement":
      // --- Just evaluate it
      const statementValue = evalBinding(
        statement.expression,
        evalContext,
        thread
      );
      if (thread.blocks && thread.blocks.length !== 0) {
        thread.blocks[thread.blocks.length - 1].returnValue = statementValue;
      }
      break;

    case "ArrowExpressionStatement":
      // --- Compile the arrow expression
      const arrowFuncValue = executeArrowExpressionSync(
        statement.expression,
        evalContext,
        thread,
        ...(evalContext.eventArgs ?? [])
      );
      if (thread.blocks && thread.blocks.length !== 0) {
        thread.blocks[thread.blocks.length - 1].returnValue = arrowFuncValue;
      }
      break;

    case "LetStatement": {
      // --- Create a new variable in the innermost scope
      const block = innermostBlockScope(thread);
      if (!block) {
        throw new Error("Missing block scope");
      }
      processDeclarations(block, evalContext, thread, statement.declarations);
      break;
    }

    case "ConstStatement": {
      // --- Create a new variable in the innermost scope
      const block = innermostBlockScope(thread);
      if (!block) {
        throw new Error("Missing block scope");
      }
      processDeclarations(
        block,
        evalContext,
        thread,
        statement.declarations,
        true
      );
      break;
    }

    case "IfStatement":
      // --- Evaluate the condition
      const condition = !!evalBinding(statement.condition, evalContext, thread);
      if (condition) {
        toUnshift = mapToItem(statement.thenBranch);
      } else if (statement.elseBranch) {
        toUnshift = mapToItem(statement.elseBranch);
      }
      break;

    case "ReturnStatement": {
      // --- Check if return is valid here
      let blockScope = innermostBlockScope(thread);
      if (blockScope === undefined) {
        throw new Error("Return requires a block scope");
      }

      // --- Store the return value
      thread.returnValue = statement.expression
        ? evalBinding(statement.expression, evalContext, thread)
        : undefined;

      // --- Check for try blocks
      if ((thread.tryBlocks ?? []).length > 0) {
        // --- Mark the loop's try scope to exit with "return"
        const returnTryScope = thread.tryBlocks![0];
        returnTryScope.exitType = "return";

        // --- Remove the try/catch/finally block's scope
        if (returnTryScope.processingPhase !== "postFinally") {
          thread.blocks!.pop();
        }

        // --- Clear the last part of the try/catch/finally block
        const tryScope = innermostTryScope(thread);
        clearToLabel = tryScope.tryLabel;
      } else {
        // --- Delete the remaining part of the queue
        clearToLabel = -1;
      }
      break;
    }

    case "WhileStatement": {
      // --- Create or get the loop's scope (guard is falsy for the first execution)
      let loopScope = statement.guard
        ? innermostLoopScope(thread)
        : createLoopScope(thread);

      // --- Evaluate the loop condition
      const condition = !!evalBinding(statement.condition, evalContext, thread);
      if (condition) {
        toUnshift = provideLoopBody(
          loopScope!,
          statement,
          thread.breakLabelValue
        );
      } else {
        // --- When the condition is not met, we're done.
        releaseLoopScope(thread);
      }
      break;
    }

    case "DoWhileStatement": {
      if (!statement.guard) {
        // --- First loop execution (do-while is a post-test loop)
        toUnshift = provideLoopBody(
          createLoopScope(thread),
          statement,
          thread.breakLabelValue
        );
        break;
      }

      // --- Evaluate the loop condition
      const condition = !!evalBinding(statement.condition, evalContext, thread);
      if (condition) {
        toUnshift = provideLoopBody(
          innermostLoopScope(thread),
          statement,
          thread.breakLabelValue
        );
      } else {
        // --- When the condition is not met, we're done.
        releaseLoopScope(thread);
      }
      break;
    }

    case "ContinueStatement": {
      // --- Search for the innermost non-switch loop scope, release the switch scopes
      if (!thread.loops || thread.loops.length === 0) {
        throw new Error("Missing loop scope");
      }

      let loopScope: LoopScope | undefined;
      while (thread.loops.length > 0) {
        loopScope = innermostLoopScope(thread);
        if (!loopScope.isSwitch) {
          break;
        }
        thread.loops.pop();
      }

      if (!loopScope) {
        throw new Error("Missing loop scope");
      }

      if (
        loopScope.tryBlockDepth >= 0 &&
        loopScope.tryBlockDepth < (thread.tryBlocks ?? []).length
      ) {
        // --- Mark the loop's try scope to exit with "continue"
        for (
          let i = loopScope.tryBlockDepth;
          i < thread.tryBlocks!.length;
          i++
        ) {
          thread.tryBlocks![loopScope.tryBlockDepth]!.exitType = "continue";
        }

        // --- Clear the last part of the try/catch/finally block
        const tryScope = innermostTryScope(thread);
        clearToLabel = tryScope.tryLabel;
      } else {
        clearToLabel = loopScope.continueLabel;
        releaseLoopScope(thread, false);
      }
      break;
    }

    case "BreakStatement": {
      const loopScope = innermostLoopScope(thread);
      if (loopScope === undefined) {
        throw new Error("Missing loop scope");
      }

      if (!!loopScope.isSwitch) {
        // --- Break is in a switch case
        clearToLabel = loopScope.breakLabel;
        break;
      }

      // --- Break is in a loop construct
      if (
        loopScope.tryBlockDepth >= 0 &&
        loopScope.tryBlockDepth < (thread.tryBlocks ?? []).length
      ) {
        // --- Mark the loop's try scope to exit with "break"
        for (
          let i = loopScope.tryBlockDepth;
          i < thread.tryBlocks!.length;
          i++
        ) {
          thread.tryBlocks![loopScope.tryBlockDepth]!.exitType = "break";
        }

        // --- Clear the last part of the try/catch/finally block
        const tryScope = innermostTryScope(thread);
        clearToLabel = tryScope.tryLabel;
      } else {
        clearToLabel = loopScope.breakLabel;
        releaseLoopScope(thread);
      }
      break;
    }

    case "ForStatement":
      if (!statement.guard) {
        // --- Init the loop with a new scope
        createLoopScope(thread, 1);

        // --- Create a new block for the loop variables
        thread.blocks ??= [];
        thread.blocks.push({ vars: {} });

        const guardStatement = { ...statement, guard: true };
        if (statement.init) {
          // --- Unshift the initialization part and the guarded for-loop
          toUnshift = mapStatementsToQueueItems([
            statement.init,
            guardStatement
          ]);
        } else {
          // --- No init, unshift only the guard statement
          toUnshift = mapStatementsToQueueItems([guardStatement]);
        }
      } else {
        // --- Initialization already done. Evaluate the condition
        if (
          !statement.condition ||
          evalBinding(statement.condition, evalContext, thread)
        ) {
          // --- Stay in the loop, inject the body, the update expression, and the loop guard
          const loopScope = innermostLoopScope(thread);

          if (statement.update) {
            const updateStmt = {
              type: "ExpressionStatement",
              expression: statement.update
            } as ExpressionStatement;
            toUnshift = mapStatementsToQueueItems([
              statement.body,
              updateStmt,
              { ...statement }
            ]);
          } else {
            toUnshift = mapStatementsToQueueItems([
              statement.body,
              { ...statement }
            ]);
          }
          // --- The next queue label is for "break"
          loopScope.breakLabel = thread.breakLabelValue ?? -1;

          // --- The guard action's label is for "continue"
          loopScope.continueLabel = toUnshift[1].label;
        } else {
          // --- The condition is not met, we're done. Remove the loop's scope from the evaluation context
          releaseLoopScope(thread);
        }
      }
      break;

    case "ForInStatement":
      if (!statement.guard) {
        // --- Get the object keys
        const keyedObject = evalBinding(
          statement.expression,
          evalContext,
          thread
        );
        if (keyedObject == undefined) {
          // --- Nothing to do, no object to traverse
          break;
        }

        // --- Init the loop with a new scope
        createLoopScope(thread, 1);

        // --- Create a new block for the loop variables
        thread.blocks ??= [];
        thread.blocks.push({ vars: {} });

        statement.keys = Object.keys(keyedObject);
        statement.keyIndex = 0;
        toUnshift = mapStatementsToQueueItems([{ ...statement, guard: true }]);
      } else {
        // --- Just for the sake of extra safety
        if (statement.keyIndex === undefined || statement.keys === undefined) {
          throw new Error("Keys information expected in for..in loop");
        }

        // --- Any key left?
        if (statement.keyIndex < statement.keys.length) {
          // --- Set the binding variable to the next key
          const propValue = statement.keys[statement.keyIndex++];
          switch (statement.varBinding) {
            case "none": {
              const assigmentExpr: AssignmentExpression = {
                type: "AssignmentExpression",
                leftValue: {
                  type: "Identifier",
                  name: statement.id
                } as Identifier,
                operator: "=",
                operand: {
                  type: "Literal",
                  value: propValue
                } as Literal
              } as AssignmentExpression;
              evalBinding(assigmentExpr, evalContext, thread);
              break;
            }

            case "const":
            case "let":
              {
                // --- Create a new variable in the innermost scope
                const block = innermostBlockScope(thread);
                if (!block) {
                  throw new Error("Missing block scope");
                }
                block.vars[statement.id] = propValue;
                if (statement.varBinding === "const") {
                  block.constVars ??= new Set<string>();
                  block.constVars.add(statement.id);
                }
              }
              break;
          }

          // --- Inject the loop body
          const loopScope = innermostLoopScope(thread);
          toUnshift = mapStatementsToQueueItems([
            statement.body,
            { ...statement }
          ]);

          // --- The next queue label is for "break"
          loopScope.breakLabel = thread.breakLabelValue ?? -1;

          // --- The guard action's label is for "continue"
          loopScope.continueLabel = toUnshift[1].label;
        } else {
          // --- The for..in loop is complete. Remove the loop's scope from the evaluation context
          releaseLoopScope(thread);
        }
      }
      break;

    case "ForOfStatement":
      if (!statement.guard) {
        // --- Get the object keys
        const iteratorObject = evalBinding(
          statement.expression,
          evalContext,
          thread
        );
        if (
          iteratorObject == null ||
          typeof iteratorObject[Symbol.iterator] !== "function"
        ) {
          // --- The object is not an iterator
          throw new Error("Object in for..of is not iterable");
        }

        // --- Init the loop with a new scope
        createLoopScope(thread, 1);

        // --- Create a new block for the loop variables
        thread.blocks ??= [];
        thread.blocks.push({ vars: {} });

        statement.iterator = iteratorObject[Symbol.iterator]();
        toUnshift = mapStatementsToQueueItems([{ ...statement, guard: true }]);
      } else {
        // --- Just for the sake of extra safety
        if (statement.iterator === undefined) {
          throw new Error("Iterator expected in for..of loop");
        }

        // --- Any iteration left?
        const nextIteration = statement.iterator.next();
        if (nextIteration.done) {
          // --- The for..of loop is complete. Remove the loop's scope from the evaluation context
          releaseLoopScope(thread);
          break;
        }

        // --- Set the binding variable to the next key
        const propValue = nextIteration.value;
        switch (statement.varBinding) {
          case "none": {
            const assigmentExpr: AssignmentExpression = {
              type: "AssignmentExpression",
              leftValue: {
                type: "Identifier",
                name: statement.id
              } as Identifier,
              operator: "=",
              operand: {
                type: "Literal",
                value: propValue
              } as Literal
            } as AssignmentExpression;
            evalBinding(assigmentExpr, evalContext, thread);
            break;
          }

          case "const":
          case "let":
            {
              // --- Create a new variable in the innermost scope
              const block = innermostBlockScope(thread);
              if (!block) {
                throw new Error("Missing block scope");
              }
              block.vars[statement.id] = propValue;
              if (statement.varBinding === "const") {
                block.constVars ??= new Set<string>();
                block.constVars.add(statement.id);
              }
            }
            break;
        }

        // --- Inject the loop body
        const loopScope = innermostLoopScope(thread);
        toUnshift = mapStatementsToQueueItems([
          statement.body,
          { ...statement }
        ]);

        // --- The next queue label is for "break"
        loopScope.breakLabel = thread.breakLabelValue ?? -1;

        // --- The guard action's label is for "continue"
        loopScope.continueLabel = toUnshift[1].label;
      }
      break;

    case "ThrowStatement": {
      throw new ThrowStatementError(
        evalBinding(statement.expression, evalContext, thread)
      );
    }

    case "TryStatement": {
      if (!statement.guard) {
        // --- Execute the try block
        toUnshift = provideTryBody(thread, createTryScope(thread, statement));
        break;
      }

      // --- Evaluate try
      const tryScope = innermostTryScope(thread);
      switch (tryScope.processingPhase) {
        case "error":
          // --- There was an error we may handle with catch
          clearToLabelBeforeUnshift = tryScope.tryLabel;
          switch (tryScope.errorSource) {
            case "try":
              // --- Remove the "try" block's scope
              thread.blocks!.pop();

              // --- Go on with catch or finally
              if (statement.catchBlock) {
                if (tryScope.statement.catchVariable) {
                  const block = innermostBlockScope(thread)!;
                  block.vars[tryScope.statement.catchVariable] =
                    tryScope.errorToThrow instanceof ThrowStatementError
                      ? tryScope.errorToThrow.errorObject
                      : tryScope.errorToThrow;
                }
                delete tryScope.errorToThrow;
                tryScope.processingPhase = "catch";
                toUnshift = provideCatchBody(thread, tryScope);
              } else if (tryScope.statement.finallyBlock) {
                // --- No catch, move on finally
                tryScope.processingPhase = "finally";
                toUnshift = provideFinallyBody(thread, tryScope);
              }
              break;
            case "catch":
              // --- Remove the "catch" block's scope
              thread.blocks!.pop();

              // --- Move to the finally block
              tryScope.processingPhase = "finally";
              toUnshift = provideFinallyBody(thread, tryScope);
              break;
            case "finally":
              // --- Remove the "finally" block's scope
              thread.blocks!.pop();

              // --- Move to the post finally execution
              tryScope.processingPhase = "postFinally";
              toUnshift = provideFinallyErrorBody(tryScope);
              break;
          }
          break;
        case "try":
          // --- We completed the try block successfully
          tryScope.processingPhase = "finally";
          if (statement.finallyBlock) {
            toUnshift = provideFinallyBody(thread, tryScope);
          }
          break;
        case "catch":
          // --- We completed the catch block successfully, remove the handled error
          tryScope.processingPhase = "finally";
          if (statement.finallyBlock) {
            toUnshift = provideFinallyBody(thread, tryScope);
          }
          break;
        case "finally":
          tryScope.processingPhase = "postFinally";
          toUnshift = provideFinallyErrorBody(tryScope);
          break;

        case "postFinally":
          // --- We completed the finally block successfully
          const innermostTry = thread.tryBlocks!.pop()!;

          // --- Is there any special exit type?
          switch (innermostTry.exitType) {
            case "break": {
              const loopScope = innermostLoopScope(thread);
              if (loopScope === undefined) {
                throw new Error("Missing loop scope");
              }
              releaseLoopScope(thread);
              clearToLabel = loopScope.breakLabel;
              break;
            }
            case "continue": {
              const loopScope = innermostLoopScope(thread);
              if (loopScope === undefined) {
                throw new Error("Missing loop scope");
              }

              clearToLabel = loopScope.continueLabel;
              releaseLoopScope(thread, false);
              break;
            }
            case "return":
              clearToLabel = -1;
              break;
          }

          // --- Should we raise an error?
          if (innermostTry.errorToThrow) {
            throw innermostTry.errorToThrow;
          }
          break;
      }
      break;
    }

    case "SwitchStatement": {
      // --- Create or get the loop's scope (guard is falsy for the first execution)
      if (statement.guard) {
        // --- Complete the switch
        releaseLoopScope(thread);
      } else {
        let loopScope = createLoopScope(thread);
        loopScope.isSwitch = true;
        thread.blocks!.push({ vars: {} });

        // --- Evaluate the switch value
        const switchValue = evalBinding(
          statement.expression,
          evalContext,
          thread
        );

        // --- Find the matching label
        let matchingIndex = -1;
        for (let i = 0; i < statement.cases.length; i++) {
          const currentCase = statement.cases[i];

          // --- Check for default case
          if (currentCase.caseExpression === undefined) {
            matchingIndex = i;
            break;
          }

          // --- Check for matching case
          const caseValue = evalBinding(
            currentCase.caseExpression,
            evalContext,
            thread
          );
          if (caseValue === switchValue) {
            matchingIndex = i;
            break;
          }
        }

        // --- Merge all statements from the matching label
        const statementFlow: Statement[] = [];
        if (matchingIndex >= 0) {
          for (let i = matchingIndex; i < statement.cases.length; i++) {
            statementFlow.push(...statement.cases[i].statements!);
          }
        }

        // --- Queue the statement flow and the guard
        const guardStatement = { ...statement, guard: true };
        toUnshift = mapStatementsToQueueItems([
          ...statementFlow,
          guardStatement
        ]);
        loopScope.breakLabel = toUnshift[toUnshift.length - 1].label;
      }
      break;
    }
  }

  // --- The statement may remove the innermost scope
  if (statement.removeBlockScope) {
    if (thread.blocks && thread.blocks.length > 0) {
      thread.blocks.pop();
    }
  }

  // --- Done.
  return { toUnshift, clearToLabel };
}

// --- Process a variable declaration
export function processDeclarations (
  block: BlockScope,
  evalContext: EvaluationContext,
  thread: LogicalThread,
  declarations: VarDeclaration[],
  addConst = false,
  useValue = false,
  baseValue = undefined
): void {
  for (let i = 0; i < declarations.length; i++) {
    let value: any;
    const decl = declarations[i];
    if (useValue) {
      value = baseValue;
    } else if (decl.expression) {
      //TODO illesg here, functionInvocation for global function (e.g. window.confirm... )
      value = evalBinding(decl.expression, evalContext, thread);
    }
    visitDeclaration(block, decl, value, addConst);
  }

  // --- Visit a variable
  function visitDeclaration (
    block: BlockScope,
    decl: VarDeclaration,
    baseValue: any,
    addConst: boolean
  ): void {
    // --- Process each declaration
    if (decl.id) {
      visitIdDeclaration(block, decl.id, baseValue, addConst);
    } else if (decl.arrayDestruct) {
      visitArrayDestruct(block, decl.arrayDestruct, baseValue, addConst);
    } else if (decl.objectDestruct) {
      visitObjectDestruct(block, decl.objectDestruct, baseValue, addConst);
    } else {
      throw new Error("Unknown declaration specifier");
    }
  }

  // --- Visits a single ID declaration
  function visitIdDeclaration (
    block: BlockScope,
    id: string,
    baseValue: any,
    addConst: boolean
  ): void {
    if (block.vars[id]) {
      throw new Error(
        `Variable ${id} is already declared in the current scope.`
      );
    }
    block.vars[id] = baseValue;
    if (addConst) {
      block.constVars ??= new Set<string>();
      block.constVars.add(id);
    }
  }

  // --- Visits an array destructure declaration
  function visitArrayDestruct (
    block: BlockScope,
    arrayD: ArrayDestructure[],
    baseValue: any,
    addConst: boolean
  ): void {
    for (let i = 0; i < arrayD.length; i++) {
      const arrDecl = arrayD[i];
      const value = baseValue?.[i];
      if (arrDecl.id) {
        visitIdDeclaration(block, arrDecl.id, value, addConst);
      } else if (arrDecl.arrayDestruct) {
        visitArrayDestruct(block, arrDecl.arrayDestruct, value, addConst);
      } else if (arrDecl.objectDestruct) {
        visitObjectDestruct(block, arrDecl.objectDestruct, value, addConst);
      }
    }
  }

  // --- Visits an object destructure declaration
  function visitObjectDestruct (
    block: BlockScope,
    objectD: ObjectDestructure[],
    baseValue: any,
    addConst: boolean
  ): void {
    for (let i = 0; i < objectD.length; i++) {
      const objDecl = objectD[i];
      const value = baseValue?.[objDecl.id!];
      if (objDecl.arrayDestruct) {
        visitArrayDestruct(block, objDecl.arrayDestruct, value, addConst);
      } else if (objDecl.objectDestruct) {
        visitObjectDestruct(block, objDecl.objectDestruct, value, addConst);
      } else {
        visitIdDeclaration(
          block,
          objDecl.alias ?? objDecl.id!,
          value,
          addConst
        );
      }
    }
  }
}
