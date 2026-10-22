import fs from "fs";
import path from "path";
import zlib from "zlib";

import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CompilerOutput } from "@abstractions/CompilerInfo";
import { getModelConfig } from "@common/machines/machine-registry";
import { Z88dkCompiler, type Z88dkBuildOutput, type ZccRunner } from "@main/z88dk-integration/Z88dkCompiler";
import { modelTypeToMachineType } from "@renderer/appIde/utils/compile-code";
import { isInjectableCompilerOutput } from "@renderer/appIde/utils/compiler-utils";

/*
 * Builds through the real `Z88dkCompiler` with a zcc stand-in that replays a committed fixture
 * (`test/z88dk/fixtures/`, zcc output): the compiler runs every step it runs for a real build - the
 * target and arguments, reading the image, the map and the artefacts, the line tables and the
 * source-level debug information - except starting zcc. CI never runs zcc (Z88DK plan §0.1).
 */

export const FIXTURES = path.join(__dirname, "fixtures");

export type ZccReplay = ZccRunner & { calls: string[][]; cwds: string[] };

/**
 * A zcc stand-in: copies a fixture's outputs to `-o`'s name (a gzipped map unpacked), prints
 * `stderr` and exits with `exitCode`.
 */
export function replay(fixture: string, run: { stderr?: string; exitCode?: number } = {}): ZccReplay {
  const calls: string[][] = [];
  const cwds: string[] = [];
  const runner = (async (_zcc, args, { cwd }) => {
    calls.push(args);
    cwds.push(cwd);
    const output = args[args.indexOf("-o") + 1];
    if ((run.exitCode ?? 0) === 0) {
      for (const file of fs.readdirSync(path.join(FIXTURES, fixture))) {
        if (!file.startsWith("program")) continue;
        const source = path.join(FIXTURES, fixture, file);
        if (file.endsWith(".map.gz")) {
          fs.writeFileSync(output + file.slice("program".length, -".gz".length), zlib.gunzipSync(fs.readFileSync(source)));
        } else {
          fs.copyFileSync(source, output + file.slice("program".length));
        }
      }
    }
    return { exitCode: run.exitCode ?? 0, stdout: "", stderr: run.stderr ?? "", timedOut: false };
  }) as ZccReplay;
  runner.calls = calls;
  runner.cwds = cwds;
  return runner;
}

/**
 * A project folder (under `temp`) with the fixture's C sources and an install-shaped z88dk folder,
 * and the app state of that project open on the machine and model.
 */
export function replayProject(
  temp: string,
  fixture: string,
  machineId = "sp48",
  settings: Record<string, unknown> = {},
  modelId?: string
) {
  const folder = path.join(temp, "project");
  fs.mkdirSync(folder, { recursive: true });
  for (const file of fs.readdirSync(path.join(FIXTURES, fixture))) {
    if (file.endsWith(".c")) fs.copyFileSync(path.join(FIXTURES, fixture, file), path.join(folder, file));
  }
  const root = path.join(temp, "z88dk");
  fs.mkdirSync(path.join(root, "bin"), { recursive: true });
  fs.mkdirSync(path.join(root, "lib", "config"), { recursive: true });
  fs.writeFileSync(path.join(root, "bin", process.platform === "win32" ? "zcc.exe" : "zcc"), "");
  const state: any = {
    project: { folderPath: folder, isKliveProject: true },
    emulatorState: { machineId, modelId, config: getModelConfig(machineId, modelId) ?? {} },
    userSettings: { z88dk: { root } },
    projectSettings: settings
  };
  return { folder, root, state, main: path.join(folder, "main.c") };
}

/** A build Run can deliver: what `injectCode` narrows the compiler's output to. */
export type TemplateBuild = Z88dkBuildOutput & CompilerOutput;

/**
 * A template built as the IDE builds it for Run (`build`) or Debug (`debug`) on a machine and model:
 * from the template's fixture of that profile (`tpl-x` is Debug's, `tpl-x-build` Run's). zcc must
 * have been given the fixture's own arguments, so a fixture never stands in for another build.
 */
export async function buildTemplate(
  temp: string,
  template: string,
  machineId: string,
  modelId?: string,
  profile: "build" | "debug" = "debug"
): Promise<TemplateBuild> {
  const fixture = profile === "build" ? `${template}-build` : template;
  const runner = replay(fixture);
  const compiler = new Z88dkCompiler(runner);
  const { state, main } = replayProject(temp, fixture, machineId, {}, modelId);
  compiler.setAppState(state);
  const out = (await compiler.compileFile(main, undefined, profile)) as Z88dkBuildOutput;
  const recorded = JSON.parse(fs.readFileSync(path.join(FIXTURES, fixture, "fixture.json"), "utf8")).zccArgs as string[];
  const passed = runner.calls[0]?.map((a, i, all) => (all[i - 1] === "-o" ? "program" : a));
  if (passed?.join(" ") !== recorded.join(" ")) {
    throw new Error(`${fixture}: zcc got '${passed?.join(" ")}', the fixture was built with '${recorded.join(" ")}'`);
  }
  const errors = (out.errors ?? []).filter((e) => !e.isWarning);
  if (errors.length) throw new Error(`${fixture} on ${machineId}/${modelId ?? "-"}: ${errors.map((e) => e.message).join("; ")}`);
  // --- The check `injectCode` makes before it delivers anything
  if (!isInjectableCompilerOutput(out)) throw new Error(`${fixture}: the build is not injectable`);
  return out as TemplateBuild;
}

/**
 * The code Run injects, built from the compiler's output exactly as `injectCode`
 * (`KliveCompilerCommands.ts`) builds it for a non-unit-test run.
 */
export function codeToInjectOf(out: TemplateBuild): CodeToInject {
  return {
    model: modelTypeToMachineType(out.modelType!)!,
    entryAddress: out.entryAddress,
    subroutine: out.injectOptions["subroutine"],
    segments: out.segments.map((s) => ({
      startAddress: s.startAddress,
      bank: s.bank,
      bankOffset: s.bankOffset ?? 0,
      emittedCode: s.emittedCode
    })),
    options: out.injectOptions
  };
}
