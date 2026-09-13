import { describe, expect, it } from "vitest";

import { CliRunner } from "@main/cli-integration/CliRunner";
import { stripAnsi } from "@main/cli-integration/ansi";

/**
 * Klive's console renders colour structurally, not from escape sequences, so anything a child
 * process emits as ANSI is garbage by the time it reaches an output buffer — and it is garbage the
 * error-line regexes have to parse through before that.
 *
 * These run real child processes rather than mocking execa: the point of the change is what
 * actually crosses the process boundary, including the environment the child sees.
 */

/** Named rather than embedded, so the expectations stay readable in a diff. */
const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);

/** Runs a snippet of JS in a child node, which is the one executable this suite can rely on. */
const runNode = (source: string, runner = new CliRunner()) =>
  runner.execute(process.execPath, ["-e", source]);

describe("stripAnsi", () => {
  it("removes SGR colour sequences", () => {
    expect(stripAnsi(`${ESC}[31mred${ESC}[0m`)).toBe("red");
    expect(stripAnsi(`${ESC}[1;32mbold green${ESC}[m`)).toBe("bold green");
  });

  it("removes 256-colour and truecolour sequences", () => {
    expect(stripAnsi(`${ESC}[38;5;208morange${ESC}[0m`)).toBe("orange");
    expect(stripAnsi(`${ESC}[38;2;255;0;0mtruecolour${ESC}[0m`)).toBe("truecolour");
  });

  it("removes cursor and erase sequences, not just colour", () => {
    // --- What a progress indicator emits between redraws.
    expect(stripAnsi(`${ESC}[2K${ESC}[1Aprogress`)).toBe("progress");
  });

  it("removes the ESC 7 / ESC 8 cursor save-restore pair", () => {
    // --- 0x37 sits below the 0x40-0x5F class the popular `ansi-regex` package uses for bare
    // --- escapes, so this pair survives that implementation. It must not survive this one.
    expect(stripAnsi(`${ESC}7saved${ESC}8`)).toBe("saved");
  });

  it("removes OSC window titles and hyperlinks", () => {
    expect(stripAnsi(`${ESC}]0;window title${BEL}after`)).toBe("after");
    expect(stripAnsi(`${ESC}]8;;http://example.com${ESC}\\link${ESC}]8;;${ESC}\\`)).toBe("link");
  });

  it("leaves ordinary diagnostic text untouched", () => {
    const diagnostic = "main.asm:12:4: error: unknown mnemonic [bad]";
    expect(stripAnsi(diagnostic)).toBe(diagnostic);
    expect(stripAnsi("100% done")).toBe("100% done");
  });

  it("keeps a colourised file reference parseable", () => {
    // --- The quiet failure this guards: a colourised filename stops matching the per-compiler
    // --- error regex, and the diagnostic silently loses its clickable navigation link.
    expect(stripAnsi(`${ESC}[31mmain.asm${ESC}[0m:12:4: error: bad`)).toBe(
      "main.asm:12:4: error: bad"
    );
  });

  it("passes undefined through rather than turning it into an empty string", () => {
    expect(stripAnsi(undefined)).toBeUndefined();
  });
});

describe("CliRunner colour suppression", () => {
  it("tells the child not to colourise", async () => {
    const result = await runNode(
      "process.stdout.write(`${process.env.NO_COLOR}/${process.env.FORCE_COLOR}`)"
    );

    expect(result?.stdout).toBe("1/0");
  });

  it("keeps the caller's own environment", async () => {
    const runner = new CliRunner();
    const result = await runner.execute(
      process.execPath,
      ["-e", "process.stdout.write(`${process.env.KLIVE_TEST}/${process.env.NO_COLOR}`)"],
      { env: { ...process.env, KLIVE_TEST: "kept" } }
    );

    expect(result?.stdout).toBe("kept/1");
  });
});

describe("CliRunner ANSI stripping", () => {
  it("strips escapes from the stdout of a command that succeeds", async () => {
    const result = await runNode(
      `process.stdout.write('\\u001b[32mBuild succeeded\\u001b[0m')`
    );

    expect(result?.stdout).toBe("Build succeeded");
    expect(result?.stdout).not.toContain(ESC);
  });

  it("strips escapes from stderr", async () => {
    const result = await runNode(
      `process.stderr.write('\\u001b[31mboom\\u001b[0m'); process.exit(3);`
    );

    expect(result?.stderr).toBe("boom");
    expect(result?.stderr).not.toContain(ESC);
  });

  it("strips escapes from the failure message, which embeds the child's own output", async () => {
    // --- With no error filter set, `parseErrorMessage` matches nothing, so the runner falls back
    // --- to reporting execa's `error.message` — and execa builds that message by embedding the
    // --- child's stdout and stderr verbatim. This is the widest leak path of the three.
    const result = await runNode(
      `process.stderr.write('\\u001b[31mfatal: no such file\\u001b[0m'); process.exit(1);`
    );

    expect(result?.failed).toBeTypeOf("string");
    expect(result?.failed).not.toContain(ESC);
    expect(result?.failed).toContain("fatal: no such file");
  });

  it("gives the error-line splitter text the compiler regex can still match", async () => {
    const runner = new CliRunner();
    runner.setErrorFilter({
      regex: /^(.*?):(\d+):(\d+):\s*(error|warning):\s*(.*)$/,
      filenameFilterIndex: 1,
      lineFilterIndex: 2,
      columnFilterIndex: 3,
      warningFilterIndex: 4,
      messageFilterIndex: 5
    });

    // --- The filename is wrapped in colour, exactly as a colourising compiler would emit it.
    const result = await runNode(
      `process.stderr.write('\\u001b[1m\\u001b[31mmain.asm\\u001b[0m:12:4: error: unknown mnemonic'); process.exit(1);`,
      runner
    );

    expect(result?.errors).toHaveLength(1);
    expect(result?.errors?.[0].filename).toBe("main.asm");
    expect(result?.errors?.[0].line).toBe(12);
    expect(result?.errors?.[0].message).toBe("unknown mnemonic");
  });
});
