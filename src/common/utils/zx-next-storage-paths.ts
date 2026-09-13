export const ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX = "ZX_NEXT_STORAGE_TARGET_EXISTS:";

export function isCimFilePath(filePath: string): boolean {
  return typeof filePath === "string" && /\.cim$/i.test(filePath.trim());
}

export function normalizeZxNextStoragePath(storagePath: string): string {
  if (typeof storagePath !== "string" || !storagePath.trim()) {
    throw new Error("Storage path cannot be empty.");
  }

  const normalized = storagePath.trim().replace(/\\/g, "/");
  if (normalized.endsWith("/")) {
    throw new Error("Storage path must include a file name.");
  }

  const pathWithoutRoot = normalized.replace(/^\/+/, "");
  if (!pathWithoutRoot) {
    throw new Error("Storage path must include a file name.");
  }

  const segments = pathWithoutRoot.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Storage path cannot contain empty, '.' or '..' segments.");
  }

  return segments.join("/");
}

export function normalizeZxNextStorageTargetPath(storagePath: string): {
  path: string;
  directoryHint: boolean;
} {
  if (typeof storagePath !== "string" || !storagePath.trim()) {
    throw new Error("Storage path cannot be empty.");
  }

  const trimmedPath = storagePath.trim();
  const directoryHint = /[\\/]$/.test(trimmedPath);
  const normalized = trimmedPath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");

  if (!normalized) {
    return { path: "", directoryHint: true };
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Storage path cannot contain empty, '.' or '..' segments.");
  }

  return {
    path: segments.join("/"),
    directoryHint
  };
}

export function getZxNextStoragePathBaseName(storagePath: string): string {
  const normalized = normalizeZxNextStoragePath(storagePath);
  const segments = normalized.split("/");
  return segments[segments.length - 1];
}

export function getZxNextStorageOverwriteTarget(message: string): string | undefined {
  return message.startsWith(ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX)
    ? message.substring(ZX_NEXT_STORAGE_TARGET_EXISTS_PREFIX.length)
    : undefined;
}
