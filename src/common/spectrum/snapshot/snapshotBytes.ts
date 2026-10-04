/*
 * A little-endian byte builder the snapshot writers share
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.2). Pure: no Node, no DOM.
 */

/** Collects bytes and hands them back as one array */
export class SnapshotBytes {
  private readonly chunks: Uint8Array[] = [];
  private pending: number[] = [];
  private total = 0;

  /** The number of bytes written so far */
  get length(): number {
    return this.total;
  }

  /** Appends single bytes (each masked to 8 bits) */
  byte(...values: number[]): this {
    for (const v of values) this.pending.push(v & 0xff);
    this.total += values.length;
    return this;
  }

  /** Appends a little-endian 16-bit word */
  word(value: number): this {
    return this.byte(value, value >> 8);
  }

  /** Appends a little-endian 32-bit value */
  dword(value: number): this {
    return this.byte(value, value >> 8, value >> 16, value >>> 24);
  }

  /** Appends `count` copies of `value` */
  fill(count: number, value = 0): this {
    for (let i = 0; i < count; i++) this.pending.push(value & 0xff);
    this.total += count;
    return this;
  }

  /** Appends a block of bytes */
  bytes(data: Uint8Array): this {
    this.flush();
    this.chunks.push(data);
    this.total += data.length;
    return this;
  }

  /** Appends a string as Latin-1 into a fixed-size field, NUL-padded (and cut to fit) */
  fixedString(text: string, size: number): this {
    for (let i = 0; i < size; i++) {
      this.pending.push(i < text.length ? text.charCodeAt(i) & 0xff : 0);
    }
    this.total += size;
    return this;
  }

  /** The bytes written */
  toArray(): Uint8Array {
    this.flush();
    const out = new Uint8Array(this.total);
    let offset = 0;
    for (const c of this.chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return out;
  }

  private flush(): void {
    if (this.pending.length) {
      this.chunks.push(Uint8Array.from(this.pending));
      this.pending = [];
    }
  }
}

/** Turns a string into Latin-1 bytes */
export function latin1Bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/** A saved snapshot and what its format could not keep */
export type SnapshotWriteResult = {
  bytes: Uint8Array;
  /** What the file does not hold, so loading it gives a slightly different machine state */
  losses: string[];
};

/**
 * Thrown when a snapshot cannot be written in a format at all, because the file would load into a
 * different machine state (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` D3)
 */
export class SnapshotRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotRefusedError";
  }
}
