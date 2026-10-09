import fs from "fs";
import path from "path";

import type { Action } from "@common/state/Action";
import type {
  UnitTestEvent,
  UnitTestResult,
  UnitTestRunOptions,
  UnitTestRunRequest,
  UnitTestRunResponse
} from "@common/unit-tests/unitTestTypes";
import { MI_ZXNEXT } from "@common/machines/constants";
import { discoverUnitTests } from "@common/unit-tests/discovery";
import { toRunnableCompilation, type RunnableCompilation } from "@common/unit-tests/runnableCompilation";
import { selectTests } from "@common/unit-tests/unitTestTypes";
import {
  unitTestEventAction,
  unitTestsRunEndedAction,
  unitTestsRunStartedAction
} from "@common/state/actions";
import { mainStore } from "@main/main-store";
import { artifactNameOf, unsupportedMachineMessage } from "./unitTestMachines";
import { startUnitTestWorker, type UnitTestWorkerRun } from "./runUnitTestWorker";
import { readUnitTestSettings } from "./unitTestProjectSettings";
import { findWasmArtifact } from "./wasmArtifacts";
import { UNIT_TEST_LANGUAGES } from "./addUnitTestSupport";

/*
 * The main process's side of a unit-test run (`.plans/Z80_UNIT_TESTS_PLAN.md` D6, D14, D15, D19):
 * it keeps the last build, resolves the machine, the project settings, the core and the ROM folder
 * (T11), starts the worker and turns its events into store actions every window sees.
 */

/** The last build the IDE asked for */
let lastBuild: { filename: string; language: string; compilation: RunnableCompilation; failed: boolean } | undefined;

/** The run in progress */
let currentRun: UnitTestWorkerRun | undefined;

/** Keeps a build for the next run (only the data a run reads) */
export function rememberCompilation(filename: string, language: string, output: unknown): void {
  const errors = (output as { errors?: { isWarning?: boolean }[] })?.errors ?? [];
  lastBuild = {
    filename,
    language,
    compilation: toRunnableCompilation(output),
    failed: errors.some((e) => !e.isWarning)
  };
}

/** Stops the run in progress */
export function cancelUnitTestRun(): void {
  currentRun?.cancel();
}

/** The options of a run: the request's, over the project's `unitTests` section (D19) */
export function runOptionsFor(
  request: UnitTestRunRequest,
  settings: ReturnType<typeof readUnitTestSettings>,
  machineId: string
): UnitTestRunOptions {
  const options = request.options ?? {};
  const include = options.include ?? (options.ids ? undefined : settings?.include);
  return {
    ...options,
    ...(include ? { include } : {}),
    timeoutSeconds: options.timeoutSeconds ?? settings?.timeout ?? 1,
    // --- A Next program usually pages the ROM out: reset only, unless the project says otherwise (D7)
    boot: options.boot ?? settings?.boot ?? (machineId === MI_ZXNEXT ? "none" : "rom")
  };
}

/**
 * Runs the last build's tests; resolves when the run ends
 * @param request Which tests, and how
 * @param dispatch Dispatches the store actions every window sees
 */
export async function runUnitTestsInWorker(
  request: UnitTestRunRequest,
  dispatch: (action: Action) => void
): Promise<UnitTestRunResponse> {
  const response: UnitTestRunResponse = {
    summary: { total: 0, passed: 0, failed: 0, errors: 0 },
    results: [],
    problems: []
  };
  const refuse = (problem: string) => {
    response.problems.push(problem);
    dispatch(unitTestsRunStartedAction([], Date.now()));
    dispatch(unitTestsRunEndedAction(Date.now(), problem));
    return response;
  };

  if (currentRun) return refuse("A unit-test run is in progress already.");
  if (!lastBuild) return refuse("Build the project first: the tests come from the last build.");
  if (lastBuild.failed) return refuse("The last build failed; fix its errors and run the tests again.");
  if (!UNIT_TEST_LANGUAGES.includes(lastBuild.language)) {
    return refuse(
      "The build root's language has no DeZog-style unit tests; they need the Klive Z80 assembler or sjasmplus."
    );
  }

  const state = mainStore.getState();
  const projectFolder = state.project?.folderPath;
  const settings = readUnitTestSettings(projectFolder);
  const emulatorMachine = state.emulatorState?.machineId;
  const machineId = settings?.machine ?? emulatorMachine;
  const sameMachine = machineId === emulatorMachine;
  const modelId = settings?.model ?? (sameMachine ? state.emulatorState?.modelId : undefined);
  const unsupported = unsupportedMachineMessage(machineId);
  if (unsupported || !machineId) return refuse(unsupported ?? "No machine is selected.");
  response.machineId = machineId;

  const options = runOptionsFor(request, settings, machineId);
  const program = discoverUnitTests(lastBuild.compilation, machineId);
  if (!program.labels) {
    return refuse(program.problems[0] ?? "The last build has no unit tests.");
  }
  const selected = selectTests(program.tests, options);

  const artifactName = artifactNameOf(machineId);
  // --- A packaged app's plain copy in its resources first, then the development tree or the asar
  const artifactPath = findWasmArtifact(artifactName, __dirname, process.resourcesPath);
  if (!artifactPath) return refuse(`The ${artifactName} machine core was not found next to the app.`);
  const publicFolder = process.env.PUBLIC ?? path.join(__dirname, "../renderer");

  dispatch(unitTestsRunStartedAction(selected.map((t) => t.id), Date.now()));
  const results: UnitTestResult[] = [];
  try {
    currentRun = startUnitTestWorker(
      {
        compilation: lastBuild.compilation,
        machineId,
        ...(modelId ? { modelId } : {}),
        ...(sameMachine && state.emulatorState?.config ? { config: state.emulatorState.config } : {}),
        options,
        artifact: new Uint8Array(fs.readFileSync(artifactPath)),
        publicFolder
      },
      (event: UnitTestEvent) => {
        switch (event.kind) {
          case "log":
            // --- Log lines travel inside their result; a busy logpoint must not flood the store
            return;
          case "result":
            results.push(event.result);
            break;
          case "problem":
            response.problems.push(event.message);
            break;
          case "finished":
            response.summary = event.summary;
            if (event.coverage) response.coverage = event.coverage;
            // --- The coverage stays out of the store: it goes to the IDE in the response
            dispatch(unitTestEventAction({ kind: "finished", summary: event.summary }));
            return;
        }
        dispatch(unitTestEventAction(event));
      }
    );
    response.summary = await currentRun.done;
  } catch (err) {
    response.problems.push(err instanceof Error ? err.message : String(err));
  } finally {
    currentRun = undefined;
    dispatch(unitTestsRunEndedAction(Date.now()));
  }
  response.results = results;
  return response;
}
