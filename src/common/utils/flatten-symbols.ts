/*
 * A compilation's symbols with its modules' symbols included (`.plans/Z80_UNIT_TESTS_PLAN.md` T4).
 *
 * The Klive assembler keeps a module's symbols in that module (`nestedModules`), so a reader of the
 * root `symbols` alone never saw `Module1.UT_test2`. This walk adds them under their dotted name, the
 * name DeZog's conventions and Klive's conditions write them with. Root symbols win over a dotted
 * name that happens to collide. sjasmplus output has no `nestedModules`: its SLD symbols are dotted
 * already. Dependency-free and works on plain (serialized) objects as well as live outputs.
 */

/** The shape of a compilation's symbol tables, as far as this walk needs it */
export type SymbolTables = {
  symbols?: Record<string, unknown>;
  nestedModules?: Record<string, SymbolTables>;
};

/** One flattened symbol: the table entry, and the module path it was found in */
export type FlatSymbol = {
  /** The table entry (an `AssemblySymbolInfo`, or its plain copy) */
  info: unknown;
  /** The module keys from the root, `[]` for a root symbol */
  modulePath: string[];
  /** The symbol's key in its own table */
  key: string;
};

/** Every symbol, keyed by its dotted name (module keys and the symbol key joined with dots) */
export function flattenSymbolEntries(output: SymbolTables | undefined): Map<string, FlatSymbol> {
  const result = new Map<string, FlatSymbol>();
  const visit = (tables: SymbolTables | undefined, path: string[], depth: number) => {
    if (!tables || depth > 32) return;
    for (const [key, info] of Object.entries(tables.symbols ?? {})) {
      const name = [...path, key].join(".");
      if (!result.has(name)) result.set(name, { info, modulePath: path, key });
    }
    for (const [moduleKey, module] of Object.entries(tables.nestedModules ?? {})) {
      visit(module, [...path, moduleKey], depth + 1);
    }
  };
  visit(output, [], 0);
  return result;
}

/** The symbol tables flattened into one record keyed by dotted name, root symbols first */
export function flattenSymbols(output: SymbolTables | undefined): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, entry] of flattenSymbolEntries(output)) result[name] = entry.info;
  return result;
}
