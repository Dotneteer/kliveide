import type {
  CompilerOutput,
  IKliveCompiler,
  KliveCompilerOutput,
} from "@abstractions/CompilerInfo";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { SjasmPCompiler } from "@main/sjasmp-integration/SjasmPCompiler";
import { Z80Compiler } from "@main/z80-compiler/Z80Compiler";
import { ZxBasicCompiler } from "@main/zxb-integration/ZxBasicCompiler";

class CompilerRegistry {
  private _compilerRegistry: Record<string, IKliveCompiler> = {};

  /**
   * Registers the specified compiler
   * @param compiler Compiler to register
   */
  registerCompiler(compiler: IKliveCompiler): void {
    this._compilerRegistry[compiler.language] = compiler;
  }

  /**
   * Gets the specified Klive compiler
   * @param id Compiler ID
   */
  getCompiler(id: string): IKliveCompiler | undefined {
    return this._compilerRegistry[id];
  }
}

export function createCompilerRegistry(store: Store<AppState>): CompilerRegistry {
  const registry = new CompilerRegistry();
  registry.registerCompiler(new Z80Compiler());
  registry.registerCompiler(new ZxBasicCompiler());
  registry.registerCompiler(new SjasmPCompiler(store));
  return registry;
}

