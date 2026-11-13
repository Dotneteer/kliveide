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
export const MEDIA_SD_CARD = "sdCard";
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
