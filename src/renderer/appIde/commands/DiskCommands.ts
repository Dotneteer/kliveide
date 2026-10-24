import type { IdeCommandContext } from "../../abstractions/IdeCommandContext";
import type { IdeCommandResult } from "../../abstractions/IdeCommandResult";
import type { ValidationMessage } from "../../abstractions/ValidationMessage";
import type { CommandArgumentInfo } from "@renderer/abstractions/IdeCommandInfo";
import {
  commandError,
  commandSuccess,
  commandSuccessWith,
  IdeCommandBase,
  validationError,
  writeMessage,
  writeSuccessMessage
} from "../services/ide-commands";
import { t } from "@common/i18n/i18n";
import { openDiskFileSystem } from "@common/diskfs/open";
import { hostFileToDiskFiles } from "@common/diskfs/importFiles";
import type { DiskFileEntry } from "@common/diskfs/types";
import { isHardDiskImage } from "@common/diskfs/hardDisk";
import { failureText } from "../DocumentPanels/DiskExplorer/diskErrorText";
import { addHostFiles, deleteFiles, failureOf, renameFile, runDiskEdit, type DiskExplorerPorts } from "../DocumentPanels/DiskExplorer/diskExplorerActions";

/*
 * `disk`: the Disk Explorer's operations from the command prompt, for recipes, scripts and the
 * automation API (`klive ide cmd "disk ls game.dsk"`) - .plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md,
 * B6. Every edit goes through the same main-process begin/commit pair as the explorer's (D4), so a
 * disk in the running machine's drive is paused, written and inserted again. Paths are the
 * project's, or absolute.
 */

const SUBCOMMANDS = ["ls", "info", "add", "get", "rm", "mv", "compact", "new", "mkdir"] as const;
type DiskSubcommand = (typeof SUBCOMMANDS)[number];

type DiskArgs = {
  action: string;
  image: string;
  arg1?: string;
  arg2?: string;
  "-start"?: number;
  "-d"?: boolean;
};

export class DiskCommand extends IdeCommandBase<DiskArgs> {
  readonly id = "disk";
  get description() {
    return t("commands.disk.description");
  }
  readonly usage = [
    "disk ls <image> [-d]",
    "disk info <image>",
    "disk add <image> <host-file> [<name>] [-start <address-or-line>]",
    "disk get <image> <disk-file> <host-file>",
    "disk rm <image> <disk-file>",
    "disk mv <image> <disk-file> <new-name>",
    "disk compact <image>",
    "disk new <image> <ss|ds|sse|dse|dse80|trd80ds|trd40ds|trd80ss|trd40ss|mdr|mdrblank>",
    "disk new <image.img|.hdf|.cim> <fat16|fat32> <MB>",
    "disk ls <image.img|.hdf|.cim> [<folder>] [-d]",
    "disk add <image.img|.hdf|.cim> <host-file-or-folder> [<folder>]",
    "disk mkdir <image.img|.hdf|.cim> <folder>"
  ];
  readonly argumentInfo: CommandArgumentInfo = {
    mandatory: [
      { name: "action", type: "string" },
      { name: "image", type: "string" }
    ],
    optional: [
      { name: "arg1", type: "string" },
      { name: "arg2", type: "string" }
    ],
    namedOptions: [{ name: "-start", type: "number", minValue: 0, maxValue: 0xffff }],
    commandOptions: ["-d"]
  };

  async validateCommandArgs(_context: IdeCommandContext, args: DiskArgs): Promise<ValidationMessage[]> {
    const action = args.action?.toLowerCase() as DiskSubcommand;
    if (!SUBCOMMANDS.includes(action)) {
      return [validationError(t("commands.disk.useOneOf", { choices: SUBCOMMANDS.join(", ") }))];
    }
    const needs = { add: 1, get: 2, rm: 1, mv: 2, new: isHardDiskImage(args.image ?? "") ? 2 : 1, mkdir: 1 } as Partial<Record<DiskSubcommand, number>>;
    const given = (args.arg1 ? 1 : 0) + (args.arg2 ? 1 : 0);
    if ((needs[action] ?? 0) > given) {
      return [validationError(t("commands.disk.missingArgument", { action }))];
    }
    return [];
  }

  async execute(context: IdeCommandContext, args: DiskArgs): Promise<IdeCommandResult> {
    const folder = context.store.getState()?.project?.folderPath;
    const resolve = (p: string) => (isAbsolute(p) || !folder ? p : `${folder}/${p}`);
    const image = resolve(args.image);
    const action = args.action.toLowerCase() as DiskSubcommand;
    if (isHardDiskImage(image)) {
      try {
        return await hardDiskAction(context, action, image, args, resolve);
      } catch (err) {
        return commandError(failureText(failureOf(err), t));
      }
    }
    let failure: string | undefined;
    const ports: DiskExplorerPorts = {
      beginEdit: (p) => context.mainApi.beginDiskImageEdit(p),
      commitEdit: (p, data, start) => context.mainApi.commitDiskImageEdit(p, data, start),
      cancelEdit: (start) => context.mainApi.cancelDiskImageEdit(start),
      reload: async () => {},
      pickHostFile: async () => undefined,
      readHostFile: (p) => context.mainApi.readBinaryFile(p),
      pickSavePath: async () => undefined,
      writeHostFile: async (p, data) => {
        await context.mainApi.saveBinaryFile(p, data);
      },
      // --- A command is its own confirmation; a name clash is refused instead of asked about
      confirm: async (kind) => kind !== "replace",
      askName: async () => args.arg2,
      askCodeStart: async () => args["-start"] ?? 32768,
      reportFailure: (f) => (failure = failureText(f, t))
    };
    const done = (ok: boolean, message: string) => {
      if (!ok) return commandError(failure ?? t("commands.disk.failed"));
      writeSuccessMessage(context.output, message);
      return commandSuccess;
    };

    try {
      switch (action) {
        case "new": {
          const at = image.lastIndexOf("/");
          const path = await context.mainApi.createDiskFile(image.slice(0, at), image.slice(at + 1), args.arg1!);
          writeSuccessMessage(context.output, t("commands.disk.created", { file: path }));
          return commandSuccessWith(t("commands.disk.created", { file: path }), { file: path });
        }
        case "ls":
        case "info": {
          const fs = openDiskFileSystem(await context.mainApi.readBinaryFile(image), image);
          const info = fs.info();
          writeMessage(
            context.output,
            t("commands.disk.summary", {
              system: info.system,
              format: info.format,
              free: Math.floor(info.freeBytes / 1024),
              total: Math.floor(info.totalBytes / 1024),
              files: fs.list().length
            })
          );
          if (action === "ls") {
            const files = fs.list({ deleted: !!args["-d"] }).filter((f) => args["-d"] || !f.deleted);
            for (const file of files) writeMessage(context.output, listingLine(file));
            return commandSuccessWith(undefined, { files: files.map((f) => ({ name: f.name, kind: f.kind, size: f.size, start: f.start })) });
          }
          return commandSuccessWith(undefined, { info });
        }
        case "add": {
          const host = resolve(args.arg1!);
          const fs = openDiskFileSystem(await context.mainApi.readBinaryFile(image), image);
          if (args.arg2 || (args["-start"] !== undefined && /\.bas$/i.test(host))) {
            // --- Under the name given (one file), or a BASIC program with its auto-run line
            const files = hostFileToDiskFiles(host, await context.mainApi.readBinaryFile(host), {
              system: fs.system,
              codeStart: args["-start"],
              autoRun: args["-start"]
            }).map((f, i) => (i === 0 && args.arg2 ? { ...f, name: args.arg2 } : f));
            return done(await runDiskEdit(ports, image, { kind: "add", files }), t("commands.disk.added", { count: files.length }));
          }
          return done(await addHostFiles(ports, image, fs.system, fs.list(), [host]), t("commands.disk.addedFile", { file: args.arg1! }));
        }
        case "get": {
          const fs = openDiskFileSystem(await context.mainApi.readBinaryFile(image), image);
          const data = fs.read(args.arg1!);
          await context.mainApi.saveBinaryFile(resolve(args.arg2!), data);
          writeSuccessMessage(context.output, t("commands.disk.extracted", { name: args.arg1!, file: args.arg2!, size: data.length }));
          return commandSuccess;
        }
        case "rm":
          return done(await deleteFiles(ports, image, [args.arg1!]), t("commands.disk.deleted", { name: args.arg1! }));
        case "mv":
          return done(await renameFile(ports, image, args.arg1!), t("commands.disk.renamed", { name: args.arg1!, newName: args.arg2! }));
        case "compact":
          return done(await runDiskEdit(ports, image, { kind: "compact" }), t("commands.disk.compacted"));
      }
    } catch (err) {
      return commandError(failureText(failureOf(err), t));
    }
    return commandSuccess;
  }
}

/**
 * The actions on a `.img`, `.hdf` or `.cim` (C2): the main process opens the image and makes the edit
 * (on the machine's SD card, under its lock), so nothing of the image comes here
 */
async function hardDiskAction (
  context: IdeCommandContext,
  action: DiskSubcommand,
  image: string,
  args: DiskArgs,
  resolve: (p: string) => string
): Promise<IdeCommandResult> {
  const api = context.mainApi;
  const ok = (message: string, value?: unknown) => {
    writeSuccessMessage(context.output, message);
    return value === undefined ? commandSuccess : commandSuccessWith(undefined, value);
  };
  switch (action) {
    case "new": {
      const fatType = args.arg1?.toLowerCase();
      const sizeMb = Number(args.arg2);
      if ((fatType !== "fat16" && fatType !== "fat32") || !Number.isInteger(sizeMb) || sizeMb < 1) {
        return commandError(t("commands.disk.badHardDisk"));
      }
      const path = await api.createHardDiskImage(image, { sizeMb, fatType: fatType === "fat16" ? 16 : 32 });
      return ok(t("commands.disk.created", { file: path }), { file: path });
    }
    case "ls":
    case "info": {
      const view = await api.queryHardDisk(image, { dir: action === "ls" ? args.arg1 : undefined, deleted: !!args["-d"] });
      if (view.fsError) return commandError(failureText(view.fsError, t));
      const info = view.info!;
      const files = view.files.filter((f) => args["-d"] || !f.deleted);
      writeMessage(
        context.output,
        t("commands.disk.summary", {
          system: info.system,
          format: info.label || info.format,
          free: Math.floor(info.freeBytes / 1024),
          total: Math.floor(info.totalBytes / 1024),
          files: files.length
        })
      );
      if (action === "info") return commandSuccessWith(undefined, { info, partitions: view.partitions });
      for (const f of files) {
        const name = f.name.slice(f.name.lastIndexOf("/") + 1);
        writeMessage(context.output, `${(f.deleted ? `(${name})` : name).padEnd(32)}${f.isDirectory ? "<DIR>".padStart(12) : String(f.size).padStart(12)}`);
      }
      return commandSuccessWith(undefined, { files: files.map((f) => ({ name: f.name, size: f.size, folder: !!f.isDirectory })) });
    }
    case "add": {
      const host = resolve(args.arg1!);
      const base = host.replace(/^.*[\\/]/, "");
      const target = args.arg2 ? `${args.arg2.replace(/\/+$/, "")}/${base}` : base;
      const bytes = await api.readBinaryFile(host).catch(() => undefined);
      if (bytes === undefined) await api.copyFolderToHardDisk(image, host, target);
      else await api.editHardDisk(image, { kind: "add", files: [{ name: target, kind: "raw", data: bytes }], replace: true });
      return ok(t("commands.disk.addedFile", { file: target }));
    }
    case "get": {
      const data = await api.readHardDiskFile(image, args.arg1!);
      await api.saveBinaryFile(resolve(args.arg2!), data);
      return ok(t("commands.disk.extracted", { name: args.arg1!, file: args.arg2!, size: data.length }));
    }
    case "rm":
      await api.editHardDisk(image, { kind: "delete", names: [args.arg1!] });
      return ok(t("commands.disk.deleted", { name: args.arg1! }));
    case "mv":
      await api.editHardDisk(image, { kind: "rename", name: args.arg1!, newName: args.arg2! });
      return ok(t("commands.disk.renamed", { name: args.arg1!, newName: args.arg2! }));
    case "mkdir":
      await api.editHardDisk(image, { kind: "mkdir", path: args.arg1! });
      return ok(t("commands.disk.folderCreated", { name: args.arg1! }));
    default:
      return commandError(t("commands.disk.notOnHardDisk", { action }));
  }
}

function listingLine (file: DiskFileEntry): string {
  const name = (file.deleted ? `(${file.name})` : file.name).padEnd(14);
  const kind = file.kind.padEnd(12);
  const size = String(file.size).padStart(6);
  const start = file.start === undefined ? "" : String(file.start).padStart(7);
  return `${name}${kind}${size}${start}`;
}

function isAbsolute (p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p) || p.startsWith("\\\\");
}
