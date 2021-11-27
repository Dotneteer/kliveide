import * as fs from "fs";
import { dialog } from "electron";

import { dispatch } from "@core/service-registry";
import { getRegisteredMachines } from "@core/main/machine-registry";
import * as Messages from "@core/messaging/message-types";
import { emuForwarder } from "../app/app-menu";
import {
  createKliveProject,
  getProjectFile,
  openProjectFolder,
  selectFolder,
} from "../project/project-utils";
import { getFolderContents } from "../utils/file-utils";
import { emuWindow } from "../app/emu-window";
import { ideWindow } from "../app/ide-window";
import { appSettings } from "../main-state/klive-configuration";
import { setIdeConfigAction } from "@core/state/ide-config-reducer";
import { getNodeExtension } from "@abstractions/project-node";
import { getCompilerForExtension, KliveCompilerOutput } from "@abstractions/compiler-registry";
import { CompilerOutput } from "@abstractions/z80-compiler-service";

/**
 * Processes the requests arriving from the IDE process
 * @param message to process
 * @returns Message response
 */
export async function processIdeRequest(
  message: Messages.RequestMessage
): Promise<Messages.ResponseMessage> {
  switch (message.type) {
    case "GetRegisteredMachines":
      return Messages.getRegisteredMachinesResponse(getRegisteredMachines());

    case "CreateKliveProject":
      const operation = await createKliveProject(
        message.machineType,
        message.rootFolder,
        message.projectFolder
      );
      return Messages.createKliveProjectResponse(
        operation.targetFolder,
        operation.error
      );

    case "OpenProjectFolder":
      await openProjectFolder();
      return Messages.defaultResponse();

    case "GetFolderDialog":
      const folder = await selectFolder(message.title, message.root);
      return Messages.getFolderDialogResponse(folder);

    case "FileExists":
      return Messages.fileExistsResponse(fs.existsSync(message.name));

    case "GetFolderContents":
      return Messages.getFolderContentsResponse(
        await getFolderContents(message.name)
      );

    case "CreateFolder": {
      let error: string | undefined;
      if (fs.existsSync(message.name)) {
        error = `Folder ${message.name} already exists`;
      } else {
        try {
          fs.mkdirSync(message.name, { recursive: true });
        } catch (err) {
          error = `Cannot create folder: ${err}`;
        }
      }
      if (error) {
        dialog.showErrorBox("Error creating folder", error);
      }
      return Messages.fileOperationResponse(error);
    }

    case "CreateFile": {
      let error: string | undefined;
      if (fs.existsSync(message.name)) {
        error = `File ${message.name} already exists`;
      } else {
        try {
          fs.writeFileSync(message.name, "");
        } catch (err) {
          error = `Cannot create file: ${err}`;
        }
      }
      if (error) {
        dialog.showErrorBox("Error creating file", error);
      }
      return Messages.fileOperationResponse(error);
    }

    case "ConfirmDialog":
      const confirmResult = await dialog.showMessageBox({
        title: message.title ? message.title : "Confirmation",
        type: "question",
        message: message.question,
        buttons: ["No", "Yes"],
        defaultId: 0,
        noLink: false,
      });
      return Messages.confirmDialogResponse(confirmResult.response === 1);

    case "DeleteFile": {
      let error: string | undefined;
      try {
        fs.unlinkSync(message.name);
      } catch (err) {
        error = `Cannot delete file: ${err}`;
      }
      if (error) {
        dialog.showErrorBox("Error deleting file", error);
      }
      return Messages.fileOperationResponse(error);
    }

    case "DeleteFolder": {
      let error: string | undefined;
      try {
        await fs.promises.rm(message.name, { recursive: true });
      } catch (err) {
        error = `Cannot delete folder: ${err}`;
      }
      if (error) {
        dialog.showErrorBox("Error deleting folder", error);
      }
      return Messages.fileOperationResponse(error);
    }

    case "RenameFile": {
      let error: string | undefined;
      try {
        fs.renameSync(message.oldName, message.newName);
      } catch (err) {
        error = `Cannot rename file or folder: ${err}`;
      }
      if (error) {
        dialog.showErrorBox("Error renaming file or folder", error);
      }
      return Messages.fileOperationResponse(error);
    }

    case "GetFileContents": {
      let error: string | undefined;
      let contents: string | Buffer | undefined;
      try {
        contents = fs.readFileSync(
          message.name,
          message.asBuffer ? {} : { encoding: "utf8" }
        );
      } catch (err) {
        error = `Cannot read file: ${err}`;
      }
      if (error) {
        dialog.showErrorBox("Error reading file", error);
      }
      return Messages.getFileContentsResponse(contents);
    }

    case "SaveFileContents": {
      let error: string | undefined;
      try {
        fs.writeFileSync(message.name, message.contents, {
          encoding: "utf8",
        });
      } catch (err) {
        error = `Cannot save file: ${err}`;
      }
      return Messages.fileOperationResponse(error);
    }

    case "GetCompilerInfo": {
      const extension = getNodeExtension(message.filename);
      const compiler = getCompilerForExtension(extension);
      return Messages.getCompilerInfoResponse(
        compiler?.id,
        !!compiler?.providesKliveOutput
      );
    }

    case "CompileFile": {
      const extension = getNodeExtension(message.filename);
      const compiler = getCompilerForExtension(extension);
      try {
        const result = (await compiler.compileFile(
          message.filename
        )) as KliveCompilerOutput;
        return Messages.compileFileResponse(result);
      } catch (err) {
        return Messages.compileFileResponse({ errors: []}, err.toString());
      }
    }

    case "ShowMessageBox":
      const window = message.process === "emu" ? emuWindow : ideWindow;
      await dialog.showMessageBox(window.window, {
        message: message.message,
        title: message.title ?? "Klive",
        type: message.asError ? "error" : "info",
      });
      return Messages.defaultResponse();

    case "GetAppConfig":
      return Messages.getAppSettingsResponse(
        message.fromUser ? appSettings : getProjectFile()
      );

    case "SaveIdeConfig":
      if (message.toUser ?? false) {
        appSettings.ide = message.config;
        emuWindow.saveAppSettings();
      } else {
        dispatch(setIdeConfigAction(message.config));
        emuWindow.saveKliveProject();
      }
      return Messages.defaultResponse();

    default:
      // --- If the main does not recognize a request, it forwards it to Emu
      return await emuForwarder.sendMessage(message);
  }
}
