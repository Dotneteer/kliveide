/**
 * The exports of `zx-spectrum-divmmc-classic.c` (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C4):
 * the DivMMC and its SD card on the 48K, 128K and +2A/+3 cores, under the core's prefix.
 */
function divMmcClassicExports(prefix) {
  return [
    "DivMmcSetPresent",
    "DivMmcGetPresent",
    "DivMmcMemoryPtr",
    "DivMmcMemorySize",
    "DivMmcPressNmi",
    "DivMmcGetPortE3",
    "DivMmcGetMapped",
    "DivMmcGetAutoMapActive",
    "DivMmcGetPageSource",
    "GetSdHostCommand",
    "GetSdHostSector",
    "GetSdWriteBufferPtr",
    "GetSdWriteBufferLength",
    "ClearSdHostCommand",
    "SetSdReadResponse",
    "SetSdWriteResponse",
    "SetSdCardInfo"
  ].map((name) => `${prefix}${name}`);
}

module.exports = { divMmcClassicExports };
