import type { SourceAnnotation } from "@abstractions/CompilerInfo";

/*
 * The part of a compilation a unit-test run needs, as plain data (`.plans/Z80_UNIT_TESTS_PLAN.md`
 * D6): it crosses into a `worker_threads` worker by structured clone, which a live
 * `AssemblerOutput` - class instances, parent links, a `Map` keyed by objects - does not survive
 * intact. Symbols keep only what discovery and conditions read.
 */

/** A symbol as discovery and conditions read it */
export type RunnableSymbol = {
  name?: string;
  writtenName?: string;
  type?: number;
  value?: { _type?: number; _value?: unknown };
  partition?: number;
  definitionFileIndex?: number;
  definitionLine?: number;
};

/** A module's symbols and modules */
export type RunnableModule = {
  writtenName?: string;
  symbols: Record<string, RunnableSymbol>;
  nestedModules: Record<string, RunnableModule>;
};

/** What a run needs of a compilation */
export type RunnableCompilation = RunnableModule & {
  modelType?: number;
  segments: { bank?: number; bankOffset?: number; startAddress: number; emittedCode: number[] }[];
  sourceFileList: { filename: string }[];
  listFileItems: { fileIndex: number; lineNumber: number; segmentIndex?: number; address: number }[];
  debugAnnotations: SourceAnnotation[];
};

type ModuleLike = {
  writtenName?: string;
  symbols?: Record<string, unknown>;
  nestedModules?: Record<string, ModuleLike>;
};

function moduleOf(source: ModuleLike | undefined, depth = 0): RunnableModule {
  const symbols: Record<string, RunnableSymbol> = {};
  for (const [key, raw] of Object.entries(source?.symbols ?? {})) {
    const s = raw as RunnableSymbol & { value?: { _type?: number; _value?: unknown } };
    const value = s?.value;
    symbols[key] = {
      ...(s?.name !== undefined ? { name: s.name } : {}),
      ...(s?.writtenName !== undefined ? { writtenName: s.writtenName } : {}),
      ...(s?.type !== undefined ? { type: s.type } : {}),
      ...(value && (typeof value._value === "number" || typeof value._value === "string" || typeof value._value === "boolean")
        ? { value: { _type: value._type, _value: value._value } }
        : {}),
      ...(s?.partition !== undefined ? { partition: s.partition } : {}),
      ...(s?.definitionFileIndex !== undefined ? { definitionFileIndex: s.definitionFileIndex } : {}),
      ...(s?.definitionLine !== undefined ? { definitionLine: s.definitionLine } : {})
    };
  }
  const nestedModules: Record<string, RunnableModule> = {};
  if (depth < 32) {
    for (const [key, module] of Object.entries(source?.nestedModules ?? {})) {
      nestedModules[key] = moduleOf(module, depth + 1);
    }
  }
  return { ...(source?.writtenName ? { writtenName: source.writtenName } : {}), symbols, nestedModules };
}

/** The plain-data copy of a compilation a run takes */
export function toRunnableCompilation(output: unknown): RunnableCompilation {
  const o = (output ?? {}) as ModuleLike & {
    modelType?: number;
    segments?: { bank?: number; bankOffset?: number; startAddress: number; emittedCode: ArrayLike<number> }[];
    sourceFileList?: { filename: string }[];
    listFileItems?: { fileIndex: number; lineNumber: number; segmentIndex?: number; address: number }[];
    debugAnnotations?: SourceAnnotation[];
  };
  return {
    ...moduleOf(o),
    ...(o.modelType !== undefined ? { modelType: o.modelType } : {}),
    segments: (o.segments ?? []).map((s) => ({
      ...(s.bank !== undefined ? { bank: s.bank } : {}),
      ...(s.bankOffset !== undefined ? { bankOffset: s.bankOffset } : {}),
      startAddress: s.startAddress,
      emittedCode: Array.from(s.emittedCode ?? [])
    })),
    sourceFileList: (o.sourceFileList ?? []).map((f) => ({ filename: f.filename })),
    listFileItems: (o.listFileItems ?? []).map((li) => ({
      fileIndex: li.fileIndex,
      lineNumber: li.lineNumber,
      address: li.address,
      ...(li.segmentIndex !== undefined ? { segmentIndex: li.segmentIndex } : {})
    })),
    debugAnnotations: (o.debugAnnotations ?? []).map((a) => ({ ...a }))
  };
}
