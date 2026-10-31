/*
 * The host side of Klive's FILE: device (`.plans/ENTERPRISE_PLAN.md` §9.2, D8; the ROM is
 * `fileio/ep-klive-fileio.asm`).
 *
 * The ROM turns each EXOS device call into a request on port BCh and the emulated CPU waits for the
 * answer (`ep-ports.c`). This class does the call. Register conventions are EXOS's (the kernel
 * specification, chapters 7 and 11): A is the channel number - on the stack, where the ROM pushed it,
 * and the status goes back there; DE points at a name (open, create) in the current paging, or at the
 * caller's buffer (block read and write, the status block) in the caller's paging, which EXOS keeps in
 * the system segment at BFFCh-BFFFh while a device runs.
 *
 * An open file is a byte array in memory: reads, writes and seeks are answered at once, inside the
 * frame. Opening a file, closing one that was written and destroying one need the file store - the
 * main process in the app, a map in the tests - and finish asynchronously (`EpHostFsAsync`), while the
 * CPU keeps waiting.
 */

/** EXOS status codes the device returns (the kernel specification, part II §3) */
export const EXOS_OK = 0x00;
export const EXOS_ICHAN = 0xfb;
export const EXOS_NOFN = 0xe7;
export const EXOS_EOF = 0xe4;
export const EXOS_PROT = 0xe3;
/** A file that is not there: EXOS has no code of its own for it; the protection error is the closest */
export const EP_FILE_NOT_FOUND = EXOS_PROT;

/** The ROM's calls: EXOS's device calls 1-13, and Klive's own "abandon" */
export const enum EpHostFsCall {
  Open = 1,
  Create = 2,
  Close = 3,
  Destroy = 4,
  ReadChar = 5,
  ReadBlock = 6,
  WriteChar = 7,
  WriteBlock = 8,
  ReadStatus = 9,
  SetStatus = 10,
  Init = 12,
  Abandon = 14
}

/** Where FILE:'s files live: the host folder in the app, a map in the tests */
export interface EpHostFileStore {
  /** The file's bytes, or undefined when there is none; names match whatever their case */
  read(name: string): Promise<Uint8Array | undefined>;
  write(name: string, data: Uint8Array): Promise<void>;
  /** Whether the file was there to remove */
  remove(name: string): Promise<boolean>;
}

/** What the device needs of the machine while it answers a call */
export interface EpHostFsCpu {
  /** The call the ROM made */
  readonly call: number;
  getBc(): number;
  setBc(value: number): void;
  getDe(): number;
  setDe(value: number): void;
  getSp(): number;
  /** A byte through the current paging */
  read(address: number): number;
  write(address: number, value: number): void;
  /** A byte of the 4 MB physical space (RAM only for writes) */
  readPhysical(address: number): number;
  writePhysical(address: number, value: number): void;
}

/** A call that needs the file store: the machine runs it with one, then lets the CPU go on */
export type EpHostFsAsync = (store: EpHostFileStore) => Promise<void>;

type Channel = {
  name: string;
  data: Uint8Array;
  length: number;
  position: number;
  /** Written since it was opened: saved when it is closed */
  dirty: boolean;
};

/** An in-memory file store (the tests'; names match whatever their case) */
export class EpMemoryFileStore implements EpHostFileStore {
  readonly files = new Map<string, Uint8Array>();

  async read(name: string): Promise<Uint8Array | undefined> {
    const key = this.find(name);
    return key === undefined ? undefined : this.files.get(key)!.slice();
  }

  async write(name: string, data: Uint8Array): Promise<void> {
    this.files.delete(this.find(name) ?? name);
    this.files.set(name, data.slice());
  }

  async remove(name: string): Promise<boolean> {
    const key = this.find(name);
    return key !== undefined && this.files.delete(key);
  }

  private find(name: string): string | undefined {
    const wanted = name.toUpperCase();
    return [...this.files.keys()].find((k) => k.toUpperCase() === wanted);
  }
}

export class EpHostFs {
  private readonly channels = new Map<number, Channel>();
  /** The channel the last open or create made: the ROM abandons it when EXOS gives it no buffer */
  private lastOpened?: number;

  /** Forgets every channel (EXOS re-initialises its devices; a state was loaded) */
  reset(): void {
    this.channels.clear();
    this.lastOpened = undefined;
  }

  /** The names of the open channels' files, for the tests */
  get openFiles(): string[] {
    return [...this.channels.values()].map((c) => c.name);
  }

  /**
   * Answers a call. Returns undefined when it is done (the status is on the stack, the results in
   * the registers), or the part that needs the file store
   */
  service(cpu: EpHostFsCpu): EpHostFsAsync | undefined {
    const sp = cpu.getSp();
    const channel = cpu.read((sp + 1) & 0xffff);
    const setStatus = (status: number) => cpu.write((sp + 1) & 0xffff, status);
    const open = this.channels.get(channel);
    const ok = () => setStatus(EXOS_OK);

    switch (cpu.call) {
      case EpHostFsCall.Init:
        this.reset();
        ok();
        return undefined;

      case EpHostFsCall.Open: {
        const name = this.readName(cpu);
        return async (store) => {
          const data = await store.read(name);
          if (!data) {
            setStatus(EP_FILE_NOT_FOUND);
            return;
          }
          this.channels.set(channel, { name, data, length: data.length, position: 0, dirty: false });
          this.lastOpened = channel;
          ok();
        };
      }

      case EpHostFsCall.Create:
        this.channels.set(channel, { name: this.readName(cpu), data: new Uint8Array(256), length: 0, position: 0, dirty: true });
        this.lastOpened = channel;
        ok();
        return undefined;

      case EpHostFsCall.Abandon:
        if (this.lastOpened !== undefined) this.channels.delete(this.lastOpened);
        this.lastOpened = undefined;
        return undefined;
    }

    if (!open) {
      setStatus(EXOS_ICHAN);
      return undefined;
    }

    switch (cpu.call) {
      case EpHostFsCall.Close:
        this.channels.delete(channel);
        if (!open.dirty) {
          ok();
          return undefined;
        }
        return async (store) => {
          await store.write(open.name, open.data.slice(0, open.length));
          ok();
        };

      case EpHostFsCall.Destroy:
        this.channels.delete(channel);
        return async (store) => {
          setStatus((await store.remove(open.name)) ? EXOS_OK : EP_FILE_NOT_FOUND);
        };

      case EpHostFsCall.ReadChar:
        if (open.position >= open.length) {
          setStatus(EXOS_EOF);
        } else {
          cpu.setBc((open.data[open.position++] << 8) | (cpu.getBc() & 0xff));
          ok();
        }
        return undefined;

      case EpHostFsCall.ReadBlock: {
        let count = cpu.getBc();
        let address = cpu.getDe();
        while (count > 0 && open.position < open.length) {
          this.writeUser(cpu, address, open.data[open.position++]);
          address = (address + 1) & 0xffff;
          count--;
        }
        cpu.setBc(count);
        cpu.setDe(address);
        setStatus(count > 0 ? EXOS_EOF : EXOS_OK);
        return undefined;
      }

      case EpHostFsCall.WriteChar:
        this.put(open, cpu.getBc() >> 8);
        ok();
        return undefined;

      case EpHostFsCall.WriteBlock: {
        let count = cpu.getBc();
        let address = cpu.getDe();
        while (count > 0) {
          this.put(open, this.readUser(cpu, address));
          address = (address + 1) & 0xffff;
          count--;
        }
        cpu.setBc(0);
        cpu.setDe(address);
        ok();
        return undefined;
      }

      case EpHostFsCall.ReadStatus:
        // --- C: 0 a character can be read, FFh the end of the file
        cpu.setBc((cpu.getBc() & 0xff00) | (open.position >= open.length ? 0xff : 0x00));
        ok();
        return undefined;

      case EpHostFsCall.SetStatus: {
        // --- C: what to set (bit 0 the file pointer, bit 2 the protection byte); DE: the 16-byte block
        const flags = cpu.getBc() & 0xff;
        const block = cpu.getDe();
        if (flags & 0x04) {
          setStatus(EXOS_NOFN);
          return undefined;
        }
        if (flags & 0x01) {
          let position = 0;
          for (let i = 3; i >= 0; i--) position = position * 256 + this.readUser(cpu, block + i);
          open.position = position;
        }
        const put32 = (offset: number, value: number) => {
          for (let i = 0; i < 4; i++) this.writeUser(cpu, block + offset + i, (value >>> (8 * i)) & 0xff);
        };
        put32(0, open.position);
        put32(4, open.length);
        // --- The pointer and the size are valid
        cpu.setBc((cpu.getBc() & 0xff00) | 0x03);
        ok();
        return undefined;
      }

      default:
        setStatus(EXOS_NOFN);
        return undefined;
    }
  }

  /** The name DE points at: a length byte, then the characters */
  private readName(cpu: EpHostFsCpu): string {
    const de = cpu.getDe();
    const length = cpu.read(de);
    let name = "";
    for (let i = 1; i <= length; i++) name += String.fromCharCode(cpu.read((de + i) & 0xffff));
    return name;
  }

  /** The physical address of a caller's address: its paging is in the system segment at BFFCh-BFFFh */
  private userPhysical(cpu: EpHostFsCpu, address: number): number {
    const segment = cpu.readPhysical(0xff * 0x4000 + 0x3ffc + ((address >> 14) & 3));
    return segment * 0x4000 + (address & 0x3fff);
  }

  private readUser(cpu: EpHostFsCpu, address: number): number {
    return cpu.readPhysical(this.userPhysical(cpu, address & 0xffff));
  }

  private writeUser(cpu: EpHostFsCpu, address: number, value: number): void {
    cpu.writePhysical(this.userPhysical(cpu, address & 0xffff), value);
  }

  private put(channel: Channel, value: number): void {
    if (channel.position >= channel.data.length) {
      const grown = new Uint8Array(Math.max(256, channel.data.length * 2, channel.position + 1));
      grown.set(channel.data);
      channel.data = grown;
    }
    channel.data[channel.position++] = value & 0xff;
    channel.length = Math.max(channel.length, channel.position);
    channel.dirty = true;
  }
}
