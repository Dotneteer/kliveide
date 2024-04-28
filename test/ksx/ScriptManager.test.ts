import { describe, it, expect, assert } from "vitest";
import { EvaluationContext } from "@common/ksx/EvaluationContext";
import { createMainScriptManager } from "@main/ksx-runner/MainScriptManager";
import { ScriptStartInfo } from "@abstractions/IScriptManager";

describe("KSX ScriptManager", () => {
  it("Run works with new file", async () => {
    // --- Arrange
    const sm = createMainScriptManager(prepareScript, execScript);

    // --- Act
    const startInfo = await sm.runScript("test1");

    // --- Assert
    let scripts = sm.getScriptsStatus();
    expect(startInfo.target).toBeUndefined();
    expect(startInfo.contents).toBeUndefined();
    expect(startInfo.id).toBeGreaterThan(0);
    expect(scripts.length).toBe(1);
    expect(scripts[0].status).toBe("pending");

    // --- Cleanup
    await sm.stopScript(startInfo.id);
    scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(1);
    expect(scripts[0].status).toBe("stopped");
  });

  it("Run works with multiple files", async () => {
    // --- Arrange
    const sm = createMainScriptManager(prepareScript, execScript);

    // --- Act
    const id1 = (await sm.runScript("test1")).id;
    const id2 = (await sm.runScript("test2")).id;
    const id3 = (await sm.runScript("test3")).id;

    // --- Assert
    let scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(3);
    expect(scripts[0].status).toBe("pending");
    expect(scripts[1].status).toBe("pending");
    expect(scripts[2].status).toBe("pending");

    // --- Cleanup
    await sm.stopScript(id1);
    scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(3);
    expect(scripts[0].status).toBe("stopped");

    await sm.stopScript(id3);
    scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(3);
    expect(scripts[2].status).toBe("stopped");

    await sm.stopScript(id2);
    scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(3);
    expect(scripts[1].status).toBe("stopped");
  });
});

let errorScript = "";

async function prepareScript(scriptFile: string, scriptId: number): Promise<ScriptStartInfo> {
  return {
    id: scriptId
  };
}

async function execScript(
  _scriptFile: string,
  _scriptContent: string,
  evalContext: EvaluationContext
) {
  for (let i = 0; i < 10; i++) {
    if (evalContext?.cancellationToken?.cancelled) {
      break;
    }
    if (errorScript) {
      throw new Error(errorScript);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
