import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { extractArguments } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { createInteractiveCommandsService } from "@renderer/appIde/services/IdeCommandService";
import { runDetection } from "@renderer/appIde/reverse/detection";
import * as mSettingCommands from "@renderer/appIde/commands/SettingCommands";
import * as mRomAnnotationCommands from "@renderer/appIde/commands/RomAnnotationCommands";
import * as mExportAsmCommand from "@renderer/appIde/commands/ExportAsmCommand";
import * as mScriptCommands from "@renderer/appIde/commands/ScriptCommands";
import * as mDocumentCommands from "@renderer/appIde/commands/DocumentCommands";
import * as mAnnotationSetCommands from "@renderer/appIde/commands/AnnotationSetCommands";
import * as mSkoolCommands from "@renderer/appIde/commands/SkoolCommands";
import * as mAnnDetectCommand from "@renderer/appIde/commands/AnnDetectCommand";
import * as mSpriteCommands from "@renderer/appIde/commands/SpriteCommands";
import * as mLabelCommand from "@renderer/appIde/commands/LabelCommand";
import * as mZxNextStorageCopyCommand from "@renderer/appIde/commands/ZxNextStorageCopyCommand";
import * as mToolCommands from "@renderer/appIde/commands/ToolCommands";
import * as mPasta80Commands from "@renderer/appIde/commands/Pasta80Commands";
import * as mCopperCommands from "@renderer/appIde/commands/CopperCommands";
import * as mProjectExcludedItemsCommand from "@renderer/appIde/commands/ProjectExcludedItemsCommand";
import * as mCompilerCommand from "@renderer/appIde/commands/CompilerCommand";
import * as mBeamCommands from "@renderer/appIde/commands/BeamCommands";
import * as mDisassemblyCommand from "@renderer/appIde/commands/DisassemblyCommand";
import * as mTilemapCommands from "@renderer/appIde/commands/TilemapCommands";
import * as mSjasmPlusCommands from "@renderer/appIde/commands/SjasmPlusCommands";
import * as mOpenFolderCommand from "@renderer/appIde/commands/OpenFolderCommand";
import * as mLayersCommands from "@renderer/appIde/commands/LayersCommands";
import * as mCloseFolderCommand from "@renderer/appIde/commands/CloseFolderCommand";
import * as mNewProjectCommand from "@renderer/appIde/commands/NewProjectCommand";
import * as mLayer2Commands from "@renderer/appIde/commands/Layer2Commands";
import * as mCreateDiskFileCommand from "@renderer/appIde/commands/CreateDiskFileCommand";
import * as mShellCommand from "@renderer/appIde/commands/ShellCommand";
import * as mDialogCommands from "@renderer/appIde/commands/DialogCommands";
import * as mZ88DkCommands from "@renderer/appIde/commands/Z88DkCommands";
import * as mGraphicsCommand from "@renderer/appIde/commands/GraphicsCommand";

/*
 * The IDE's own commands and the command infrastructure in the pseudo-locale
 * (`.plans/LOCALIZATION_PLAN.md` step 12): every description and the argument-validation messages
 * are pseudo text, so none of them is still a hard-coded English string.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

const MODULES: Record<string, unknown>[] = [
  mSettingCommands,
  mRomAnnotationCommands,
  mExportAsmCommand,
  mScriptCommands,
  mDocumentCommands,
  mAnnotationSetCommands,
  mSkoolCommands,
  mAnnDetectCommand,
  mSpriteCommands,
  mLabelCommand,
  mZxNextStorageCopyCommand,
  mToolCommands,
  mPasta80Commands,
  mCopperCommands,
  mProjectExcludedItemsCommand,
  mCompilerCommand,
  mBeamCommands,
  mDisassemblyCommand,
  mTilemapCommands,
  mSjasmPlusCommands,
  mOpenFolderCommand,
  mLayersCommands,
  mCloseFolderCommand,
  mNewProjectCommand,
  mLayer2Commands,
  mCreateDiskFileCommand,
  mShellCommand,
  mDialogCommands,
  mZ88DkCommands,
  mGraphicsCommand,
];

/** Every concrete command class the modules export */
function commandsOf(module: Record<string, unknown>): { id: string; description: string }[] {
  const result: { id: string; description: string }[] = [];
  for (const value of Object.values(module)) {
    if (typeof value !== "function" || typeof value.prototype?.execute !== "function") continue;
    const command = new (value as new () => { id?: string; description?: string })();
    if (command.id) result.push({ id: command.id, description: command.description ?? "" });
  }
  return result;
}

describe("the IDE commands in the pseudo-locale", () => {
  afterEach(() => setLanguage("en"));

  it("translates every command description", () => {
    setLanguage("qps");
    const service = createInteractiveCommandsService(undefined as any, undefined as any, "ide");
    const commands = [
      ...MODULES.flatMap((m) => commandsOf(m)),
      ...service.getRegisteredCommands().map((c) => ({ id: c.id, description: c.description }))
    ];
    expect(commands.length).toBeGreaterThan(60);
    const problems = commands.filter((c) => !isPseudo(c.description)).map((c) => `${c.id}: ${c.description}`);
    expect(problems).toEqual([]);
  });

  it("translates the argument-validation messages", () => {
    setLanguage("qps");
    const tooMany = extractArguments(parseCommand("x 1 2"), { mandatory: [{ name: "a" }] });
    const missing = extractArguments(parseCommand(""), { mandatory: [{ name: "a" }] });
    const range = extractArguments(parseCommand("300"), {
      mandatory: [{ name: "a", type: "number", minValue: 0, maxValue: 255 }]
    });
    const option = extractArguments(parseCommand("-q"), {});
    const messages = [tooMany, missing, range, option].flat() as string[];
    expect(messages).toHaveLength(4);
    expect(messages.filter((m) => !isPseudo(m))).toEqual([]);
  });
});

describe("detection problems", () => {
  it("say what kind of problem they are with a code, not only in words", async () => {
    setLanguage("qps");
    try {
      const run = await runDetection(
        { getProfileTouched: async () => ({ bytes: [] }) } as any,
        {} as any,
        { scope: { kind: "paged" } } as any
      );
      expect(run.problemCode).toBe("no-coverage");
      expect(isPseudo(run.problem!)).toBe(true);
    } finally {
      setLanguage("en");
    }
  });
});
