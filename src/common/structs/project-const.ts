export const KLIVE_PROJECT_ROOT = "KliveProjects";
export const CODE_FOLDER = "code";
export const DISK_FOLDER = "disks";
/** Where a project's new Microdrive cartridges (`.mdr`) go */
export const CARTRIDGE_FOLDER = "cartridges";
export const PROJECT_FILE = "klive.project";
export const BUILD_FILE = "build.ksx";
export const PROJECT_MERGE_FILE = "__$klive.project";
export const LAST_PROJECT_FOLDER = "lastProjectFolder";
export const PROJECT_TEMPLATES = "project-templates";
export const KEY_MAPPINGS = "keymappings";

export const MEDIA_TAPE = "tape";
export const MEDIA_DISK_A = "diskA";
export const MEDIA_DISK_B = "diskB";
/** The ZX Spectrum Next's SD card (card 0); unset is the model's own working copy */
export const MEDIA_SD_CARD = "sdCard";
/**
 * The DivMMC's SD card on the 48K, the 128K and the +2A/+3/+2E/+3E (`dev/plans/NEXT_SD_CARDS_PLAN.md`
 * D-10): a slot of its own, so a DivMMC card never becomes the Next's. Unset is an empty slot.
 */
export const MEDIA_DIVMMC_SD_CARD = "divMmcSdCard";
/**
 * The card number the DivMMC passes to the main process's SD card sector API (`readSdCardSector`,
 * `writeSdCardSector`, `getSdCardInfo`): its own slot. 0 and 1 are a ZX Spectrum Next's cards. The
 * machine names its card, so a request never depends on which machine the store thinks is running.
 */
export const SD_CARD_DIVMMC = 2;
/**
 * A ZX Spectrum Next's second SD card (card 1), on a model with two card readers (the KS3;
 * `dev/plans/ZXNEXT_KS3_FOLLOWUP_PLAN.md` phase 2). No default image: unset is an empty slot.
 */
export const MEDIA_SD_CARD_2 = "sdCard2";
/** The Timex 2068s' cartridge (`.dck`) in the DOCK */
export const MEDIA_DOCK = "dock";
/** The Interface 1's Microdrives 1 and 2 (`.mdr` cartridges; `dev/plans/MICRODRIVE_PLAN.md`) */
export const MEDIA_MICRODRIVE_1 = "microdrive1";
export const MEDIA_MICRODRIVE_2 = "microdrive2";
export const MEDIA_MICRODRIVES = [MEDIA_MICRODRIVE_1, MEDIA_MICRODRIVE_2] as const;

export const LANGUAGE_SETTINGS = "languages";
