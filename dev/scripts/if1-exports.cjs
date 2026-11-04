/**
 * The exports of `zx-spectrum-if1.c` (.plans/MICRODRIVE_PLAN.md, Phase 1): the Interface 1 and its
 * Microdrives on the 48K and 128K cores, under the core's prefix.
 */
function if1Exports(prefix) {
  return [
    "If1SetPresent",
    "If1GetPresent",
    "If1RomPtr",
    "If1RomUploaded",
    "If1GetPaged",
    "If1SetPaged",
    "If1GetControl",
    "If1GetSelect",
    "If1GetFrozen",
    "If1GetDriveCount",
    "If1GetMaxSlots",
    "If1DriveImagePtr",
    "If1Insert",
    "If1Eject",
    "If1SetWriteProtected",
    "If1GetDriveInfo",
    "If1GetDirtyRevision",
    "If1GetSlotDirty",
    "If1ClearDirty",
    "If1GetSlotSignal"
  ].map((name) => `${prefix}${name}`);
}

module.exports = { if1Exports };
