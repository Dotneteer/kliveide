/**
 * Types shared by the main process and the IDE for making a plain folder a Klive project
 * (`dev/plans/PLAIN_FOLDER_TO_PROJECT_PLAN.md` §3.3-§3.4).
 */

/** A template file that would land on something that already exists in the target folder */
export type TemplateConflict = {
  /** The file's path relative to the folder, with forward slashes */
  path: string;
  /**
   * True when the existing item is a file the template's file may replace. False when a folder (or
   * a file where the template needs a folder) is in the way: such a file is never written.
   */
  canOverwrite: boolean;
};

/** How to make a plain folder a Klive project */
export type ProjectConversionOptions = {
  /** The folder; it must be the folder open in the IDE, and not a Klive project yet */
  folder: string;
  machineId: string;
  modelId?: string;
  /**
   * The template to copy: required, because its `build.ksx` is what Compile, Run and Debug run
   * (decision Q7). A folder that has its own `build.ksx` keeps it unless it is in `overwrite`.
   */
  templateId: string;
  /** The existing files (relative, forward slashes) the template may replace */
  overwrite?: string[];
  /**
   * The build root, relative to the folder with forward slashes: an existing file or one the
   * template writes. When set it replaces the template's own build root.
   */
  buildRoot?: string;
};

/** What making a folder a project did */
export type ProjectConversionResult = {
  /** Template files written, relative to the folder */
  written?: string[];
  /** Template files not written because something already existed there */
  skipped?: string[];
  errorMessage?: string;
};
