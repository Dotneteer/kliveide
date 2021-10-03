import * as fs from "fs";
import { dialog } from "electron";
import { getRegisteredMachines } from "../../extensibility/main/machine-registry";
import {
  ConfirmDialogResponse,
  FileOperationResponse,
  CreateKliveProjectResponse,
  DefaultResponse,
  EmuOpenFileDialogResponse,
  FileExistsResponse,
  GetFolderContentsResponse,
  GetFolderDialogResponse,
  GetRegisteredMachinesResponse,
  RequestMessage,
  ResponseMessage,
  GetFileContentsResponse,
  CompileFileResponse,
} from "@messaging/message-types";
import { emuForwarder, emuWindow, ideWindow } from "../app/app-menu";
import {
  createKliveProject,
  openProjectFolder,
  selectFolder,
} from "../project/project-utils";
import { getFolderContents } from "../utils/file-utils";
import { getZ80CompilerService } from "@abstractions/service-helpers";
import { KliveProcess } from "../../extensibility/abstractions/command-def";

/**
 * Processes the requests arriving from the emulator process
 * @param message to process
 * @returns Message response
 */
export async function processEmulatorRequest(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "EmuOpenFileDialog":
      const result = await dialog.showOpenDialog(emuWindow.window, {
        title: message.title,
        filters: message.filters,
      });
      return <EmuOpenFileDialogResponse>{
        type: "EmuOpenFileDialogResponse",
        filename: result.canceled ? undefined : result.filePaths[0],
      };

    case "ManageZ88Cards":
      const manageCardsStub = (emuWindow.machineContextProvider as any)?.[
        "insertOrRemoveCards"
      ].bind(emuWindow.machineContextProvider);
      if (manageCardsStub) {
        await manageCardsStub();
      }
      return <DefaultResponse>{ type: "Ack" };

    default:
      return <DefaultResponse>{ type: "Ack" };
  }
}

/**
 * Processes the requests arriving from the IDE process
 * @param message to process
 * @returns Message response
 */
export async function processIdeRequest(
  message: RequestMessage
): Promise<ResponseMessage> {
  switch (message.type) {
    case "GetRegisteredMachines":
      return <GetRegisteredMachinesResponse>{
        type: "GetRegisteredMachinesResponse",
        machines: getRegisteredMachines(),
      };

    case "CreateKliveProject":
      const operation = await createKliveProject(
        message.machineType,
        message.rootFolder,
        message.projectFolder
      );
      return <CreateKliveProjectResponse>{
        type: "CreateKliveProjectResponse",
        error: operation.error,
        targetFolder: operation.targetFolder,
      };

    case "OpenProjectFolder":
      await openProjectFolder();
      return <DefaultResponse>{
        type: "Ack",
      };

    case "GetFolderDialog":
      const folder = await selectFolder(message.title, message.root);
      return <GetFolderDialogResponse>{
        type: "GetFolderDialogResponse",
        filename: folder,
      };

    case "FileExists":
      return <FileExistsResponse>{
        type: "FileExistsResponse",
        exists: fs.existsSync(message.name),
      };

    case "GetFolderContents":
      return <GetFolderContentsResponse>{
        type: "GetFolderContentsResponse",
        contents: await getFolderContents(message.name),
      };

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
      return <FileOperationResponse>{
        type: "FileOperationResponse",
        error,
      };
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
      return <FileOperationResponse>{
        type: "FileOperationResponse",
        error: error,
      };
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
      return <ConfirmDialogResponse>{
        type: "ConfirmDialogResponse",
        confirmed: confirmResult.response === 1,
      };

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
      return <FileOperationResponse>{
        type: "FileOperationResponse",
        error: error,
      };
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
      return <FileOperationResponse>{
        type: "FileOperationResponse",
        error: error,
      };
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
      return <FileOperationResponse>{
        type: "FileOperationResponse",
        error: error,
      };
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
      return <GetFileContentsResponse>{
        type: "GetFileContentsResponse",
        contents,
      };
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
      return <FileOperationResponse>{
        type: "FileOperationResponse",
        error: error,
      };
    }

    case "CompileFile":
      const result = await getZ80CompilerService().compileFile(
        message.filename
      );
      return <CompileFileResponse>{
        type: "CompileFileResponse",
        result,
      };

    case "ShowMessageBox":
      const window = message.process === "emu" ? emuWindow : ideWindow;
      await dialog.showMessageBox(window.window, {
        message: message.message,
        title: message.title ?? "Klive",
        type: message.asError ? "error" : "info",
      });
      return <DefaultResponse>{ type: "Ack" };

    default:
      // --- If the main does not recognize a request, it forwards it to Emu
      return await emuForwarder.sendMessage(message);
  }
}
