import "mocha";
import { expect } from "expect";
import assert from "assert";
import { EvaluationContext } from "@main/ksx/EvaluationContext";
import { createMainScriptManager } from "@main/ksx-runner/MainScriptManager";

describe("KSX ScriptManager", () => {
  it("Run works with new file", async () => {
    // --- Arrange
    const sm = createMainScriptManager(execScript);

    // --- Act
    const id = sm.runScript("test1");

    // --- Assert
    let scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(1);
    expect(scripts[0].status).toBe("pending");

    // --- Cleanup
    await sm.stopScript(id);
    scripts = sm.getScriptsStatus();
    expect(scripts.length).toBe(1);
    expect(scripts[0].status).toBe("stopped");
  });

  it("Run works with multiple files", async () => {
    // --- Arrange
    const sm = createMainScriptManager(execScript);

    // --- Act
    const id1 = sm.runScript("test1");
    const id2 = sm.runScript("test2");
    const id3 = sm.runScript("test3");

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

  it("Run completes with error", async () => {
    // --- Arrange
    const sm = createMainScriptManager(execScript);
    const id1 = sm.runScript("test1");

    // --- Act
    errorScript = "Test error";
    try {
      await sm.completeScript(id1);
    } catch (err) {
      expect(err.message).toBe("Test error");
      const scripts = sm.getScriptsStatus();
      expect(scripts.length).toBe(1);
      expect(scripts[0].status).toBe("execError");
      return;
    }
    assert.fail("Error expected");
  });
});

let errorScript = "";

async function execScript (scriptFile: string, evalContext: EvaluationContext) {
  for (let i = 0; i < 10; i++) {
    if (evalContext?.cancellationToken?.cancelled) {
      break;
    }
    if (errorScript) {
      throw new Error(errorScript);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
