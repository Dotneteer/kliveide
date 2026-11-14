import { describe, expect, it, vi } from "vitest";

import { MI_SPECTRUM_48 } from "@common/machines/constants";
import { SETTING_IDE_FOCUS_EMU_ON_RUN } from "@common/settings/setting-const";
import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { SETTINGS_ROWS } from "@common/settings/settings-pages";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * Run and Debug hand the keyboard to the emulator window once the program has started
 * (`SETTING_IDE_FOCUS_EMU_ON_RUN`). The compiler is mocked: what is under test is when
 * `injectCode` asks the main process for the focus, not the build.
 */

const compiled: { result: any } = { result: undefined };
vi.mock("@renderer/appIde/utils/compile-code", async (importOriginal) => {
  const original = await importOriginal<typeof import("@renderer/appIde/utils/compile-code")>();
  return { ...original, compileCode: vi.fn(async () => ({ result: compiled.result })) };
});

const { injectCode, focusEmulatorAfterStart } = await import(
  "@renderer/appIde/commands/KliveCompilerCommands"
);

function program(withDebugInfo = true) {
  return {
    errors: [],
    modelType: SpectrumModelType.Spectrum48,
    entryAddress: 0x8000,
    injectOptions: {},
    sourceFileList: withDebugInfo ? [{ filename: "/p/code.kz80.asm" }] : [],
    segments: [{ startAddress: 0x8000, emittedCode: [0xc9] }]
  };
}

function contextFor(focusSetting?: boolean) {
  const focusEmuWindow = vi.fn().mockResolvedValue(undefined);
  const runCodeCommand = vi.fn().mockResolvedValue(undefined);
  const injectCodeCommand = vi.fn().mockResolvedValue(undefined);
  const globalSettings =
    focusSetting === undefined ? {} : { ideBehavior: { focusEmuOnRun: focusSetting } };
  const context: any = {
    store: {
      getState: () => ({ emulatorState: { machineId: MI_SPECTRUM_48 }, globalSettings }),
      dispatch: vi.fn()
    },
    output: { write: vi.fn(), writeLine: vi.fn(), color: vi.fn(), resetStyle: vi.fn() },
    emuApi: { runCodeCommand, injectCodeCommand, setSourceDebugInfo: vi.fn().mockResolvedValue(undefined) },
    mainApi: { focusEmuWindow },
    service: {
      projectService: { setLockedFiles: vi.fn() },
      ideCommandsService: { executeCommand: vi.fn() }
    }
  };
  return { context, focusEmuWindow, runCodeCommand, injectCodeCommand };
}

describe("focusing the emulator after Run or Debug", () => {
  it("is a General › Windows switch, on by default", () => {
    expect(KliveGlobalSettings[SETTING_IDE_FOCUS_EMU_ON_RUN]?.defaultValue).toBe(true);
    const row = SETTINGS_ROWS.find((r) => r.id === "focusEmuOnRun");
    expect(row?.page).toBe("general");
    expect(row?.editor).toBe("switch");
  });

  it("focuses the emulator after Run, by default", async () => {
    compiled.result = program();
    const { context, focusEmuWindow, runCodeCommand } = contextFor();
    const result = await injectCode(context, "run");
    expect(result.success).toBe(true);
    expect(runCodeCommand).toHaveBeenCalled();
    expect(focusEmuWindow).toHaveBeenCalledTimes(1);
    // --- After the start, not before it
    expect(focusEmuWindow.mock.invocationCallOrder[0]).toBeGreaterThan(
      runCodeCommand.mock.invocationCallOrder[0]
    );
  });

  it("focuses the emulator after Debug, with or without debug info", async () => {
    for (const withDebugInfo of [true, false]) {
      compiled.result = program(withDebugInfo);
      const { context, focusEmuWindow } = contextFor(true);
      expect((await injectCode(context, "debug")).success).toBe(true);
      expect(focusEmuWindow, String(withDebugInfo)).toHaveBeenCalledTimes(1);
    }
  });

  it("leaves the focus alone when the setting is off", async () => {
    compiled.result = program();
    for (const op of ["run", "debug"] as const) {
      const { context, focusEmuWindow, runCodeCommand } = contextFor(false);
      expect((await injectCode(context, op)).success).toBe(true);
      expect(runCodeCommand).toHaveBeenCalled();
      expect(focusEmuWindow, op).not.toHaveBeenCalled();
    }
  });

  it("leaves the focus alone for Inject, which starts nothing", async () => {
    compiled.result = program();
    const { context, focusEmuWindow, injectCodeCommand } = contextFor(true);
    expect((await injectCode(context, "inject")).success).toBe(true);
    expect(injectCodeCommand).toHaveBeenCalled();
    expect(focusEmuWindow).not.toHaveBeenCalled();
  });

  it("leaves the focus alone when the build fails", async () => {
    compiled.result = { ...program(), errors: [{ message: "boom" }] };
    const { context, focusEmuWindow } = contextFor(true);
    // --- A failed build reports through the message; mock it the way compileCode does
    const { compileCode } = await import("@renderer/appIde/utils/compile-code");
    vi.mocked(compileCode).mockResolvedValueOnce({ result: compiled.result, message: "failed" });
    expect((await injectCode(context, "run")).success).toBe(false);
    expect(focusEmuWindow).not.toHaveBeenCalled();
  });

  it("does not fail the run when the window cannot be focused", async () => {
    const { context, focusEmuWindow } = contextFor(true);
    focusEmuWindow.mockRejectedValueOnce(new Error("no window"));
    await expect(focusEmulatorAfterStart(context)).resolves.toBeUndefined();
  });

  it("leaves a unit test's debug run alone", async () => {
    const { context, focusEmuWindow } = contextFor(true);
    await focusEmulatorAfterStart(context, true);
    expect(focusEmuWindow).not.toHaveBeenCalled();
  });
});
