import fs from "fs";
import path from "path";

import type {
  ZxNextStorageCopyRequest,
  ZxNextStorageCopyResult,
  ZxNextStorageRef
} from "@common/messaging/MainApi";
import {
  getZxNextStoragePathBaseName,
  isCimFilePath,
  normalizeZxNextStoragePath,
  normalizeZxNextStorageTargetPath,
  ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX
} from "@common/utils/zx-next-storage-paths";
import { CimFile } from "./fat32/CimFileManager";
import { Fat32Volume } from "./fat32/Fat32Volume";
import { FileManager } from "./fat32/FileManager";
import { O_RDONLY } from "./fat32/Fat32Types";

export type ZxNextStorageCopyOptions = {
  projectFolder?: string;
  currentStoragePath?: string;
  invalidateCurrentStorage?: () => void;
};

export async function copyZxNextStorageFile(
  request: ZxNextStorageCopyRequest,
  options: ZxNextStorageCopyOptions = {}
): Promise<ZxNextStorageCopyResult> {
  if (request.direction !== "to" && request.direction !== "from") {
    throw new Error(`Invalid ZX Spectrum Next storage copy direction: ${request.direction}`);
  }

  const hostTargetDirectoryHint =
    request.direction === "from" && /[\\/]$/.test(request.hostPath.trim());
  const hostPath = resolveZxNextHostPath(request.hostPath, options.projectFolder);
  const cimFilePath = resolveZxNextCimFilePath(
    request.storage,
    options.currentStoragePath,
    options.projectFolder
  );

  if (!fs.existsSync(cimFilePath) || !fs.statSync(cimFilePath).isFile()) {
    throw new Error(`CIM file does not exist: ${cimFilePath}`);
  }
  if (!isCimFilePath(cimFilePath)) {
    throw new Error(`ZX Spectrum Next storage must be a .cim file: ${cimFilePath}`);
  }

  if (request.direction === "to") {
    if (!fs.existsSync(hostPath) || !fs.statSync(hostPath).isFile()) {
      throw new Error(`Host source file does not exist: ${hostPath}`);
    }
  }

  const cimFile = new CimFile(cimFilePath);
  try {
    const volume = new Fat32Volume(cimFile);
    volume.init();
    const fileManager = new FileManager(volume);
    const copyTarget =
      request.direction === "to"
        ? resolveCopyToStorageTarget(volume, request.storagePath, hostPath)
        : resolveCopyFromStorageTarget(
            volume,
            request.storagePath,
            hostPath,
            hostTargetDirectoryHint
          );

    if (copyTarget.targetExists && !request.overwrite) {
      throw new Error(`${ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX}${copyTarget.displayTarget}`);
    }

    if (
      request.direction === "to" &&
      shouldInvalidateCurrentStorage(request.storage, cimFilePath, options.currentStoragePath)
    ) {
      options.invalidateCurrentStorage?.();
    }

    const bytesCopied =
      request.direction === "to"
        ? await fileManager.copyFile(hostPath, copyTarget.storagePath)
        : await fileManager.copyFileFromVolume(copyTarget.storagePath, copyTarget.hostPath);

    return {
      hostPath: copyTarget.hostPath,
      storagePath: copyTarget.storagePath,
      cimFile: cimFilePath,
      bytesCopied
    };
  } finally {
    cimFile.close();
  }
}

export function resolveZxNextHostPath(hostPath: string, projectFolder?: string): string {
  if (typeof hostPath !== "string" || !hostPath.trim()) {
    throw new Error("Host path cannot be empty.");
  }

  const trimmedPath = hostPath.trim();
  if (isAbsoluteHostPath(trimmedPath)) {
    return trimmedPath;
  }

  return path.resolve(projectFolder || process.cwd(), trimmedPath);
}

export function resolveZxNextCimFilePath(
  storage: ZxNextStorageRef,
  currentStoragePath?: string,
  projectFolder?: string
): string {
  if (storage.kind === "current") {
    if (!currentStoragePath?.trim()) {
      throw new Error("No current ZX Spectrum Next storage image is configured.");
    }
    return resolveZxNextHostPath(currentStoragePath, projectFolder);
  }

  return resolveZxNextHostPath(storage.cimFile, projectFolder);
}

export function isAbsoluteHostPath(hostPath: string): boolean {
  return (
    path.isAbsolute(hostPath) ||
    /^[A-Za-z]:[\\/]/.test(hostPath) ||
    /^\\\\[^\\]+\\[^\\]+/.test(hostPath) ||
    /^\/\/[^/]+\/[^/]+/.test(hostPath)
  );
}

export function getHostPathBaseName(hostPath: string): string {
  const normalized = hostPath.trim().replace(/[\\/]+$/, "");
  const segments = normalized.split(/[\\/]+/);
  const baseName = segments[segments.length - 1];
  if (!baseName) {
    throw new Error(`Cannot determine source file name from host path: ${hostPath}`);
  }
  return baseName;
}

export function areSameHostFilePath(left: string, right: string): boolean {
  const normalizedLeft = resolveRealPathIfPossible(left);
  const normalizedRight = resolveRealPathIfPossible(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function shouldInvalidateCurrentStorage(
  storage: ZxNextStorageRef,
  cimFilePath: string,
  currentStoragePath?: string
): boolean {
  if (storage.kind === "current") {
    return true;
  }

  return !!currentStoragePath && areSameHostFilePath(cimFilePath, currentStoragePath);
}

function resolveCopyToStorageTarget(
  volume: Fat32Volume,
  requestedStoragePath: string,
  hostSourcePath: string
): ResolvedCopyTarget {
  const target = normalizeZxNextStorageTargetPath(requestedStoragePath);
  const sourceName = getHostPathBaseName(hostSourcePath);
  const existingTarget = target.path ? volume.open(target.path, O_RDONLY) : null;
  let storagePath = target.path;

  try {
    if (target.directoryHint && existingTarget && !existingTarget.isDirectory()) {
      throw new Error(`Storage target path is not a directory: ${target.path}`);
    }
    if (existingTarget?.isDirectory() || target.directoryHint) {
      storagePath = target.path ? path.posix.join(target.path, sourceName) : sourceName;
    }
  } finally {
    existingTarget?.close();
  }

  if (!storagePath) {
    throw new Error("Storage target path must include a file name.");
  }

  return {
    hostPath: hostSourcePath,
    storagePath,
    displayTarget: storagePath,
    targetExists: storageFileExists(volume, storagePath)
  };
}

function resolveCopyFromStorageTarget(
  volume: Fat32Volume,
  requestedStoragePath: string,
  hostTargetPath: string,
  hostTargetDirectoryHint: boolean
): ResolvedCopyTarget {
  const storagePath = normalizeZxNextStoragePath(requestedStoragePath);
  const sourceFile = volume.open(storagePath, O_RDONLY);
  if (!sourceFile) {
    throw new Error(`Source file not found in storage: ${storagePath}`);
  }

  try {
    if (sourceFile.isDirectory()) {
      throw new Error(`Source path is a directory: ${storagePath}`);
    }
  } finally {
    sourceFile.close();
  }

  let finalHostPath = hostTargetPath;
  const hostTargetIsFolder =
    hostTargetDirectoryHint ||
    (fs.existsSync(hostTargetPath) && fs.statSync(hostTargetPath).isDirectory());
  if (
    hostTargetDirectoryHint &&
    fs.existsSync(hostTargetPath) &&
    !fs.statSync(hostTargetPath).isDirectory()
  ) {
    throw new Error(`Host target path is not a directory: ${hostTargetPath}`);
  }
  if (hostTargetIsFolder) {
    finalHostPath = path.join(hostTargetPath, getZxNextStoragePathBaseName(storagePath));
  }

  if (fs.existsSync(finalHostPath) && fs.statSync(finalHostPath).isDirectory()) {
    throw new Error(`Host target path is a directory: ${finalHostPath}`);
  }

  return {
    hostPath: finalHostPath,
    storagePath,
    displayTarget: finalHostPath,
    targetExists: fs.existsSync(finalHostPath)
  };
}

function storageFileExists(volume: Fat32Volume, storagePath: string): boolean {
  const file = volume.open(storagePath, O_RDONLY);
  if (!file) {
    return false;
  }
  try {
    if (file.isDirectory()) {
      throw new Error(`Storage target path is a directory: ${storagePath}`);
    }
    return true;
  } finally {
    file.close();
  }
}

function resolveRealPathIfPossible(filePath: string): string {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

type ResolvedCopyTarget = {
  hostPath: string;
  storagePath: string;
  displayTarget: string;
  targetExists: boolean;
};
