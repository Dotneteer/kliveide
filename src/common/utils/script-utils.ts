import type { ScriptStatus } from "@abstr/ScriptRunInfo";

export function isScriptCompleted (status: ScriptStatus): boolean {
  return (
    status === "stopped" ||
    status === "completed" ||
    status === "compileError" ||
    status === "execError"
  );
}

export function scriptDocumentId (scriptId: number): string {
  return `ScriptOutput-${scriptId}`;
}
