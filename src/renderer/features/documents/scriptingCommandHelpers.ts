import { PANE_ID_SCRIPTIMG } from "@common/integration/constants";
import type { ScriptRunInfo } from "@common/abstractions/ScriptRunInfo";
import { isScriptCompleted } from "@common/utils/script-utils";
import type { IIdeCommandService } from "@renderer/abstractions/IIdeCommandService";
import type { IScriptService } from "@renderer/abstractions/IScriptService";

export function findRunningScript(
  scripts: ScriptRunInfo[] | undefined,
  path: string
): ScriptRunInfo | undefined {
  return scripts
    ?.slice()
    .reverse()
    .find((s) => s.scriptFileName === path && !isScriptCompleted(s.status));
}

export async function runScript(
  ideCommandsService: IIdeCommandService,
  scriptService: IScriptService,
  path: string
): Promise<void> {
  await ideCommandsService.executeCommand(`outp ${PANE_ID_SCRIPTIMG}`);
  const runResult = await ideCommandsService.executeCommand(`script-run "${path}"`);

  if (runResult.success) {
    await waitForScriptStart();
    await showScriptOutput(ideCommandsService, scriptService, path);
  }
}

export async function stopScript(
  ideCommandsService: IIdeCommandService,
  path: string
): Promise<void> {
  await ideCommandsService.executeCommand(`outp ${PANE_ID_SCRIPTIMG}`);
  await ideCommandsService.executeCommand(`script-cancel "${path}"`);
}

export async function showScriptOutput(
  ideCommandsService: IIdeCommandService,
  scriptService: IScriptService,
  path: string
): Promise<void> {
  const scriptId = scriptService.getLatestScriptId(path);
  if (scriptId > 0) {
    await ideCommandsService.executeCommand(`script-output ${scriptId}`);
  }
}

function waitForScriptStart(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 100));
}
