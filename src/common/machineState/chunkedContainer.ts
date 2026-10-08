/*
 * Klive's chunked file container (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D4), shared by the state
 * file (`.kls`, magic `KLIVESTA`) and the debug recording (`.klr`, magic `KLIVEREC`). Pure: no Node,
 * no DOM.
 *
 *   magic (8 ASCII chars) · u16 container version · u16 flags
 *   u32 header length · header JSON (UTF-8)
 *   sections: { tag: 4 ASCII chars, u32 length, payload }...
 *
 * All numbers are little-endian. A reader keeps unknown sections by tag, so an older Klive reads a
 * newer file's known parts.
 */

export type ContainerSection = { tag: string; payload: Uint8Array };

export type ContainerRead<H> = {
  header: H;
  flags: number;
  /** Every section in file order, with where its tag starts */
  sections: (ContainerSection & { offset: number })[];
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}
function u32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

/** A section's tag, padded or cut to 4 characters */
export function sectionTag(tag: string): string {
  return tag.padEnd(4, " ").slice(0, 4);
}

/** Joins byte arrays */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** The bytes of one section */
export function encodeSection(tag: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  out.set(encoder.encode(sectionTag(tag)));
  out.set(u32(payload.length), 4);
  out.set(payload, 8);
  return out;
}

/** The bytes before the first section: the magic, the version, the flags and the header */
export function encodeContainerStart(magic: string, version: number, header: unknown, flags = 0): Uint8Array {
  if (magic.length !== 8) throw new Error("A container magic is 8 characters");
  const headerBytes = encoder.encode(JSON.stringify(header));
  return concatBytes([
    encoder.encode(magic),
    Uint8Array.from([...u16(version), ...u16(flags), ...u32(headerBytes.length)]),
    headerBytes
  ]);
}

/** Writes a whole container */
export function writeChunkedContainer(
  magic: string,
  version: number,
  header: unknown,
  sections: readonly ContainerSection[],
  flags = 0
): Uint8Array {
  return concatBytes([
    encodeContainerStart(magic, version, header, flags),
    ...sections.map((s) => encodeSection(s.tag, s.payload))
  ]);
}

/** Does this start with the magic? */
export function hasContainerMagic(bytes: Uint8Array, magic: string): boolean {
  if (bytes.length < 8) return false;
  return decoder.decode(bytes.subarray(0, 8)) === magic;
}

/**
 * Reads a container's framing
 * @param bytes The file
 * @param magic Its magic
 * @param version The container version this reader reads
 * @param what How messages name the file ("state file", "debug recording")
 * @throws When the magic is missing, the version differs, or the framing is truncated
 */
export function readChunkedContainer<H>(
  bytes: Uint8Array,
  magic: string,
  version: number,
  what: string,
  notThisKind: string
): ContainerRead<H> {
  if (!hasContainerMagic(bytes, magic)) throw new Error(notThisKind);
  const word = (o: number) => bytes[o] | (bytes[o + 1] << 8);
  const dword = (o: number) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
  if (bytes.length < 16) throw new Error(`The ${what} is truncated (header)`);
  const fileVersion = word(8);
  if (fileVersion !== version) {
    throw new Error(`The ${what} has container version ${fileVersion}; this Klive reads version ${version}`);
  }
  const length = dword(12);
  if (16 + length > bytes.length) throw new Error(`The ${what} is truncated (header)`);
  let header: H;
  try {
    header = JSON.parse(decoder.decode(bytes.subarray(16, 16 + length)));
  } catch {
    throw new Error(`The ${what}'s header is not valid`);
  }
  const sections: ContainerRead<H>["sections"] = [];
  let offset = 16 + length;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw new Error(`The ${what} is truncated (section at ${offset})`);
    const tag = decoder.decode(bytes.subarray(offset, offset + 4));
    const size = dword(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error(`The ${what}'s ${tag.trim()} section is truncated`);
    sections.push({ tag, payload: bytes.subarray(start, start + size), offset });
    offset = start + size;
  }
  return { header, flags: word(10), sections };
}
