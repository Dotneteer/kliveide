import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import type { IdeCommandBase } from "@renderer/appIde/services/ide-commands";
import { CoverageCommand, CoverageResetCommand, MemoryHeatCommand, coverageStatusLines } from "@renderer/appIde/commands/CoverageCommands";
import {
  ExportCodeCommand,
  KliveBuildCommand,
  KliveCompileCommand,
  KliveDebugCodeCommand,
  KliveInjectCodeCommand,
  KliveRunCodeCommand
} from "@renderer/appIde/commands/KliveCompilerCommands";
import {
  HideProfilerCommand,
  ProfileCommand,
  ProfileStartCommand,
  ProfileStopCommand,
  ShowProfilerCommand,
  profileStatusLines
} from "@renderer/appIde/commands/ProfileCommands";
import {
  TestDebugCommand,
  TestInitCommand,
  TestJUnitCommand,
  TestListCommand,
  TestRunCommand
} from "@renderer/appIde/commands/UnitTestCommands";
import {
  RzxPlayCommand,
  RzxRecordCommand,
  RzxRollbackCommand,
  RzxRollbackPointCommand,
  RzxStopCommand,
  RzxVideoCommand
} from "@renderer/appIde/commands/RzxCommands";
import { StateLoadCommand, StateSaveCommand } from "@renderer/appIde/commands/MachineStateCommands";
import { DebugRecordingLoadCommand, DebugRecordingSaveCommand } from "@renderer/appIde/commands/DebugRecordingCommands";
import { SpectrumSnapshotCommand, spectrumSnapshotProjectGuard } from "@renderer/appIde/commands/SpectrumSnapshotCommand";
import { SpectrumSnapshotSaveCommand } from "@renderer/appIde/commands/SpectrumSnapshotSaveCommand";
import { Z88SnapshotCommand, z88SnapshotProjectGuard } from "@renderer/appIde/commands/Z88SnapshotCommand";
import { TapeLoadCommand, programLoadGuard, tapeLoadGuard } from "@renderer/appIde/commands/TapeLoadCommand";
import { LaunchNexCommand } from "@renderer/appIde/commands/NexLaunchCommand";
import type { ProfileStatus } from "@common/profile/profileTypes";
import { MI_SPECTRUM_48, MI_Z88 } from "@common/machines/constants";

/*
 * The media, build, test and profiling commands in another language (`.plans/LOCALIZATION_PLAN.md`
 * step 12): in the pseudo-locale every description and the status lines built from messages are
 * pseudo text. Command ids, aliases and usage stay as they are - they are syntax.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

const COMMANDS: IdeCommandBase[] = [
  new CoverageCommand(),
  new CoverageResetCommand(),
  new MemoryHeatCommand(),
  new KliveBuildCommand(),
  new KliveCompileCommand(),
  new KliveInjectCodeCommand(),
  new KliveRunCodeCommand(),
  new KliveDebugCodeCommand(),
  new ExportCodeCommand(),
  new ProfileCommand(),
  new ProfileStartCommand(),
  new ProfileStopCommand(),
  new ShowProfilerCommand(),
  new HideProfilerCommand(),
  new TestListCommand(),
  new TestRunCommand(),
  new TestDebugCommand(),
  new TestInitCommand(),
  new TestJUnitCommand(),
  new RzxPlayCommand(),
  new RzxRecordCommand(),
  new RzxStopCommand(),
  new RzxRollbackCommand(),
  new RzxRollbackPointCommand(),
  new RzxVideoCommand(),
  new StateSaveCommand(),
  new StateLoadCommand(),
  new DebugRecordingSaveCommand(),
  new DebugRecordingLoadCommand(),
  new SpectrumSnapshotCommand(),
  new SpectrumSnapshotSaveCommand(),
  new Z88SnapshotCommand(),
  new TapeLoadCommand(),
  new LaunchNexCommand()
];

const STATUS = {
  enabled: true,
  counters: false,
  muted: true,
  instructions: 1234,
  pagesUsed: 3,
  poolPages: 64,
  pagesDropped: 1,
  firstDroppedPage: 9,
  timeTotal: 1000,
  timeUnit: "T-states",
  timeHalt: 400,
  timeSnooze: 10,
  abandonedInstructions: 5,
  armedStart: 0x8000,
  armedStop: -1,
  callsOn: true,
  frameTicks: 500,
  calls: 4,
  interrupts: 1,
  edgesUsed: 2,
  depth: 1,
  stackResyncs: 1,
  depthOverflows: 1,
  edgesDropped: 1,
  clockHz: 3500000
} as unknown as ProfileStatus;

describe("the media and build commands in the pseudo-locale", () => {
  afterEach(() => setLanguage("en"));

  it("translates every description", () => {
    setLanguage("qps");
    const missed = COMMANDS.filter((c) => !isPseudo(c.description)).map((c) => `${c.id}: ${c.description}`);
    expect(missed).toEqual([]);
  });

  it("translates the coverage and profile status lines", () => {
    setLanguage("qps");
    // --- Indented lines keep their indent outside the message
    const lines = [...coverageStatusLines(STATUS), ...profileStatusLines(STATUS)].map((l) => l.trim());
    expect(lines.filter((l) => !isPseudo(l))).toEqual([]);
  });

  it("translates the project checks", () => {
    setLanguage("qps");
    const project = { project: { isKliveProject: true }, emulatorState: { machineId: MI_Z88 } };
    for (const text of [
      spectrumSnapshotProjectGuard(project),
      spectrumSnapshotProjectGuard(project, undefined, "recording"),
      z88SnapshotProjectGuard({ project: { isKliveProject: true }, emulatorState: { machineId: MI_SPECTRUM_48 } }),
      tapeLoadGuard(project),
      programLoadGuard(project)
    ]) {
      expect(text && isPseudo(text), text).toBe(true);
    }
  });
});
