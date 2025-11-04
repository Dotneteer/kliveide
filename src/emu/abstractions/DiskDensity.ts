/**
 * Available disk density types
 */
export enum DiskDensity {
  Auto = 0,
  SD_8 /* 8" SD floppy 5208 MF */,
  DD_8 /* 8" DD floppy 10416 */,
  SD /* 3125 bpt MF */,
  DD /* 6250 bpt */,
  DD_PLUS /* 6500 bpt e.g. Coin Op Hits */,
  HD /* 12500 bpt*/
}
