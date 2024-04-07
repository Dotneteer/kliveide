import { EvaluationContext, ModuleResolver, PackageResolver } from "./EvaluationContext";
import { Parser } from "./Parser";
import { ErrorCodes, ParserErrorMessage, errorMessages } from "./ParserError";
import { TokenType } from "./TokenType";
import {
  processStatementQueueAsync,
  visitLetConstDeclarations
} from "./process-statement-async";
import {
  ArrowExpression,
  FunctionDeclaration,
  ImportDeclaration,
  Statement
} from "./source-tree";

/**
 * Represents a parsed and resolved KSX module
 */
export type KsxModule = {
  type: "KsxModule";
  name: string;
  parent?: KsxModule;
  exports: Record<string, any>;
  imports: Record<string, any>;
  importedModules: KsxModule[];
  functions: Record<string, FunctionDeclaration>;
  statements: Statement[];
  executed: boolean;
};

/**
 * Represents a module error
 */
export type ModuleErrors = Record<string, ParserErrorMessage[]>;

/**
 * Checks if the result is a module error
 * @param result Result to check
 * @returns True if the result is a module error
 */
export function isModuleErrors (
  result: KsxModule | ModuleErrors
): result is ModuleErrors {
  return (result as any).type !== "KsxModule";
}

/**
 * Parses a KSX module
 * @param source Source code to parse
 * @param moduleResolver A function that resolves a module path to the text of the module
 * @returns The parsed and resolved module
 */
export async function parseKsxModule (
  moduleName: string,
  source: string,
  moduleResolver: ModuleResolver,
  packageResolver: PackageResolver = async (packageName: string) => null
): Promise<KsxModule | ModuleErrors> {
  // --- Keep track of parsed modules to avoid circular references
  const parsedModules = new Map<string, KsxModule>();
  const moduleErrors: ModuleErrors = {};

  const parsedModule = await doParseModule(moduleName, source, moduleResolver, packageResolver);
  return !parsedModule || Object.keys(moduleErrors).length > 0
    ? moduleErrors
    : parsedModule;

  // --- Do the parsing, allow recursion
  async function doParseModule (
    moduleName: string,
    source: string,
    moduleResolver: ModuleResolver,
    packageResolver: PackageResolver
  ): Promise<KsxModule | null | undefined> {
    // --- Do not parse the same module twice
    if (parsedModules.has(moduleName)) {
      return parsedModules.get(moduleName);
    }

    // --- Step 1: Parse the source code
    const parser = new Parser(source);
    let statements: Statement[] = [];
    try {
      statements = parser.parseStatements()!;
    } catch (error) {
      moduleErrors[moduleName] = parser.errors;
      return null;
    }

    // --- Check for unparsed tail
    const lastToken = parser.current;
    if (lastToken.type !== TokenType.Eof) {
      moduleErrors[moduleName] ??= [];
      moduleErrors[moduleName].push({
        code: "K002",
        text: errorMessages["K002"].replace(/\{(\d+)}/g, () => lastToken.text),
        position: lastToken.location.startLine,
        line: lastToken.location.startLine,
        column: lastToken.location.startColumn
      });
      return null;
    }

    const errors: ParserErrorMessage[] = [];

    // --- Step 2: Hoist functions
    const functions: Record<string, FunctionDeclaration> = {};
    statements
      .filter(stmt => stmt.type === "FunctionDeclaration")
      .forEach(stmt => {
        const func = stmt as FunctionDeclaration;
        if (functions[func.name]) {
          errors.push(addErrorMessage("K023", stmt, func.name));
          return;
        }
        functions[func.name] = func;
      });

    // --- Step 3: collect exports
    const exports: Record<string, any> = {};
    statements.forEach(stmt => {
      if (stmt.type === "ConstStatement" && stmt.isExported) {
        visitLetConstDeclarations(stmt, id => {
          if (exports[id]) {
            errors.push(addErrorMessage("K024", stmt, id));
          } else {
            exports[id] = stmt;
          }
        });
      } else if (stmt.type === "FunctionDeclaration" && stmt.isExported) {
        if (exports[stmt.name]) {
          errors.push(addErrorMessage("K024", stmt, stmt.name));
        } else {
          exports[stmt.name] = stmt;
        }
      }
    });

    // --- Successful module parsing
    const parsedModule: KsxModule = {
      type: "KsxModule",
      name: moduleName,
      exports,
      importedModules: [],
      imports: [],
      functions,
      statements,
      executed: false
    };

    // --- Sign this module as parsed
    parsedModules.set(moduleName, parsedModule);

    // --- Step 4: Load imported modules and resolve imports
    const importedModules: KsxModule[] = [];
    const imports: Record<string, any> = {};
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.type !== "ImportDeclaration") {
        continue;
      }

      // --- Use these exports
      let exportsToUse: Record<string, any> = {};

      // // --- Find the imported package
      // if (stmt.moduleFile.startsWith("@")) {
      //   const packageContent = await packageResolver(stmt.moduleFile.substring(1));
      //   if (packageContent === null) {
      //     errors.push(addErrorMessage("K027", stmt, stmt.moduleFile));
      //     continue;
      //   }

      //   // --- Successful import
      //   importedModules.push(packageModule);

      //   // --- Extract imported names
      //   for (const key in stmt.imports) {
      //     if (packageModule.exports.has(stmt.imports[key])) {
      //       imports[key] = packageModule.exports.get(stmt.imports[key]);
      //     } else {
      //       errors.push(addErrorMessage("K026", stmt, stmt.moduleFile, key));
      //     }
      //   }

      //   continue;
      // }

      // --- Find the imported module
      const source = await moduleResolver(stmt.moduleFile);
      if (source === null) {
        errors.push(addErrorMessage("K025", stmt, stmt.moduleFile));
        continue;
      }

      // --- Parse the imported module
      const imported = await doParseModule(
        stmt.moduleFile,
        source,
        moduleResolver,
        packageResolver
      );

      if (!imported) {
        // --- Error in the imported module
        return;
      }

      // --- Successful import
      exportsToUse = imported.exports;
      importedModules.push(imported);

      // --- Extract imported names
      for (const key in stmt.imports) {
        const importedValue = exportsToUse[stmt.imports[key]];
        if (importedValue !== undefined) {
          imports[key] = importedValue;
        } else {
          errors.push(addErrorMessage("K026", stmt, stmt.moduleFile, key));
        }
      }
    }

    // --- Catch errors
    if (errors.length > 0) {
      moduleErrors[moduleName] = errors;
      return null;
    }

    // --- All imported modules use this module as a parent
    importedModules.forEach(m => (m.parent = parsedModule));

    // --- Done.
    parsedModule.importedModules = importedModules;
    parsedModule.imports = imports;
    return parsedModule;
  }

  function addErrorMessage (
    code: ErrorCodes,
    stmt: Statement,
    ...args: any[]
  ): ParserErrorMessage {
    let errorText = errorMessages[code];
    if (args) {
      args.forEach(
        (o, idx) =>
          (errorText = errorText.replaceAll(`{${idx}}`, args[idx].toString()))
      );
    }
    return {
      code,
      text: errorMessages[code].replace(/\{(\d+)}/g, (_, index) => args[index]),
      position: stmt.startPosition,
      line: stmt.startLine,
      column: stmt.startColumn
    };
  }
}

/**
 * Executes a parsed module
 * @param module Parsed module
 * @param moduleResolver A function that resolves a module path to the text of the module
 */
export async function executeModule (
  module: KsxModule,
  evaluationContext: EvaluationContext
): Promise<void> {
  // --- Get the top-level BlockScope with its "vars" and "constVars" properties
  const blockScope = evaluationContext.mainThread.blocks;
  if (!blockScope || blockScope.length === 0) {
    throw new Error("Top-level BlockScope not found");
  }
  blockScope[0].vars ??= {};
  const topVars = blockScope[0].vars;
  blockScope[0].constVars ??= new Set<string>();
  const topConst = blockScope[0].constVars;

  // --- Convert hoisted functions to ArrowExpressions
  for (const functionDecl of Object.values(module.functions)) {
    const arrowExpression = {
      type: "ArrowExpression",
      args: functionDecl.args,
      statement: functionDecl.statement,
      _ARROW_EXPR_: true
    } as unknown as ArrowExpression;

    // --- Store the compiled functions in the to-level BlockScope
    if (topVars[functionDecl.name]) {
      throw new Error(`Function ${functionDecl.name} already exists`);
    }
    topVars[functionDecl.name] = arrowExpression;
    topConst.add(functionDecl.name);
  }

  // --- Load imported modules
  module.statements
    .filter(stmt => stmt.type === "ImportDeclaration")
    .forEach((stmt: ImportDeclaration) => {
      stmt.module = module.importedModules.find(
        m => m.name === stmt.moduleFile
      );
      if (!stmt.module) {
        throw new Error(`Imported module '${stmt.moduleFile}' not found`);
      }
    });

  // --- Run the module
  await processStatementQueueAsync(module.statements, evaluationContext);
  module.executed = true;

  // --- Get exported values
  for (const key in module.exports) {
    if (!(key in topVars)) {
      throw new Error(`Export ${key} not found`);
    }
    module.exports[key] = topVars[key];
  }
}
