/*
 * A probe's boot disk in the other image formats Klive reads (Phase 5: "@image sad" / "@image edsk"),
 * as src/emu/machines/samcoupe/SamDiskImage.ts reads them: SAD ("Aley's disk backup", data side-major) and
 * EDSK (ten 512-byte sectors, IDs 1-10, on every track). dev/scripts/sam-parity/disk-formats.cjs turns them
 * back into MGT images to read the result sector.
 */
const TRACK_BYTES = 10 * 512;
const CYLINDERS = 80;

export function mgtToSad(mgt: Uint8Array): Uint8Array {
  const out = new Uint8Array(22 + 2 * CYLINDERS * TRACK_BYTES);
  out.set([..."Aley's disk backup"].map((c) => c.charCodeAt(0)), 0);
  out.set([2, CYLINDERS, 10, 512 / 64], 18);
  for (let h = 0; h < 2; h++) {
    for (let t = 0; t < CYLINDERS; t++) {
      const from = (t * 2 + h) * TRACK_BYTES;
      out.set(mgt.subarray(from, from + TRACK_BYTES), 22 + (h * CYLINDERS + t) * TRACK_BYTES);
    }
  }
  return out;
}

export function mgtToEdsk(mgt: Uint8Array): Uint8Array {
  const block = 0x100 + TRACK_BYTES;
  const out = new Uint8Array(0x100 + 2 * CYLINDERS * block);
  const text = (at: number, s: string) => out.set([...s].map((c) => c.charCodeAt(0)), at);
  text(0, "EXTENDED CPC DSK File\r\nDisk-Info\r\n");
  text(0x22, "Klive parity ");
  out[0x30] = CYLINDERS;
  out[0x31] = 2;
  for (let i = 0; i < 2 * CYLINDERS; i++) out[0x34 + i] = block >> 8;
  let at = 0x100;
  for (let t = 0; t < CYLINDERS; t++) {
    for (let s = 0; s < 2; s++) {
      text(at, "Track-Info\r\n");
      out[at + 0x10] = t;
      out[at + 0x11] = s;
      out[at + 0x14] = 2;
      out[at + 0x15] = 10;
      out[at + 0x16] = 0x4e;
      out[at + 0x17] = 0xe5;
      for (let k = 0; k < 10; k++) {
        const info = at + 0x18 + k * 8;
        out.set([t, s, k + 1, 2, 0, 0, 0x00, 0x02], info);
      }
      out.set(mgt.subarray((t * 2 + s) * TRACK_BYTES, (t * 2 + s + 1) * TRACK_BYTES), at + 0x100);
      at += block;
    }
  }
  return out;
}
