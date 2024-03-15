import { ConstStatement, FunctionDeclaration, Statement } from "./source-tree";

/**
 * Represents a parsed and resolved KSX module
 */
export type KsxModule = {
  exports: Record<string, FunctionDeclaration | ConstStatement>;
  imports: Record<string, any>;
  functions: Record<string, FunctionDeclaration>;
  statements: Statement[];
};

/**
 * 
 * @param source Source code to parse
 * @param moduleResolver A function that resolves a module path to the text of the module
 * @returns The parsed and resolved module
 */
export async function parseKsxModule (
  source: string,
  moduleResolver: (moduleName: string) => Promise<string>
): Promise<KsxModule> {
  // TODO: Implement the code
  // --- Step 1: Parse the source code
  // --- Step 2: Hoist functions
  // --- Step 3: collect exports
  // --- Step 4: Resolve imports
  return {
    exports: {},
    imports: {},
    functions: {},
    statements: []
  };
}
