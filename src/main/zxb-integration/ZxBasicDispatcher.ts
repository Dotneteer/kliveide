import type { IKliveCompiler, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";

import { createSettingsReader } from "@common/utils/SettingsReader";
import { KBasicCompiler } from "@main/kbasic/KBasicCompiler";
import { ZxBasicCompiler } from "./ZxBasicCompiler";
import { ZXBC_COMPILER } from "./zxb-config";

export type ZxBasicCompilerChoice = "klive" | "zxbc";

/** The compiler the `zxbasic.compiler` setting selects; the external `zxbc` until Klive BASIC is complete (plan §12.1, D9). */
export function selectedZxBasicCompiler(state: AppState | undefined): ZxBasicCompilerChoice {
  const value = state ? createSettingsReader(state).readSetting(ZXBC_COMPILER) : undefined;
  return typeof value === "string" && value.trim().toLowerCase() === "klive" ? "klive" : "zxbc";
}

/**
 * Registered for `zxbas`: hands each request to Klive BASIC or to the external ZX BASIC compiler,
 * as the `zxbasic.compiler` setting says.
 */
export class ZxBasicDispatcher implements IKliveCompiler {
  private state: AppState | undefined;
  private readonly klive = new KBasicCompiler();
  private readonly zxbc = new ZxBasicCompiler();

  readonly id = "ZxBasicDispatcher";
  readonly language = "zxbas";
  readonly providesKliveOutput = true;

  setAppState(state: AppState): void {
    this.state = state;
    this.klive.setAppState(state);
    this.zxbc.setAppState(state);
  }

  compileFile(filename: string, options?: Record<string, any>): Promise<KliveCompilerOutput> {
    return this.current().compileFile(filename, options);
  }

  checkFile(filename: string): Promise<KliveCompilerOutput> {
    return selectedZxBasicCompiler(this.state) === "klive"
      ? this.klive.checkFile(filename)
      : this.zxbc.compileFile(filename);
  }

  lineCanHaveBreakpoint(line: string): Promise<boolean> {
    return this.current().lineCanHaveBreakpoint(line);
  }

  private current(): IKliveCompiler {
    return selectedZxBasicCompiler(this.state) === "klive" ? this.klive : this.zxbc;
  }
}
