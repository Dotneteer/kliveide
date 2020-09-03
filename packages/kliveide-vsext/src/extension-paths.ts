import * as vscode from "vscode";
import * as path from "path";

// --- We use this context of the extension
let context: vscode.ExtensionContext | null = null;

// --- Path constant values
const OUT_PATH = "out";
const ASSETS_PATH = "out/assets";

/**
 * Sets up the extension contex to use for path calculations
 * @param ctx Extension context
 */
export function setExtensionContext(ctx: vscode.ExtensionContext): void {
  context = ctx;
}
/**
 * Gets the specified path within the extension
 * @param {String[]} path Path within the extension
 */
export function getExtensionPath(...paths: string[]): string {
  return path.join(context?.extensionPath ?? "", ...paths);
}

/**
 * Gets the specified file resource URI
 * @param {String} basePath Base path of the resource within the extension folder
 * @param {String} resource Resource file name
 */
export function getFileResource(
  basePath: string,
  resource: string
): vscode.Uri {
  const file = vscode.Uri.file(path.join(basePath, resource));
  return file.with({ scheme: "vscode-resource" });
}

/**
 * Gets a resource from the "out" extension folder
 * @param {String} resource Resource file name
 */
export function getOuFileResource(resource: string): vscode.Uri {
  return getFileResource(getExtensionPath(OUT_PATH), resource);
}

/**
 * Gets a resource from the "assets" extension folder
 * @param {String} resource Resource file name
 */
export function getAssetsFileResource(resource: string): vscode.Uri {
  return getFileResource(getExtensionPath(ASSETS_PATH), resource);
}

/**
 * Gets a file name from the "out" extension folder
 * @param {String} filename Filename
 */
export function getOuFileName(filename: string): string {
  return path.join(getExtensionPath(OUT_PATH), filename);
}

/**
 * Gets a file name from the "assets" extension folder
 * @param {String} filename Filename
 */
export function getAssetsFileName(filename: string): string {
  return path.join(getExtensionPath(ASSETS_PATH), filename);
}
