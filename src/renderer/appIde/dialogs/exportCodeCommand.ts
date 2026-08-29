import { getNodeExtension, getNodeName } from "@renderer/appIde/project/project-node";

export type ExportCodeCommandOptions = {
  formatId: string;
  exportFolder: string;
  exportName: string;
  programName: string;
  borderId: string;
  startBlock: boolean;
  addPause: boolean;
  singleBlock: boolean;
  startAddress: string;
  addClear: boolean;
  screenFilename: string;
};

export function buildExportCodeCommand(options: ExportCodeCommandOptions) {
  let filename = options.exportName;
  const exportExt = getNodeExtension(filename);
  if (!exportExt || exportExt === ".") filename += `.${options.formatId}`;
  const fullFilename = (options.exportFolder ? `${options.exportFolder}/${filename}` : filename)
    .replaceAll("\\", "/");
  const programName = options.programName || getNodeName(options.exportName);
  const command = `expc "${fullFilename}" -n ${programName} -f ${options.formatId}${
    options.startBlock ? " -as" : ""
  }${options.addPause ? " -p" : ""}${
    options.borderId !== "none" ? ` -b ${options.borderId}` : ""
  }${options.singleBlock ? " -sb" : ""}${
    options.startAddress ? ` -addr ${options.startAddress}` : ""
  }${options.addClear ? " -c" : ""}${
    options.screenFilename ? ` -scr "${options.screenFilename.replaceAll("\\", "/")}"` : ""}`;
  return { command, fullFilename };
}
