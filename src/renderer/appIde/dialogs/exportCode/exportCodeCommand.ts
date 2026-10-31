import { getNodeExtension, getNodeName } from "@renderer/appIde/project/project-paths";

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
  // --- A ZX80/ZX81 program file has none of the Spectrum's tape and loader options
  if (options.formatId === "p" || options.formatId === "o") {
    const autoRun = options.formatId === "p" && options.startBlock ? " -as" : "";
    return { command: `expc "${fullFilename}" -f ${options.formatId}${autoRun}`, fullFilename };
  }
  const programName = options.programName || getNodeName(options.exportName);
  // --- An HT-1080Z .cmd or .cas: the program name is the module's name, nothing else applies
  if (options.formatId === "cmd" || options.formatId === "cas" || options.formatId === "com") {
    return { command: `expc "${fullFilename}" -n ${programName} -f ${options.formatId}`, fullFilename };
  }
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
