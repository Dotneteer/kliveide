import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { IdeCommandResult } from "@renderer/abstractions/IdeCommandResult";
import type {
  ZxNextStorageCopyRequest,
  ZxNextStorageCopyResult
} from "@common/messaging/MainApi";
import { MI_ZXNEXT } from "@common/machines/constants";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import {
  getZxNextStorageOverwriteTarget,
  isCimFilePath,
  normalizeZxNextStoragePath,
  normalizeZxNextStorageTargetPath
} from "@common/utils/zx-next-storage-paths";
import type { ValidationMessage } from "@renderer/abstractions/ValidationMessage";
import {
  commandError,
  commandSuccessWith,
  IdeCommandBase,
  validationError,
  writeSuccessMessage
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";

export type ZxNextStorageCopyCommandArgs = {
  direction: string;
  source: string;
  destination: string;
  "-cim"?: string;
};

export class ZxNextStorageCopyCommand extends IdeCommandBase<ZxNextStorageCopyCommandArgs> {
  readonly id = "ncp";
  get description() {
    return t("commands.ncp.description");
  }
  readonly aliases = ["next-copy"];
  readonly usage = [
    "ncp to <host-source> <next-destination> [-cim <cim-file>]",
    "ncp from <next-source> <host-destination> [-cim <cim-file>]"
  ];

  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "direction" },
      { name: "source", type: "string" },
      { name: "destination", type: "string" }
    ],
    namedOptions: [{ name: "-cim", type: "string" }]
  };

  async validateCommandArgs(
    context: IdeCommandContext,
    args: ZxNextStorageCopyCommandArgs
  ): Promise<ValidationMessage[]> {
    const messages: ValidationMessage[] = [];
    const direction = args.direction?.toLowerCase();

    if (direction !== "to" && direction !== "from") {
      messages.push(validationError(t("commands.ncp.direction")));
    }

    if (!args.source?.trim()) {
      messages.push(validationError(t("commands.ncp.emptySource")));
    }
    if (!args.destination?.trim()) {
      messages.push(validationError(t("commands.ncp.emptyDestination")));
    }

    if (args["-cim"] !== undefined && !isCimFilePath(args["-cim"])) {
      messages.push(validationError(t("commands.ncp.cimFile")));
    }

    const machineState = context.store.getState().emulatorState?.machineState;
    if (
      machineState === MachineControllerState.Running ||
      machineState === MachineControllerState.Paused
    ) {
      messages.push(validationError(t("commands.ncp.mustStop")));
    }

    if (args["-cim"] === undefined) {
      const machineId = context.store.getState().emulatorState?.machineId;
      if (machineId !== MI_ZXNEXT) {
        messages.push(
          validationError(t("commands.ncp.needsNext"))
        );
      }
    }

    if (direction === "to") {
      try {
        normalizeZxNextStorageTargetPath(args.destination);
      } catch (err) {
        messages.push(validationError(getErrorMessage(err)));
      }
    } else if (direction === "from") {
      try {
        normalizeZxNextStoragePath(args.source);
      } catch (err) {
        messages.push(validationError(getErrorMessage(err)));
      }
    }

    return messages;
  }

  async execute(
    context: IdeCommandContext,
    args: ZxNextStorageCopyCommandArgs
  ): Promise<IdeCommandResult> {
    const request = createZxNextStorageCopyRequest(args);

    return await executeCopyWithOverwriteConfirmation(context, request);
  }
}

export function createZxNextStorageCopyRequest(
  args: ZxNextStorageCopyCommandArgs
): ZxNextStorageCopyRequest {
  const direction = args.direction.toLowerCase() as "to" | "from";
  return {
    direction,
    storage: args["-cim"] ? { kind: "cim", cimFile: args["-cim"] } : { kind: "current" },
    hostPath: direction === "to" ? args.source : args.destination,
    storagePath:
      direction === "to"
        ? normalizeStorageTargetForRequest(args.destination)
        : normalizeZxNextStoragePath(args.source)
  };
}

async function executeCopyWithOverwriteConfirmation(
  context: IdeCommandContext,
  request: ZxNextStorageCopyRequest
): Promise<IdeCommandResult> {
  try {
    const result = await context.mainApi.copyZxNextStorageFile(request);
    return copySucceeded(context, request, result);
  } catch (err) {
    const message = getErrorMessage(err);
    const target = getZxNextStorageOverwriteTarget(message);
    if (!target) {
      return commandError(message);
    }

    const overwrite = await context.mainApi.confirmFileOverwrite(target);
    if (!overwrite) {
      return commandError(t("commands.ncp.cancelled"));
    }

    try {
      const result = await context.mainApi.copyZxNextStorageFile({
        ...request,
        overwrite: true
      });
      return copySucceeded(context, { ...request, overwrite: true }, result);
    } catch (retryError) {
      return commandError(getErrorMessage(retryError));
    }
  }
}

function copySucceeded(
  context: IdeCommandContext,
  request: ZxNextStorageCopyRequest,
  result: ZxNextStorageCopyResult
): IdeCommandResult {
  const from = request.direction === "to" ? result.hostPath : result.storagePath;
  const to = request.direction === "to" ? result.storagePath : result.hostPath;
  writeSuccessMessage(
    context.output,
    t("commands.ncp.copied", { count: result.bytesCopied, from, to, cim: result.cimFile })
  );
  return commandSuccessWith(t("commands.ncp.completed"), result);
}

function normalizeStorageTargetForRequest(storagePath: string): string {
  const target = normalizeZxNextStorageTargetPath(storagePath);
  if (!target.directoryHint) {
    return target.path;
  }
  return target.path ? `${target.path}/` : "/";
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
