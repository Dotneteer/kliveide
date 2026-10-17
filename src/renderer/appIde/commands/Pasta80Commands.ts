import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";

import { commandError, commandSuccessWith, IdeCommandBase, writeMessage } from "../services/ide-commands";
import { PASTA80_ALL, PASTA80_INSTALL_FOLDER } from "@main/pasta80-integration/pasta80-config";
import { SJASMP_INSTALL_FOLDER } from "@main/sjasmp-integration/sjasmp-config";
import { t } from "@common/i18n/i18n";

const PASTA80_CFG_FILENAME = ".pasta80.cfg";

type ResetPasta80CommandArgs = {
  pasta80Folder: string;
  "-p"?: boolean;
};

export class ResetPasta80Command extends IdeCommandBase<ResetPasta80CommandArgs> {
  readonly id = "pasta80-reset";
  get description() {
    return t("commands.pasta80.resetDescription");
  }
  readonly usage = "pasta80-reset <Full path to the pasta80 installation folder> [-p]";
  readonly aliases = ["p80r"];

  readonly argumentInfo: CommandArgumentInfo = {
    optional: [{ name: "pasta80Folder" }],
    commandOptions: ["-p"]
  };

  async execute(
    context: IdeCommandContext,
    args: ResetPasta80CommandArgs
  ): Promise<IdeCommandResult> {
    const option = args["-p"] ? "-p" : "-u";
    if (args["-p"]) {
      const state = context.store.getState();
      if (!state.project?.isKliveProject) {
        return commandError(t("commands.common.projectOptionNeedsProject"));
      }
    }

    if (!args.pasta80Folder) {
      await context.service.ideCommandsService.executeCommand(`set ${PASTA80_ALL}`);
      return commandSuccessWith(t("commands.pasta80.removed"));
    }

    // --- Step 1: Check that sjasmplus is configured — it is pasta80's assembler backend
    const userSettings = await context.mainApi.getUserSettings();
    const projectSettings = await context.mainApi.getProjectSettings();
    const mergedSettings = { ...userSettings, ...projectSettings };

    // SJASMP_INSTALL_FOLDER = "sjasmp.root" — resolve nested key manually
    const sjasmInstallFolder = SJASMP_INSTALL_FOLDER.split(".").reduce(
      (obj: any, key) => (obj != null ? obj[key] : undefined),
      mergedSettings
    )?.toString();
    if (!sjasmInstallFolder || sjasmInstallFolder.trim() === "") {
      return commandError(t("commands.pasta80.sjasmpMissing"));
    }

    // --- Step 2: Derive the sjasmplus executable path from the install folder
    const sjasmExecutable = `${sjasmInstallFolder}/sjasmplus`;

    // --- Step 3: Store the pasta80 installation folder in Klive settings
    await context.service.ideCommandsService.executeCommand(
      `set ${option} ${PASTA80_INSTALL_FOLDER} "${args.pasta80Folder}"`
    );

    // --- Step 4: Check / create ~/.pasta80.cfg
    let cfgContent: string | null = null;
    try {
      cfgContent = await context.mainApi.readTextFile(PASTA80_CFG_FILENAME, "utf8", "home:");
    } catch {
      // File does not exist — create it
      cfgContent = null;
    }

    if (cfgContent === null) {
      // Create a minimal config with just the assembler path
      const newCfg =
        "# PASTA/80 config file — created by Klive IDE\n" +
        `assembler = ${sjasmExecutable}\n`;
      await context.mainApi.saveTextFile(PASTA80_CFG_FILENAME, newCfg, "home:");
      writeMessage(context.output, t("commands.pasta80.cfgCreated", { path: sjasmExecutable }), "bright-blue");
    } else {
      // File exists — check the assembler setting
      const assemblerMatch = cfgContent.match(/^\s*assembler\s*=\s*(.+)$/m);
      if (!assemblerMatch) {
        writeMessage(context.output, t("commands.pasta80.cfgNoAssembler", { path: sjasmExecutable }), "yellow");
      } else {
        const cfgPath = assemblerMatch[1].trim();
        if (cfgPath !== sjasmExecutable) {
          writeMessage(
            context.output,
            t("commands.pasta80.cfgMismatch", { cfgPath, path: sjasmExecutable }),
            "yellow"
          );
        }
      }
    }

    return commandSuccessWith(t("commands.pasta80.folderSet", { path: args.pasta80Folder }));
  }
}
