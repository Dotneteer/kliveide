import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { MEDIA_MICRODRIVE_1, MEDIA_MICRODRIVE_2 } from "@common/structs/project-const";
import { MICRODRIVE_1_WP, MICRODRIVE_2_WP, MICRODRIVE_CHANGES, MICRODRIVE_UNSAVED } from "@emu/machines/machine-props";
import { mdrShape } from "@emu/machines/microdrive/mdrImage";
import { IF1_SLOT_SIZE, Interface1Support, type Interface1CorePrefix } from "./if1CoreBridge";
import { checkInterface1Rom, IF1_ROM_RESOURCE, type Interface1RomEdition } from "./if1Rom";

/*
 * The Interface 1 on a machine class (`.plans/MICRODRIVE_PLAN.md` Phase 3): what the 48K and the
 * 128K share. It connects the interface with its ROM, puts the media store's cartridges into the
 * drives, and hands the slots the guest writes back to the controller, as `Beta128Disks` does for
 * the Pentagon's disks.
 *
 * The UI has two drives (Q3), `MEDIA_MICRODRIVE_1/2`; the core has eight.
 */

export const UI_MICRODRIVES = 2;
const MEDIA_IDS = [MEDIA_MICRODRIVE_1, MEDIA_MICRODRIVE_2];
const WP_PROPS = [MICRODRIVE_1_WP, MICRODRIVE_2_WP];

/** What the support needs from its machine */
export interface Interface1MachineHost {
  getIf1Runtime(): { exports: object } | undefined;
  getMachineProperty(key: string): unknown;
  /** Sets a property without the machine reacting to it (the machine's `super.setMachineProperty`) */
  setMachinePropertyRaw(key: string, value?: unknown): void;
  /** Reads a ROM: a path the user named, or a resource name (`loadRomFromResource`) */
  loadRom(pathOrResource: string): Promise<Uint8Array>;
}

/** A drive, as the host knows it */
type DriveState = {
  /** The bytes it was last given (the controller re-sends them on every start) */
  contents: Uint8Array;
  /** It came back with a Klive state: the guest's writes are not written back (state-files plan D11) */
  detached?: boolean;
};

export class Interface1MachineSupport {
  readonly bridge: Interface1Support;
  /** Why the interface is not connected although the machine config asks for it */
  problem?: string;
  /** The ROM edition in use */
  edition?: Interface1RomEdition;
  private readonly drives: (DriveState | undefined)[] = [undefined, undefined];
  private revision = 0;

  constructor(
    prefix: Interface1CorePrefix,
    private readonly host: Interface1MachineHost
  ) {
    this.bridge = new Interface1Support(prefix, { getIf1Runtime: () => host.getIf1Runtime() });
  }

  get available(): boolean {
    return this.bridge.available;
  }

  /**
   * Connects the interface with the ROM the user named (`romPath`) or the shipped one - or
   * disconnects it. A ROM that cannot be used leaves it disconnected, with the reason in `problem`.
   */
  async connect(enabled: boolean, romPath?: string): Promise<boolean> {
    this.problem = undefined;
    this.edition = undefined;
    if (!this.bridge.available) return false;
    if (!enabled) {
      this.bridge.setPresent(false);
      return false;
    }
    let rom: Uint8Array;
    try {
      rom = await this.host.loadRom(romPath || IF1_ROM_RESOURCE);
    } catch (err) {
      this.problem = `Cannot read the Interface 1 ROM ${romPath ?? IF1_ROM_RESOURCE}: ${(err as Error)?.message ?? err}`;
      this.bridge.setPresent(false);
      return false;
    }
    const check = checkInterface1Rom(rom);
    if (check.ok === false) {
      this.problem = `The Interface 1 ROM must be 8192 bytes; ${romPath} has ${check.size}`;
      this.bridge.setPresent(false);
      return false;
    }
    this.edition = check.edition;
    this.bridge.uploadRom(rom);
    this.bridge.setPresent(true);
    this.syncMedia();
    return true;
  }

  get present(): boolean {
    return this.bridge.state().present;
  }

  /** The running motors, bit n drive n + 1: the controller runs a fast Microdrive unthrottled (plan §3 M6) */
  get motors(): number {
    return this.bridge.available ? this.bridge.selectBits() : 0;
  }

  /** Puts the media store's cartridges into the drives (after a setup or a reset) */
  syncMedia(): void {
    for (let drive = 0; drive < UI_MICRODRIVES; drive++) {
      this.insert(drive, this.host.getMachineProperty(MEDIA_IDS[drive]), !!this.host.getMachineProperty(WP_PROPS[drive]));
    }
  }

  /**
   * A machine property changed: a cartridge (the bytes of its file) or its write protection
   * @returns true when the property was one of the Interface 1's
   */
  onProperty(key: string, value: unknown): boolean {
    const media = MEDIA_IDS.indexOf(key);
    if (media >= 0) {
      this.insert(media, value, !!this.host.getMachineProperty(WP_PROPS[media]));
      this.clearUnsaved(media);
      return true;
    }
    const wp = WP_PROPS.indexOf(key);
    if (wp >= 0) {
      this.bridge.setWriteProtected(wp, !!value);
      return true;
    }
    return false;
  }

  private insert(drive: number, contents: unknown, writeProtected: boolean): void {
    if (!this.bridge.available) return;
    if (!(contents instanceof Uint8Array) || contents.length === 0) {
      this.bridge.eject(drive);
      this.drives[drive] = undefined;
      return;
    }
    // --- The same file again (`attachStoredMedia` on every start): the cartridge in the core, with
    // --- the guest's writes, stays; only a newly read file replaces it
    if (this.drives[drive]?.contents === contents) {
      this.bridge.setWriteProtected(drive, writeProtected);
      return;
    }
    try {
      mdrShape(contents);
    } catch {
      this.bridge.eject(drive);
      this.drives[drive] = undefined;
      return;
    }
    this.bridge.insert(drive, contents, writeProtected);
    this.drives[drive] = { contents };
    this.revision = this.bridge.state().dirtyRevision;
  }

  private clearUnsaved(drive: number): void {
    const unsaved = this.host.getMachineProperty(MICRODRIVE_UNSAVED) as boolean[] | undefined;
    if (unsaved?.[drive]) {
      const next = [...unsaved];
      next[drive] = false;
      this.host.setMachinePropertyRaw(MICRODRIVE_UNSAVED, next);
    }
  }

  /** The guest's writes since the last publish go to `MICRODRIVE_CHANGES` for the controller */
  publish(): void {
    const revision = this.bridge.state().dirtyRevision;
    if (revision === this.revision) return;
    this.revision = revision;
    this.merge(this.collect(false));
  }

  /**
   * After a reverse-debugging fork (REVERSE_DEBUGGING_PLAN D13): every slot of every written-back
   * cartridge goes to the write-back, so the `.mdr` files follow the restored in-core cartridges
   * @returns true when there was a cartridge to write back
   */
  republishAll(): boolean {
    const changes = this.collect(true);
    if (!changes.some((c) => c)) return false;
    this.merge(changes);
    return true;
  }

  /** The core changed under the host (a replay): its write revision is not a new write */
  followCoreRevision(): void {
    this.revision = this.bridge.state().dirtyRevision;
  }

  /** A Klive state replaced the core's memory: the cartridges come with it, detached from their files */
  afterStateLoad(): void {
    for (let drive = 0; drive < UI_MICRODRIVES; drive++) {
      const info = this.bridge.drive(drive);
      this.drives[drive] = info.inserted ? { contents: new Uint8Array(0), detached: true } : undefined;
    }
    this.revision = this.bridge.state().dirtyRevision;
  }

  /** The ROM as the CPU sees it while paged: the 8K twice over $0000-$3FFF */
  romView(): Uint8Array {
    const rom = this.bridge.rom();
    const view = new Uint8Array(0x4000);
    if (rom) {
      view.set(rom, 0);
      view.set(rom, 0x2000);
    }
    return view;
  }

  /** A drive's cartridge as an .mdr, as the guest left it */
  cartridge(drive: number): Uint8Array | undefined {
    return this.bridge.cartridge(drive);
  }

  private collect(all: boolean): (SectorChanges | undefined)[] {
    const result: (SectorChanges | undefined)[] = [undefined, undefined];
    const unsaved = [false, false];
    for (let drive = 0; drive < UI_MICRODRIVES; drive++) {
      const state = this.drives[drive];
      if (!state) continue;
      const slots = all ? Array.from({ length: this.bridge.drive(drive).slots }, (_, i) => i) : this.bridge.dirtySlots(drive);
      this.bridge.clearDirty(drive);
      if (slots.length === 0) continue;
      if (state.detached) {
        unsaved[drive] = true;
        continue;
      }
      const mdr = this.bridge.cartridge(drive);
      if (!mdr) continue;
      const changes: SectorChanges = new Map();
      for (const slot of slots) changes.set(slot, mdr.slice(slot * IF1_SLOT_SIZE, (slot + 1) * IF1_SLOT_SIZE));
      result[drive] = changes;
    }
    if (unsaved.some((u) => u)) {
      const current = (this.host.getMachineProperty(MICRODRIVE_UNSAVED) as boolean[] | undefined) ?? [false, false];
      this.host.setMachinePropertyRaw(MICRODRIVE_UNSAVED, current.map((u, d) => u || unsaved[d]));
    }
    return result;
  }

  private merge(changes: (SectorChanges | undefined)[]): void {
    if (!changes.some((c) => c)) return;
    const pending = (this.host.getMachineProperty(MICRODRIVE_CHANGES) as (SectorChanges | undefined)[] | undefined) ?? [
      undefined,
      undefined
    ];
    const next = pending.map((p, drive) => {
      const add = changes[drive];
      if (!add) return p;
      if (!p) return add;
      add.forEach((data, key) => p.set(key, data));
      return p;
    });
    this.host.setMachinePropertyRaw(MICRODRIVE_CHANGES, next);
  }
}
