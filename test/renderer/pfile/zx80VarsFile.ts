/*
 * A ZX80 `.O` file recorded from the real 4K ROM in the harness (`test/zx8081-hw/o-file-viewer.test.ts`,
 * which checks it still matches): memory from $4000 up to E_LINE after this program ran -
 *
 *   10 LET A=1
 *   20 LET TOTAL=-25
 *   30 LET B$="HI"
 *   40 DIM C(3)
 *   45 LET C(1)=7
 *   50 FOR I=1 TO 10
 *   70 FOR J=2 TO 5
 *
 * VARS is $406C, E_LINE $4093, D_FILE $4093.
 */
export const ZX80_VARS_FILE_HEX =
  "ffc046006e4046006c40934093409440b0400200000000000000870700006403" +
  "664000382117ffff000af026e31d760014f03934392631e3dc1e2176001ef027" +
  "0de3012d2e01760028e928da1fd976002df028da1dd9e323760032eb2ee31dd6" +
  "1d1c760046eb2fe31ed6217666010059343926b1e7ff872d2e01a80300000700" +
  "00000000ee01000a003300ef02000500470080";

export const zx80VarsFile = () => new Uint8Array(Buffer.from(ZX80_VARS_FILE_HEX, "hex"));
