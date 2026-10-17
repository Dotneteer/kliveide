import type { CompileProfile, IKliveCompiler, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";

import { BorielCompiler } from "@main/boriel-integration/BorielCompiler";
import { KBasicCompiler } from "@main/kbasic/KBasicCompiler";
import { selectedZxBasicCompiler } from "./zxb-config";

/**
 * Registered for `zxbas`: hands each request to Klive BASIC or to Boriel BASIC 2.x, as the
 * `zxbasic.compiler` setting says (`.plans/BORIEL_BASIC_INTEGRATION_PLAN.md` B1).
 */
export class ZxBasicDispatcher implements IKliveCompiler {
  private state: AppState | undefined;
  private readonly klive = new KBasicCompiler();
  private readonly boriel = new BorielCompiler();

  readonly id = "ZxBasicDispatcher";
  readonly language = "zxbas";
  readonly providesKliveOutput = true;

  setAppState(state: AppState): void {
    this.state = state;
    this.klive.setAppState(state);
    this.boriel.setAppState(state);
  }

  compileFile(filename: string, options?: Record<string, any>, profile?: CompileProfile): Promise<KliveCompilerOutput> {
    return this.current().compileFile(filename, options, profile);
  }

  checkFile(filename: string): Promise<KliveCompilerOutput> {
    return selectedZxBasicCompiler(this.state) === "boriel"
      ? this.boriel.checkFile(filename)
      : this.klive.checkFile(filename);
  }

  lineCanHaveBreakpoint(line: string): Promise<boolean> {
    return this.current().lineCanHaveBreakpoint(line);
  }

  private current(): IKliveCompiler {
    return selectedZxBasicCompiler(this.state) === "boriel" ? this.boriel : this.klive;
  }
}
