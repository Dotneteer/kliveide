import { describe, expect, it } from "vitest";

import { CliRunner } from "@main/cli-integration/CliRunner";

/**
 * The failure mode a user hits by renaming or deleting the folder that holds a
 * configured assembler: the process never starts, so the error carries no exit
 * code and none of the output the normal error path parses.
 */
describe("CliRunner spawn failures", () => {
  it("reports a missing executable as a readable failure instead of throwing", async () => {
    const runner = new CliRunner();

    const result = await runner.execute("/no/such/folder/sjasmplus", ["--version"]);

    // --- Before this was fixed the catch block itself threw a TypeError, which
    // --- surfaced in the build output in place of the real cause.
    expect(result?.failed).toBeTypeOf("string");
    expect(result?.failed).not.toBe("");
    expect(result?.failed).toContain("/no/such/folder/sjasmplus");
    expect(result?.errors).toBeUndefined();
  });

  it("still reports a process that started and failed through the normal path", async () => {
    const runner = new CliRunner();

    // --- node is the one executable this test suite can rely on existing
    const result = await runner.execute(process.execPath, [
      "-e",
      "process.stderr.write('boom'); process.exit(3);"
    ]);

    // --- An exit code means the process ran, so its own output is the report
    expect(result?.stderr).toContain("boom");
    expect(result?.failed).toBeTypeOf("string");
  });

  it("returns the output of a command that succeeds", async () => {
    const runner = new CliRunner();

    const result = await runner.execute(process.execPath, ["-e", "process.stdout.write('ok')"]);

    expect(result?.stdout).toBe("ok");
    expect(result?.failed).toBeUndefined();
  });
});
