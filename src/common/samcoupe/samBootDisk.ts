import { SAM_KLIVE_BOOT_IMAGE } from "./samKliveBootImage";
import { SAM_FILE_CODE, buildMgtImage } from "./mgtImage";
import { samExecPageForm, samLinearImage, type SamPlacement } from "./codePlacement";

/*
 * The disk Run boots and the `.mgt` export writes (`dev/plans/SAM_COUPE_PLAN.md` §3.4, §12, D7): Klive's
 * boot loader (`src/public/sam/sam-klive-boot.asm`) as the first file, at track 4 sector 1 with "BOOT" at
 * byte 256, then the program as a CODE file with its start page and offset and its exec address. The
 * ROM's F9 loads the loader, the loader loads the program and starts it. No DOS is needed.
 */

/** The boot loader's file name and the program's */
export const SAM_BOOT_FILE_NAME = "kliveboot";
export const SAM_PROGRAM_FILE_NAME = "program";

/** A bootable disk holding `placement` */
export function buildSamBootDisk(placement: SamPlacement, name = SAM_PROGRAM_FILE_NAME): Uint8Array {
  const { startPage, startOffset, data } = samLinearImage(placement);
  const exec = samExecPageForm(placement.entry);
  return buildMgtImage([
    { name: SAM_BOOT_FILE_NAME, type: SAM_FILE_CODE, data: SAM_KLIVE_BOOT_IMAGE, startPage: 1, startOffset: 0x8000 },
    {
      name: name.slice(0, 10),
      type: SAM_FILE_CODE,
      data,
      startPage,
      startOffset,
      execPage: exec.page,
      execOffset: exec.offset
    }
  ]);
}
