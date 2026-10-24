import { resolveHomeFilePath } from "../../main/projects";
import { createBlankTrd, type TrdGeometry } from "@emu/machines/disk/trd/trdImage";
import { createBlankDsk, isBlankDskType } from "@emu/machines/disk/blank-dsk";
import { createMdrOfType, isMdrCartridgeType } from "@emu/machines/microdrive/mdrImage";
import fs from "fs";
import path from "path";
import os from "os";

/** The TR-DOS disk types of the Create Disk dialog (`TRD_DISK_TYPES`) and their geometries */
const TRD_GEOMETRIES: Record<string, TrdGeometry> = {
  trd80ds: { cylinders: 80, sides: 2 },
  trd40ds: { cylinders: 40, sides: 2 },
  trd80ss: { cylinders: 80, sides: 1 },
  trd40ss: { cylinders: 40, sides: 1 }
};

export function createDiskFile (
  foldername: string,
  filename: string,
  diskFormat: string
): string {
  const trdGeometry = TRD_GEOMETRIES[diskFormat];
  let contents: Uint8Array;
  if (trdGeometry) {
    // --- A blank, TR-DOS-formatted disk for the Pentagon's Beta 128
    contents = createBlankTrd(trdGeometry, path.parse(filename).name.slice(0, 8));
  } else if (isMdrCartridgeType(diskFormat)) {
    // --- A Microdrive cartridge for the Interface 1: formatted, or blank for the ROM's FORMAT
    contents = createMdrOfType(diskFormat, path.parse(filename).name);
  } else if (isBlankDskType(diskFormat)) {
    // --- A blank, +3DOS-formatted DSK for the +3 (`blank-dsk.ts`)
    contents = createBlankDsk(diskFormat);
  } else {
    throw new Error(`Unknown disk type: ${diskFormat}`);
  }
  const fileExt = path.extname(filename);
  foldername = foldername ? resolveHomeFilePath(foldername) : os.homedir();
  if (!fileExt) {
    filename += trdGeometry ? ".trd" : isMdrCartridgeType(diskFormat) ? ".mdr" : ".dsk";
  }
  if (!fs.existsSync(foldername)) {
    fs.mkdirSync(foldername, { recursive: true });
  }
  const fileWithPath = foldername ? `${foldername}/${filename}` : filename;
  const fullPath = resolveHomeFilePath(fileWithPath);
  fs.writeFileSync(fullPath, contents);
  return fullPath;
}
