import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

const VSCODE_FOLDER = ".vscode";
const SETTINGS_FILE = "settings.json";
const VSICONS_ASSOC_PROP = "vsicons.associations.files";
const VSICONS_FOLDER = "vsicons-custom-icons";
const ICON_FILE_SRC_FOLDER = "assets/file-icons";
const ICON_FILES: FileIconInfo[] = [
  {
    icon: "klivez80",
    extensions: ["z80asm"],
  },
  {
    icon: "klivebas",
    extensions: ["zxb", "zxbas", "bor"],
  },
  {
    icon: "tapetzx",
    extensions: ["tzx", "tap"],
  },
  {
    icon: "memory",
    extensions: ["view.memory"],
    filename: true,
  },
  {
    icon: "disassembly",
    extensions: ["view.disassembly"],
    filename: true,
  },
  {
    icon: "spectrum",
    extensions: ["spectrum.machine"],
    filename: true,
  },
  {
    icon: "viewbas",
    extensions: ["view.basic"],
    filename: true,
  },
];

export async function initKliveIcons(
  context: vscode.ExtensionContext
): Promise<void> {
  // --- Obtain the project folder
  const folders = vscode.workspace.workspaceFolders;
  const projFolder = folders ? folders[0].uri.fsPath : null;
  if (!projFolder) {
    return;
  }

  // --- Create the folder of custom icons
  let userSettingsFolder: string | undefined;
  switch (process.platform) {
    case "win32":
      userSettingsFolder = `${process.env["APPDATA"]}\\Code\\User`;
      break;
    case "darwin":
      userSettingsFolder = `${process.env["HOME"]}/Library/Application Support/Code/User`;
      break;
    case "linux":
      userSettingsFolder = `${process.env["HOME"]}/.config/Code/User`;
      break;
  }

  // --- Copy custom icons
  if (userSettingsFolder) {
    const iconSrcFolder = path.join(
      context?.extensionPath ?? "",
      "out",
      ICON_FILE_SRC_FOLDER
    );

    // --- Ensure destination folder
    const iconsFolder = path.join(userSettingsFolder, VSICONS_FOLDER);
    if (!fs.existsSync(iconsFolder)) {
      fs.mkdirSync(iconsFolder, { recursive: true });
    }

    // --- Copy icon files
    for (const iconInfo of ICON_FILES) {
      const source = path.join(iconSrcFolder, `file_type_${iconInfo.icon}.png`);
      const dest = path.join(iconsFolder, `file_type_${iconInfo.icon}.png`);
      fs.copyFileSync(source, dest);
    }
  }

  // --- Wait a few seconds to VS CODE recognize the new icons
  await new Promise((r) => setTimeout(r, 5000));

  // --- Check the .vscode folder
  const vscodeFolder = path.join(projFolder, VSCODE_FOLDER);
  if (!fs.existsSync(vscodeFolder)) {
    fs.mkdirSync(vscodeFolder, { recursive: true });
  }

  // --- Create the settings file, provided it does not exist
  const settingsFile = path.join(vscodeFolder, SETTINGS_FILE);
  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify({}));
  }

  // --- Read the contents of the file, and parse it
  try {
    const settingsContents = fs.readFileSync(settingsFile, "utf8");
    const settingsObject = JSON.parse(settingsContents);

    // --- Set vscode-icons associations
    let vsiconsAssocSettings = settingsObject[VSICONS_ASSOC_PROP] || [];
    const reduced = (vsiconsAssocSettings as any[]).filter(
      (s) => !ICON_FILES.some((ic) => ic.icon === s.icon)
    );
    for (const iconInfo of ICON_FILES) {
      reduced.push({
        icon: iconInfo.icon,
        extensions: iconInfo.extensions,
        filename: iconInfo.filename,
        format: "png"
      });
    }
    settingsObject[VSICONS_ASSOC_PROP] = reduced;

    fs.writeFileSync(settingsFile, JSON.stringify(settingsObject, null, 2));
  } catch (err) {
    vscode.window.showErrorMessage(err.message);
  }
}

interface FileIconInfo {
  icon: string;
  extensions: string[];
  filename?: boolean;
}
