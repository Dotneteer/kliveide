/**
 * The file name a ZX Spectrum Next program's NEX gets when it is run, debugged or exported.
 *
 * `.savenex file "game.nex"` names it. A program without that pragma used to reach the emulated SD
 * card as `_klive/undefined`: the run path gave the exported host file a fallback name but copied
 * and loaded `nexConfig.filename` as it was. The fallback is now the project's folder name
 * (`NextSprites/` -> `NextSprites.nex`), and every place that needs the name asks here.
 */

/** The name used when there is neither a `.savenex file` nor a usable project folder name */
export const FALLBACK_NEX_FILE_NAME = "output.nex";

/** The last segment of a path, with either separator */
function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? "";
}

/**
 * A NEX file name made from a project folder: its last segment, with characters NextZXOS's file
 * names and the SD card's FAT32 cannot hold replaced by `_`, and `.nex` added.
 */
export function defaultNexFileName(projectFolder?: string): string {
  const name = baseName(projectFolder ?? "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return name ? `${name}.nex` : FALLBACK_NEX_FILE_NAME;
}

/**
 * The NEX file name for a build: the program's own (`.savenex file`) when it has one, otherwise
 * the default made from the project folder.
 */
export function nexFileNameOf(savenexFile: string | undefined, projectFolder?: string): string {
  return savenexFile?.trim() ? savenexFile : defaultNexFileName(projectFolder);
}

/**
 * The name a NEX written to `filePath` gets on the emulated SD card (under `_klive/`): the
 * program's own name when it has one, so a run always loads the same file, otherwise the name
 * the file was written under.
 */
export function sdCardNexName(savenexFile: string | undefined, filePath: string): string {
  return savenexFile?.trim() ? savenexFile : baseName(filePath) || FALLBACK_NEX_FILE_NAME;
}
