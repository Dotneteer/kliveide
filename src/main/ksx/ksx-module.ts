import { Parser } from "./Parser";
import { ErrorCodes, ParserErrorMessage, errorMessages } from "./ParserError";
import { visitLetConstDeclarations } from "./process-statement-async";
import { FunctionDeclaration, Statement } from "./source-tree";

/**
 * Represents a parsed and resolved KSX module
 */
export type KsxModule = {
  type: "KsxModule";
  name: string;
  exports: Set<string>;
  importedModules: KsxModule[];
  imports: Record<string, any>;
  functions: Record<string, FunctionDeclaration>;
  statements: Statement[];
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
 *
 * @param source Source code to parse
 * @param moduleResolver A function that resolves a module path to the text of the module
 * @returns The parsed and resolved module
 */
export async function parseKsxModule (
  moduleName: string,
  source: string,
  moduleResolver: (moduleName: string) => Promise<string>
): Promise<KsxModule | ModuleErrors | null> {
  // --- Keep track of parsed modules to avoid circular references
  const parsedModules = new Map<string, KsxModule>();
  const moduleErrors: ModuleErrors = {};

  const parsedModule = await doParseModule(moduleName, source, moduleResolver);
  return !parsedModule || Object.keys(moduleErrors).length > 0
    ? moduleErrors
    : parsedModule;

  // --- Do the parsing, allow recursion
  async function doParseModule (
    moduleName: string,
    source: string,
    moduleResolver: (moduleName: string) => Promise<string | null>
  ): Promise<KsxModule | null> {
    // --- Do not parse the same module twice
    if (parsedModules.has(moduleName)) {
      return parsedModules.get(moduleName);
    }

    // --- Step 1: Parse the source code
    const parser = new Parser(source);
    let statements: Statement[] = [];
    try {
      statements = parser.parseStatements();
    } catch (err) {
      moduleErrors[moduleName] = parser.errors;
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
    const exports = new Set<string>();
    statements.forEach(stmt => {
      if (stmt.type === "ConstStatement" && stmt.isExported) {
        visitLetConstDeclarations(stmt, id => {
          if (exports.has(id)) {
            errors.push(addErrorMessage("K024", stmt, id));
          } else {
            exports.add(id);
          }
        });
      } else if (stmt.type === "FunctionDeclaration" && stmt.isExported) {
        if (exports.has(stmt.name)) {
          errors.push(addErrorMessage("K024", stmt, stmt.name));
        } else {
          exports.add(stmt.name);
        }
      }
    });

    // --- Step 4: Load imported modules and resolve imports
    const importedModules: KsxModule[] = [];
    const imports: Record<string, any> = {};
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.type !== "ImportDeclaration") {
        continue;
      }

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
        moduleResolver
      );

      if (!imported) {
        // --- Error in the imported module
        return;
      }

      // --- Successful import
      importedModules.push(imported);

      // --- Extract imported names
      for (const key in stmt.imports) {
        if (imported.exports.has(stmt.imports[key])) {
          imports[key] = stmt.imports[key];
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

    // --- Successful module parsing
    const parsedModule: KsxModule = {
      type: "KsxModule",
      name: moduleName,
      exports,
      importedModules,
      imports,
      functions,
      statements
    };

    // --- Sign this module as parsed
    parsedModules.set(moduleName, parsedModule);

    // --- Done.
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
      text: errorMessages[code].replace(
        /\{(\d+)\}/g,
        (match, index) => args[index]
      ),
      position: stmt.startPosition,
      line: stmt.startLine,
      column: stmt.startColumn
    };
  }
}
